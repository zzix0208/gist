import 'server-only';
import { PrismaClient } from '@prisma/client';

// Reuse one PrismaClient across dev hot-reloads (otherwise every file save
// leaks a new connection pool). In production each lambda gets a fresh client.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
