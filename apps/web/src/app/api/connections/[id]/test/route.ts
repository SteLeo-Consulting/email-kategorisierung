// =============================================================================
// Test Connection API Route
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createProviderFromConnection } from '@/lib/providers';

export const runtime = 'nodejs';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/connections/[id]/test - Test connection
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
