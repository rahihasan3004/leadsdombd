import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@fine-leads/database";
import { verifyPassword } from "./password";
import crypto from "crypto";

const isDev = process.env.NODE_ENV !== "production";

const defaultAuthUrl =
  isDev ? "http://localhost:3000" : process.env.NEXT_PUBLIC_APP_URL ?? "https://getleadsdom.com";

const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

console.error("[AUTH_INIT_DIAGNOSTICS]", {
  has_AUTH_GOOGLE_ID: !!process.env.AUTH_GOOGLE_ID,
  has_GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
  has_AUTH_GOOGLE_SECRET: !!process.env.AUTH_GOOGLE_SECRET,
  has_GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
  googleId_length: googleId ? googleId.length : 0,
  googleSecret_length: googleSecret ? googleSecret.length : 0,
  has_AUTH_SECRET: !!process.env.AUTH_SECRET,
  has_NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
  has_AUTH_URL: !!process.env.AUTH_URL,
  has_NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "leadsdom_production_auth_secret_key_2026",
  adapter: PrismaAdapter(db),
  trustHost: true,
  debug: true,
  logger: {
    error(error) {
      console.error("[AUTH_ERROR_FULL_RAW]", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      console.error("[AUTH_ERROR_STACK]", (error as any)?.stack || error);
    },
    warn(code) {
      console.warn("[AUTH_WARN_RAW]", code);
    },
    debug(code, ...message) {
      console.log("[AUTH_DEBUG_RAW]", code, ...message);
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    ...(googleId && googleSecret
      ? [
          Google({
            clientId: googleId,
            clientSecret: googleSecret,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : [
          Google({
            clientId: googleId || "MISSING_GOOGLE_CLIENT_ID",
            clientSecret: googleSecret || "MISSING_GOOGLE_CLIENT_SECRET",
            allowDangerousEmailAccountLinking: true,
          }),
        ]),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || process.env.GITHUB_CLIENT_ID || "",
      clientSecret:
        process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: false,
      checks: ["state"],
      authorization: {
        params: {
          scope: "read:user user:email",
        },
      },
    }),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.error("[AUTH_DEBUG_TRACE]", { credentials: { email: credentials?.email, password: credentials?.password ? "***" : null }, timestamp: new Date().toISOString() });
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const user = await db.user.findUnique({
          where: { email },
        });
        console.error("[AUTH_DEBUG_TRACE]", { email, userFound: !!user, hasPasswordHash: !!user?.passwordHash, timestamp: new Date().toISOString() });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        console.error("[AUTH_DEBUG_TRACE]", { email, isValid, timestamp: new Date().toISOString() });
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          walletBalance: user.walletBalance.toNumber(),
          tokenVersion: user.tokenVersion,
        } as any;
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "credentials") {
        return true;
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session?.name) {
        token.name = String(session.name);
      }
      if (user) {
        let dbUser: any = null;
        try {
          dbUser = await db.user.findUnique({
            where: { id: (user as any).id ?? token.sub ?? (user.email as string) },
            select: { id: true, name: true, role: true, walletBalance: true, credits: true, tokenVersion: true, emailVerified: true },
          });
        } catch (dbErr: any) {
          console.warn("[AUTH_JWT_USER_SELECT_FALLBACK]", dbErr?.message);
          // Fallback if schema migration for credits/wallet is missing or failing in database
          try {
            dbUser = await db.user.findUnique({
              where: { id: (user as any).id ?? token.sub ?? (user.email as string) },
            });
          } catch (innerErr) {
            console.error("[AUTH_JWT_USER_FETCH_FAIL]", innerErr);
          }
        }

        if (dbUser) {
          token.id = dbUser.id;
          token.email = (user.email ?? "") as string;
          token.name = (dbUser?.name ?? user?.name ?? token.name ?? "") as string;
          token.role = (dbUser.role as string) ?? "USER";
          token.credits = dbUser.credits ?? 0;
          token.walletBalance = dbUser.walletBalance ? (typeof dbUser.walletBalance.toNumber === "function" ? dbUser.walletBalance.toNumber() : Number(dbUser.walletBalance)) : 0;
          token.tokenVersion = dbUser.tokenVersion ?? 0;

          if (!dbUser.emailVerified) {
            await db.user.update({
              where: { id: dbUser.id },
              data: { emailVerified: new Date() },
            });
          }

          if (!token.initialized) {
            token.initialized = true;
            const hasOrg = await db.organization.findFirst({
              where: { users: { some: { id: dbUser.id } } },
            });
            const hasSubscription = await db.subscription.findFirst({
              where: { userId: dbUser.id },
            });
            if (!hasOrg) {
              const slug = `org-${crypto.randomUUID().slice(0, 12)}`;
              await db.organization.create({
                data: {
                  name: (user.name as string) || `${(user.email as string)}'s Organization`,
                  slug,
                  users: { connect: { id: dbUser.id } },
                },
              });
            }
            if (!hasSubscription) {
              const org = await db.organization.findFirst({
                where: { users: { some: { id: dbUser.id } } },
              });
              if (org) {
                await db.subscription.create({
                  data: {
                    userId: dbUser.id,
                    organizationId: org.id,
                    tier: "FREE",
                    status: "ACTIVE",
                  },
                });
              }
            }
          }
        } else {
          token.id = (user.id ?? token.sub ?? "") as string;
          token.email = (user.email ?? "") as string;
          token.name = (user.name ?? "") as string;
          token.role = (user.role ?? "USER") as string;
          token.credits = (((user as any).credits ?? 0) as number);
          token.walletBalance = (user.walletBalance as number);
          token.tokenVersion = (((user as any).tokenVersion ?? 0) as number);
        }
      }

      if (token.id && !user) {
        try {
          const dbUser: any = await db.user.findUnique({
            where: { id: (token.id as string) },
          });
          if (dbUser) {
            const jtv = ((token.tokenVersion ?? 0) as number);
            if (dbUser.tokenVersion !== undefined && jtv !== dbUser.tokenVersion) {
              return null;
            }
            if (dbUser.walletBalance !== undefined && dbUser.walletBalance !== null) {
              token.walletBalance = typeof dbUser.walletBalance.toNumber === "function" ? dbUser.walletBalance.toNumber() : Number(dbUser.walletBalance);
            }
            if (dbUser.credits !== undefined) {
              token.credits = dbUser.credits;
            }
          }
        } catch (dbErr) {
          console.warn("[AUTH_JWT_REFRESH_WARN]", dbErr);
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.name = (token.name as string) ?? "";
        session.user.email = (token.email as string);
        session.user.role = (token.role as string);
        session.user.credits = (token.credits as number);
        session.user.walletBalance = (token.walletBalance as number);
        session.user.tokenVersion = (token.tokenVersion as number);
      }
      return session;
    },
  },
});
