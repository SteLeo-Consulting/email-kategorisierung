// =============================================================================
// Single Connection API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/services/audit';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/connections/[id] - Get connection details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const connection = await prisma.connection.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
    include: {
      labelMappings: {
        include: {
          category: true,
        },
      },
      _count: {
        select: {
          processedMessages: true,
        },
      },
    },
  });

  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  return NextResponse.json({ connection });
}

/**
 * PATCH /api/connections/[id] - Update connection settings
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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
    const body = await request.json();
    const { displayName, settings, status } = body;

    const updated = await prisma.connection.update({
      where: { id: params.id },
      data: {
        ...(displayName && { displayName }),
        ...(settings && { settings }),
        ...(status && { status }),
      },
    });

    await createAuditLog({
      action: 'CONNECTION_UPDATED',
      userId: user.id,
      entityType: 'connection',
      entityId: params.id,
      details: { changes: body },
    });

    return NextResponse.json({ connection: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update connection', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections/[id] - Delete connection
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    // Delete connection (cascades to tokens, credentials, mappings, messages)
    await prisma.connection.delete({
      where: { id: params.id },
    });

    await createAuditLog({
      action: 'CONNECTION_DELETED',
      userId: user.id,
      entityType: 'connection',
      entityId: params.id,
      details: { provider: connection.provider, email: connection.email },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete connection', details: error.message },
      { status: 500 }
    );
  }
}
