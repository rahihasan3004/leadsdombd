import type { UserRole } from "@fine-leads/database";

export function isAdmin(role: UserRole | string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export function isSuperAdmin(role: UserRole | string): boolean {
  return role === "SUPER_ADMIN";
}