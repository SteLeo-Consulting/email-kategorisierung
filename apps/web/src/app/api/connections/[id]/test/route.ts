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
    // Update connection status
    await prisma.connection.update({
      where: { id: params.id },
      data: {
        status: 'ERROR',
        lastError: error.message,
      },
    });

    return NextResponse.json(
      {
        success: false,
        message: 'Connection test failed',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
