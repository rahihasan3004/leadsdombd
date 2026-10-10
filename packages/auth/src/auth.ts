import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@fine-leads/database";
import { verifyPassword } from "./password";
import { resolveAuthSecretForConfig } from "./env";
import crypto from "crypto";

const googleId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

class EmailNotVerifiedError extends CredentialsSignin {
  override code = "email_not_verified";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Throws at startup if AUTH_SECRET is missing (no hard-coded fallback).
  secret: resolveAuthSecretForConfig(),
  adapter: PrismaAdapter(db),
  trustHost: true,
  debug: false,
  logger: {
    error(error) {
      if (error instanceof CredentialsSignin) return; // expected: bad password / unverified email
      console.error("[AUTH_ERROR]", error);
    },
    warn(code) {
      console.warn("[AUTH_WARN]", code);
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
            // Safe only because signIn() requires Google's email_verified and
            // jwt() wipes any password set on a previously unverified account.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        const user = await db.user.findUnique({
          where: { email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Checked only after the password, so verification status isn't leaked to non-owners.
        if (!user.emailVerified) {
          throw new EmailNotVerifiedError();
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
    async signIn({ account, profile }) {
      if (account?.provider === "credentials") {
        return true; // verification enforced in authorize()
      }
      if (account?.provider === "google") {
        return profile?.email_verified === true;
      }
      return false;
    },
    async jwt({ token, user, trigger, session, account, profile }) {
      if (trigger === "update" && session?.name) {
        token.name = String(session.name);
      }
      if (user) {
        let dbUser: any = null;
        try {
          dbUser = await db.user.findUnique({
            where: {
              id: (user as any).id ?? token.sub ?? (user.email as string),
            },
            select: {
              id: true,
              name: true,
              role: true,
              walletBalance: true,
              credits: true,
              tokenVersion: true,
              emailVerified: true,
            },
          });
        } catch (dbErr: any) {
          console.warn("[AUTH_JWT_USER_SELECT_FALLBACK]", dbErr?.message);
          // Fallback if schema migration for credits/wallet is missing or failing in database
          try {
            dbUser = await db.user.findUnique({
              where: {
                id: (user as any).id ?? token.sub ?? (user.email as string),
              },
            });
          } catch (innerErr) {
            console.error("[AUTH_JWT_USER_FETCH_FAIL]", innerErr);
          }
        }

        if (dbUser) {
          token.id = dbUser.id;
          token.email = (user.email ?? "") as string;
          token.name = (dbUser?.name ??
            user?.name ??
            token.name ??
            "") as string;
          token.role = (dbUser.role as string) ?? "USER";
          token.credits = dbUser.credits ?? 0;
          token.walletBalance = dbUser.walletBalance
            ? typeof dbUser.walletBalance.toNumber === "function"
              ? dbUser.walletBalance.toNumber()
              : Number(dbUser.walletBalance)
            : 0;
          token.tokenVersion = dbUser.tokenVersion ?? 0;

          // Only a provider-verified Google email may mark the account verified.
          // Any password on a previously unverified account could have been set by
          // someone else (pre-account-takeover), so it is removed; the owner can
          // set one via "Forgot password".
          if (
            !dbUser.emailVerified &&
            account?.provider === "google" &&
            profile?.email_verified === true
          ) {
            await db.user.update({
              where: { id: dbUser.id },
              data: { emailVerified: new Date(), passwordHash: null },
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
                  name:
                    (user.name as string) ||
                    `${user.email as string}'s Organization`,
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
          const fallbackUser = user as {
            role?: string;
            walletBalance?: number;
            credits?: number;
            tokenVersion?: number;
          };
          token.id = (user.id ?? token.sub ?? "") as string;
          token.email = (user.email ?? "") as string;
          token.name = (user.name ?? "") as string;
          token.role = fallbackUser.role ?? "USER";
          token.credits = fallbackUser.credits ?? 0;
          token.walletBalance = fallbackUser.walletBalance ?? 0;
          token.tokenVersion = fallbackUser.tokenVersion ?? 0;
        }
      }

      if (token.id && !user) {
        try {
          const dbUser: any = await db.user.findUnique({
            where: { id: token.id as string },
          });
          if (!dbUser) return null;
          if (dbUser) {
            const jtv = (token.tokenVersion ?? 0) as number;
            if (
              dbUser.tokenVersion !== undefined &&
              jtv !== dbUser.tokenVersion
            ) {
              return null;
            }
            if (
              dbUser.walletBalance !== undefined &&
              dbUser.walletBalance !== null
            ) {
              token.walletBalance =
                typeof dbUser.walletBalance.toNumber === "function"
                  ? dbUser.walletBalance.toNumber()
                  : Number(dbUser.walletBalance);
            }
            if (dbUser.credits !== undefined) {
              token.credits = dbUser.credits;
            }
            token.role = dbUser.role;
            // Keep identity fields in sync with the DB (e.g. after an email or name change).
            if (dbUser.email) {
              token.email = dbUser.email;
            }
            if (typeof dbUser.name === "string") {
              token.name = dbUser.name;
            }
          }
        } catch (dbErr) {
          console.warn("[AUTH_JWT_REFRESH_WARN]", dbErr);
          return null; // Revocation cannot fail open during a database outage.
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.name = (token.name as string) ?? "";
        session.user.email = token.email as string;
        session.user.role = token.role as string;
        session.user.credits = token.credits as number;
        session.user.walletBalance = token.walletBalance as number;
        session.user.tokenVersion = token.tokenVersion as number;
      }
      return session;
    },
  },
});
