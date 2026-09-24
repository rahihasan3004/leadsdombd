import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("FATAL: DATABASE_URL environment variable must be defined.");
}

try {
  new URL(databaseUrl);
} catch {
  throw new Error("FATAL: DATABASE_URL is not a valid URL.");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.prisma = globalForPrisma.prisma ?? db;

export * from "@prisma/client";
