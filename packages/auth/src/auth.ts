import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { db } from "@fine-leads/database";
import { verifyPassword } from "./password";
import crypto from "crypto";

const isDev = process.env.NODE_ENV !== "production";

const defaultAuthUrl =
  isDev ? "http://localhost:3000" : process.env.NEXT_PUBLIC_APP_URL ?? "https://getleadsdom.com";

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

if (!authSecret && isDev) {
  console.warn(
    "[auth] AUTH_SECRET / NEXTAUTH_SECRET is not set. Using a fallback JWT secret for localhost only."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret || crypto.randomBytes(32).toString("hex"),
  trustHost: isDev || process.env.AUTH_TRUST_HOST === "true",
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login?error=auth",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID || process.env.GITHUB_CLIENT_ID || "",
      clientSecret:
        process.env.AUTH_GITHUB_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
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
      if ((account?.provider === "google" || account?.provider === "github") && user.email) {
        const normalizedEmail = user.email.toLowerCase().trim();

        const existingUser = await db.user.findUnique({
          where: { email: normalizedEmail },
          include: { accounts: true },
        });

        if (existingUser) {
          const hasProviderAccount = existingUser.accounts.some(
            (acc) => acc.provider === account.provider
          );
          if (!hasProviderAccount) {
            await db.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }
          if (!existingUser.emailVerified) {
            await db.user.update({
              where: { id: existingUser.id },
              data: { emailVerified: new Date() },
            });
          }
        } else {
          await db.$transaction(async (tx) => {
            const org = await tx.organization.create({
              data: {
                name: user.name || `${normalizedEmail}'s Organization`,
                slug: `org-${crypto.randomUUID().slice(0, 12)}`,
              },
            });

            const newUser = await tx.user.create({
              data: {
                name: user.name,
                email: normalizedEmail,
                image: user.image,
                emailVerified: new Date(),
                organizationId: org.id,
              },
            });

            await tx.account.create({
              data: {
                userId: newUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });

            await tx.subscription.create({
              data: {
                userId: newUser.id,
                organizationId: org.id,
                tier: "FREE",
                status: "ACTIVE",
              },
            });
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await db.user.findUnique({
          where: { email: (user.email as string) },
          select: { id: true, role: true, walletBalance: true, tokenVersion: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.email = (user.email ?? "") as string;
          token.name = (user.name ?? "") as string;
          token.role = dbUser.role as string;
          token.walletBalance = dbUser.walletBalance.toNumber();
          token.tokenVersion = dbUser.tokenVersion;
        } else {
          token.id = (user.id ?? token.sub ?? "") as string;
          token.email = (user.email ?? "") as string;
          token.name = (user.name ?? "") as string;
          token.role = (user.role ?? "") as string;
          token.walletBalance = (user.walletBalance as number);
          token.tokenVersion = (((user as any).tokenVersion ?? 0) as number);
        }
      }

      if (token.id && !user) {
        const dbUser = await db.user.findUnique({
          where: { id: (token.id as string) },
          select: { tokenVersion: true, walletBalance: true },
        });
        if (dbUser) {
          const jtv = ((token.tokenVersion ?? 0) as number);
          if (jtv !== dbUser.tokenVersion) {
            return null;
          }
          token.walletBalance = dbUser.walletBalance.toNumber();
        }
      }

      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.name = (token.name as string | null);
        session.user.email = (token.email as string);
        session.user.role = (token.role as string);
        session.user.walletBalance = (token.walletBalance as number);
        session.user.tokenVersion = (token.tokenVersion as number);
      }
      return session;
    },
  },
});
