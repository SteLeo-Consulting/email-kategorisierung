// =============================================================================
// Process Connection API Route (Manual Trigger)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { EmailProcessor } from '@/lib/services/email-processor';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute max for manual triggers

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/connections/[id]/process - Process emails for connection
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const connection = await prisma.connection.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
  });

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  try {
    // Parse options from body
    const body = await request.json().catch(() => ({}));
    const { maxEmails = 10, dryRun = false } = body;

    const processor = new EmailProcessor(params.id, { maxEmails, dryRun });
    const result = await processor.process();

    return NextResponse.json({
      success: true,
      result: {
        messagesProcessed: result.messagesProcessed,
        messagesLabeled: result.messagesLabeled,
        messagesReview: result.messagesReview,
        errors: result.errors.length,
        duration: result.duration,
      },
    });
  } catch (error: any) {
    // Provide detailed error messages
    let errorMessage = error.message || 'Unbekannter Fehler';
    let errorCode = 'PROCESSING_ERROR';

    if (error.message?.includes('IMAP') || error.message?.includes('connection')) {
      errorMessage = `IMAP-Verbindungsfehler: ${error.message}. Bitte prüfen Sie Ihre Zugangsdaten.`;
      errorCode = 'IMAP_CONNECTION_ERROR';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Zeitüberschreitung bei der Verarbeitung. Bitte versuchen Sie es mit weniger E-Mails.';
      errorCode = 'TIMEOUT_ERROR';
    } else if (error.message?.includes('not active')) {
      errorMessage = 'Die Verbindung ist nicht aktiv. Bitte prüfen Sie die Verbindungseinstellungen.';
      errorCode = 'CONNECTION_INACTIVE';
    } else if (error.message?.includes('decrypt')) {
      errorMessage = 'Fehler beim Entschlüsseln der Zugangsdaten. Bitte melden Sie sich erneut an.';
      errorCode = 'DECRYPT_ERROR';
    }

    console.error(`[Process Connection ${params.id}] Error:`, error);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        errorCode,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
