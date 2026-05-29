import { PrismaClient } from "@prisma/client";

// In dev, Next.js hot-reloads modules, which would otherwise spawn a new Prisma
// client (and a new DB connection pool) on every reload. We cache the client on
// globalThis so HMR reuses the same instance.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
