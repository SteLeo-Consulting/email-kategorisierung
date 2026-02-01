// =============================================================================
// Health Check API - Simple endpoint to verify the API is running
// =============================================================================

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      hasEncryptionKey: !!process.env.ENCRYPTION_KEY,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
    }
  });
}
