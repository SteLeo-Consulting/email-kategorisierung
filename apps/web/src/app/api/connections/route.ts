// =============================================================================
// Connections API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CreateIMAPCredentialSchema, encrypt } from '@/lib/shared';
import { createAuditLog } from '@/lib/services/audit';

export const runtime = 'nodejs';

/**
 * GET /api/connections - List user's connections
 */
export async function GET() {
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

  const connections = await prisma.connection.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      provider: true,
      email: true,
      displayName: true,
      status: true,
      lastSyncAt: true,
      lastError: true,
      settings: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          processedMessages: true,
          labelMappings: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ connections });
}

/**
 * POST /api/connections - Create IMAP connection
 * OAuth connections are created via the auth callback
 */
export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();

    // Validate IMAP credentials
    const parsed = CreateIMAPCredentialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { host, port, secure, username, password } = parsed.data;

    // Create connection
    const connection = await prisma.connection.create({
      data: {
        userId: user.id,
        provider: 'IMAP',
        email: username,
        displayName: `IMAP: ${host}`,
        status: 'ACTIVE',
        settings: {
          useFolders: true,
          folderPrefix: 'EmailCat',
        },
      },
    });

    // Store encrypted credentials
    await prisma.iMAPCredential.create({
      data: {
        connectionId: connection.id,
        host,
        port,
        secure,
        username,
        password: encrypt(password),
      },
    });

    // Log the action
    await createAuditLog({
      action: 'CONNECTION_CREATED',
      userId: user.id,
      entityType: 'connection',
      entityId: connection.id,
      details: { provider: 'IMAP', host },
    });

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        email: connection.email,
        status: connection.status,
      },
    });
  } catch (error: any) {
    console.error('Error creating connection:', error);
    return NextResponse.json(
      { error: 'Failed to create connection', details: error.message },
      { status: 500 }
    );
  }
}
