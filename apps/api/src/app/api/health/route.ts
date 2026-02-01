// =============================================================================
// Health Check API - Simple endpoint to verify the API is running
// =============================================================================

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'unknown';
  let userCount = 0;
  let dbError = '';

  try {
    // Create a new Prisma instance directly
    const prisma = new PrismaClient();
    userCount = await prisma.user.count();
    await prisma.$disconnect();
    dbStatus = 'connected';
  } catch (error: any) {
    dbError = error.message || String(error);
    dbStatus = 'error';
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      userCount,
      error: dbError || undefined,
    },
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      dbUrlPrefix: process.env.DATABASE_URL?.substring(0, 30) + '...',
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
    }
  });
}
