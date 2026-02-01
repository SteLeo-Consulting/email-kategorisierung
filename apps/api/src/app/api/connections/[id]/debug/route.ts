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

    // Debug: log the UIDs
    console.log('[DEBUG] All UIDs:', uidArray);
    console.log('[DEBUG] Sorted UIDs to fetch:', sortedUids);

    // Fetch using sequence numbers instead of UIDs
    let fetchMethod = 'unknown';
    const errors: string[] = [];

    if (sortedUids.length > 0) {
      // Method 1: Try using fetch with UID range as string "uid1:uid2"
      try {
        fetchMethod = 'uidRange';
        const range = `${sortedUids[sortedUids.length - 1]}:${sortedUids[0]}`;
        for await (const msg of client.fetch(range, { uid: true, envelope: true, flags: true })) {
          messages.push({
            uid: msg.uid,
            seq: msg.seq,
            subject: msg.envelope?.subject,
            from: msg.envelope?.from?.[0]?.address,
            date: msg.envelope?.date,
            flags: msg.flags ? Array.from(msg.flags) : [],
          });
        }
      } catch (e: any) {
        errors.push(`Method 1 (uidRange): ${e.message}`);
      }

      // Method 2: If Method 1 failed, try with sequence numbers (1:* means all)
      if (messages.length === 0) {
        try {
          fetchMethod = 'sequenceAll';
          // Fetch last 10 messages by sequence number
          const totalMessages = mailboxStatus.messages || 0;
          const startSeq = Math.max(1, totalMessages - 9);
          const range = `${startSeq}:*`;

          for await (const msg of client.fetch(range, { envelope: true, flags: true }, { uid: false })) {
            messages.push({
              uid: msg.uid,
              seq: msg.seq,
              subject: msg.envelope?.subject,
              from: msg.envelope?.from?.[0]?.address,
              date: msg.envelope?.date,
              flags: msg.flags ? Array.from(msg.flags) : [],
            });
          }
        } catch (e: any) {
          errors.push(`Method 2 (sequenceAll): ${e.message}`);
        }
      }

      // Method 3: Use fetchOne for a single message
      if (messages.length === 0) {
        try {
          fetchMethod = 'fetchOne';
          const oneMsg = await client.fetchOne('*', { envelope: true, flags: true });
          if (oneMsg) {
            messages.push({
              uid: oneMsg.uid,
              seq: oneMsg.seq,
              subject: oneMsg.envelope?.subject,
              from: oneMsg.envelope?.from?.[0]?.address,
              date: oneMsg.envelope?.date,
              flags: oneMsg.flags ? Array.from(oneMsg.flags) : [],
            });
          }
        } catch (e: any) {
          errors.push(`Method 3 (fetchOne): ${e.message}`);
        }
      }
    }

    // List ALL folders
    const allFolders = await client.list();
    const folderList = allFolders.map((f: any) => ({
      path: f.path,
      name: f.name,
      flags: f.flags,
      specialUse: f.specialUse,
    }));

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
      allUids: uidArray,
      sortedUids,
      unseenUids: unseenUids?.length || 0,
      fetchMethod,
      fetchErrors: errors,
      sampleMessages: messages,
      allFolders: folderList,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
