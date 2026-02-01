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

    if (sortedUids.length > 0) {
      try {
        // ImapFlow fetch expects a string range or array - try string format
        const uidRangeStr = sortedUids.join(',');
        console.log('[DEBUG] Fetching UIDs as string:', uidRangeStr);

        // Also try fetching just one UID to see if it works
        const testUid = sortedUids[0];
        let singleFetchWorked = false;

        // Try single UID first
        try {
          for await (const msg of client.fetch(String(testUid), {
            uid: true,
            envelope: true,
            flags: true,
          })) {
            console.log('[DEBUG] Single fetch got message:', msg.uid);
            singleFetchWorked = true;
            messages.push({
              uid: msg.uid,
              subject: msg.envelope?.subject,
              from: msg.envelope?.from?.[0]?.address,
              date: msg.envelope?.date,
              flags: msg.flags ? Array.from(msg.flags) : [],
            });
          }
        } catch (singleErr: any) {
          console.log('[DEBUG] Single fetch failed:', singleErr.message);
        }

        // If single worked, try the rest
        if (singleFetchWorked && sortedUids.length > 1) {
          for (const uid of sortedUids.slice(1)) {
            try {
              for await (const msg of client.fetch(String(uid), {
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
            } catch {
              // Skip failed UIDs
            }
          }
        }
      } catch (fetchError: any) {
        console.error('[DEBUG] Fetch error:', fetchError);
        return NextResponse.json({
          error: 'Fetch failed',
          fetchError: fetchError.message,
          sortedUids,
          uidArray,
        }, { status: 500 });
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
      allUids: uidArray,
      sortedUids,
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
