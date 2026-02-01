// =============================================================================
// Debug Connection API Route - For testing IMAP directly
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/shared/crypto';
import { ImapFlow } from 'imapflow';

export const runtime = 'nodejs';
export const maxDuration = 30;

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/connections/[id]/debug - Debug IMAP connection
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const userEmail = request.nextUrl.searchParams.get('email');
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase() },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const connection = await prisma.connection.findFirst({
    where: { id: params.id, userId: user.id },
    include: { imapCredential: true },
  });

  if (!connection || !connection.imapCredential) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const creds = connection.imapCredential;

  try {
    // Decrypt password
    const password = decrypt(creds.password);

    // Connect to IMAP
    const client = new ImapFlow({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      auth: {
        user: creds.username,
        pass: password,
      },
      logger: false,
    });

    await client.connect();
    await client.mailboxOpen('INBOX');

    // Search ALL messages
    const allUids = await client.search({ all: true }, { uid: true });

    // Search UNSEEN messages
    const unseenUids = await client.search({ unseen: true }, { uid: true });

    // Get mailbox status
    const mailboxStatus = await client.status('INBOX', { messages: true, unseen: true });

    // Fetch details of first 10 messages
    const messages: any[] = [];
    const uidArray = allUids || [];
    const sortedUids = [...uidArray].sort((a, b) => b - a).slice(0, 10);

    if (sortedUids.length > 0) {
      for await (const msg of client.fetch(sortedUids, {
        uid: true,
        envelope: true,
        flags: true,
      })) {
        messages.push({
          uid: msg.uid,
          subject: msg.envelope?.subject,
          from: msg.envelope?.from?.[0]?.address,
          date: msg.envelope?.date,
          flags: msg.flags ? Array.from(msg.flags) : [],
        });
      }
    }

    await client.logout();

    return NextResponse.json({
      connection: {
        id: connection.id,
        lastSyncAt: connection.lastSyncAt,
        status: connection.status,
      },
      imap: {
        host: creds.host,
        port: creds.port,
      },
      mailboxStatus,
      totalUids: uidArray.length,
      unseenUids: unseenUids?.length || 0,
      sampleMessages: messages,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
