import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { db } from "@fine-leads/database";
import { verifyPassword } from "./password";
import crypto from "crypto";

const authSecret = process.env.AUTH_SECRET;
if (!authSecret && process.env.NODE_ENV === "production") {
  throw new Error("FATAL: AUTH_SECRET environment variable must be defined in production.");
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  walletBalance: number;
  tokenVersion: number;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: process.env.NODE_ENV !== "production"
    ? true
    : process.env.AUTH_TRUST_HOST === "true"
      ? ((host: string) => {
          const allowed = [process.env.AUTH_URL, process.env.NEXTAUTH_URL].filter(Boolean) as string[];
          return allowed.some((url) => new URL(url).hostname === host);
        })
      : false,
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
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
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
      clientSecret: process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET || "",
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
          walletBalance: user.walletBalance,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
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
          const org = await db.organization.create({
            data: {
              name: user.name || `${normalizedEmail}'s Organization`,
              slug: `org-${crypto.randomUUID().slice(0, 12)}`,
            },
          });

          const newUser = await db.user.create({
            data: {
              name: user.name,
              email: normalizedEmail,
              image: user.image,
              emailVerified: new Date(),
              organizationId: org.id,
            },
          });

          await db.account.create({
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

          await db.subscription.create({
            data: {
              userId: newUser.id,
              organizationId: org.id,
              tier: "FREE",
              status: "ACTIVE",
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role;
        token.walletBalance = (user as any).walletBalance;
        token.tokenVersion = (user as any).tokenVersion ?? 0;
      }
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.email) token.email = session.email;
      }

      if (token.id && !user) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { tokenVersion: true, walletBalance: true },
        });
        if (dbUser) {
          const jtv = (token.tokenVersion as number) ?? 0;
          if (jtv !== dbUser.tokenVersion) {
            return {};
          }
          token.walletBalance = dbUser.walletBalance;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
        session.user.email = token.email as string;
        session.user.role = token.role as any;
        (session.user as any).walletBalance = token.walletBalance;
        (session.user as any).tokenVersion = token.tokenVersion;
      }
      return session;
    },
  },
});