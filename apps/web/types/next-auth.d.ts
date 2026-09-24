import { DefaultSession } from "next-auth";
import type { UserRole } from "@fine-leads/database";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole | string;
      walletBalance?: number;
      organizationId?: string | null;
    };
  }

  interface User {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    role?: UserRole | string;
    walletBalance?: number;
    organizationId?: string | null;
  }
}

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole | string;
      walletBalance?: number;
      organizationId?: string | null;
    };
  }

  interface User {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    role?: UserRole | string;
    walletBalance?: number;
    organizationId?: string | null;
  }
}
