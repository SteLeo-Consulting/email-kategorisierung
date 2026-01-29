// =============================================================================
// Cron Job: Process Emails
// Runs every 5 minutes via Vercel Cron
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { processAllConnections } from '@/lib/services/email-processor';
import { logCronRun } from '@/lib/services/audit';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * Verify the cron request is from Vercel
 */
function verifyCronRequest(request: NextRequest): boolean {
  // In production, verify the cron secret
  if (process.env.NODE_ENV === 'production') {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.warn('CRON_SECRET not configured');
      return false;
    }

    return authHeader === `Bearer ${cronSecret}`;
  }

  // In development, allow all requests
  return true;
}

export async function GET(request: NextRequest) {
  // Verify the request
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // Log cron start
    await logCronRun('started', {
      timestamp: new Date().toISOString(),
    });

    // Process all active connections
    const results = await processAllConnections();

    // Calculate totals
    const totals = results.reduce(
      (acc, r) => ({
        processed: acc.processed + r.messagesProcessed,
        labeled: acc.labeled + r.messagesLabeled,
        review: acc.review + r.messagesReview,
        errors: acc.errors + r.errors.length,
      }),
      { processed: 0, labeled: 0, review: 0, errors: 0 }
    );

    const duration = Date.now() - startTime;

    // Log cron completion
    await logCronRun('completed', {
      duration,
      connections: results.length,
      ...totals,
    });

    return NextResponse.json({
      success: true,
      duration,
      connections: results.length,
      totals,
      results: results.map((r) => ({
        connectionId: r.connectionId,
        processed: r.messagesProcessed,
        labeled: r.messagesLabeled,
        review: r.messagesReview,
        errors: r.errors.length,
      })),
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    // Log cron failure
    await logCronRun('failed', {
      duration,
      error: error.message,
    });

    console.error('Cron job failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        duration,
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
