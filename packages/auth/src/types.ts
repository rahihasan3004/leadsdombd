import { type Session } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: string;
      walletBalance: number;
      tokenVersion: number;
      organizationId?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    name: string | null;
    role: string;
    walletBalance: number;
    tokenVersion: number;
    organizationId?: string | null;
  }
}
