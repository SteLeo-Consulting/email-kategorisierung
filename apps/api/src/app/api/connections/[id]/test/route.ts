// =============================================================================
// Test Connection API Route
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createProviderFromConnection } from '@/lib/providers';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/connections/[id]/test - Test connection
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
    const provider = await createProviderFromConnection(params.id);
    const isValid = await provider.testConnection();
    await provider.disconnect();

    if (isValid) {
      // Update connection status
      await prisma.connection.update({
        where: { id: params.id },
        data: {
          status: 'ACTIVE',
          lastError: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Connection test successful',
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Connection test failed',
      });
    }
  } catch (error: any) {
    // Provide detailed error messages
    let errorMessage = error.message || 'Unbekannter Fehler';
    let userFriendlyMessage = 'Verbindungstest fehlgeschlagen';

    if (error.message?.includes('AUTH') || error.message?.includes('Login') || error.message?.includes('credentials')) {
      userFriendlyMessage = 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Benutzername und Passwort.';
    } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
      userFriendlyMessage = 'Server nicht erreichbar. Bitte prüfen Sie den IMAP-Server-Namen.';
    } else if (error.message?.includes('ECONNREFUSED')) {
      userFriendlyMessage = 'Verbindung abgelehnt. Bitte prüfen Sie Port und SSL-Einstellungen.';
    } else if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      userFriendlyMessage = 'Zeitüberschreitung. Der Server antwortet nicht rechtzeitig.';
    } else if (error.message?.includes('certificate') || error.message?.includes('SSL')) {
      userFriendlyMessage = 'SSL/TLS-Fehler. Bitte prüfen Sie die Sicherheitseinstellungen.';
    } else if (error.message?.includes('decrypt')) {
      userFriendlyMessage = 'Fehler beim Entschlüsseln der Zugangsdaten. Bitte melden Sie sich erneut an.';
    }

    // Update connection status
    await prisma.connection.update({
      where: { id: params.id },
      data: {
        status: 'ERROR',
        lastError: userFriendlyMessage,
      },
    });

    console.error(`[Test Connection ${params.id}] Error:`, error);

    return NextResponse.json(
      {
        success: false,
        message: userFriendlyMessage,
        error: errorMessage,
        errorCode: 'CONNECTION_TEST_FAILED',
      },
      { status: 500 }
    );
  }
}
