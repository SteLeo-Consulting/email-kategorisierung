// =============================================================================
// Health Check API - Simple endpoint to verify the API is running
// =============================================================================

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus = 'unknown';
  let userCount = 0;

  try {
    // Test database connection
    userCount = await prisma.user.count();
    dbStatus = 'connected';
  } catch (error: any) {
    dbStatus = `error: ${error.message}`;
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      userCount,
    },
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
    }
  });
}
