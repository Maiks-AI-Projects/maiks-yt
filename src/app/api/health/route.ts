import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  const timestamp = new Date().toISOString();
  const version = "0.1.0"; // From package.json
  
  let prismaStatus = "Unknown";
  let redisStatus = "Placeholder: Redis Not Configured"; // Redis not in dependencies, so placeholder as requested

  try {
    // Basic Prisma connection check
    await prisma.$queryRaw`SELECT 1`;
    prismaStatus = "OK";
  } catch (error) {
    prismaStatus = `Error: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    await prisma.$disconnect();
  }

  return NextResponse.json({
    status: "OK",
    version,
    timestamp,
    services: {
      prisma: prismaStatus,
      redis: redisStatus
    }
  });
}
