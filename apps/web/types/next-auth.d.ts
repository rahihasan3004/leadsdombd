import { DefaultSession } from "next-auth";
import type { UserRole } from "@fine-leads/database";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole | string;
      walletBalance?: number;
      organizationId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: UserRole | string;
    walletBalance?: number;
    organizationId?: string | null;
  }
}

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      role: UserRole | string;
      walletBalance?: number;
      organizationId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role?: UserRole | string;
    walletBalance?: number;
    organizationId?: string | null;
  }
}
