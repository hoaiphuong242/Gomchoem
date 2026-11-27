import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Lazy initialization keeps build and the liveness endpoint independent of DB config.
export function getPrisma() {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is required");
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 5000,
      }),
    });
  }
  return globalForPrisma.prisma;
}
