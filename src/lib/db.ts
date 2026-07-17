import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Instantiate the Prisma adapter pointing to the database
const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const dbPath = dbUrl.startsWith("file:") ? dbUrl.substring(5) : dbUrl;

const adapter = new PrismaBetterSqlite3({
  url: dbPath,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
