// =============================================================================
// IMAP Authentication API - Validates IMAP credentials and creates user session
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/shared';

export const runtime = 'nodejs';

// Common IMAP server configurations for auto-detection
const IMAP_SERVERS: Record<string, { host: string; port: number; secure: boolean }> = {
  // Google
  'gmail.com': { host: 'imap.gmail.com', port: 993, secure: true },
  'googlemail.com': { host: 'imap.gmail.com', port: 993, secure: true },

  // Microsoft
  'outlook.com': { host: 'outlook.office365.com', port: 993, secure: true },
  'outlook.de': { host: 'outlook.office365.com', port: 993, secure: true },
  'hotmail.com': { host: 'outlook.office365.com', port: 993, secure: true },
  'hotmail.de': { host: 'outlook.office365.com', port: 993, secure: true },
  'live.com': { host: 'outlook.office365.com', port: 993, secure: true },
  'live.de': { host: 'outlook.office365.com', port: 993, secure: true },
  'msn.com': { host: 'outlook.office365.com', port: 993, secure: true },

  // German providers
  'gmx.de': { host: 'imap.gmx.net', port: 993, secure: true },
  'gmx.net': { host: 'imap.gmx.net', port: 993, secure: true },
  'gmx.at': { host: 'imap.gmx.net', port: 993, secure: true },
  'gmx.ch': { host: 'imap.gmx.net', port: 993, secure: true },
  'web.de': { host: 'imap.web.de', port: 993, secure: true },
  'freenet.de': { host: 'mx.freenet.de', port: 993, secure: true },
  't-online.de': { host: 'secureimap.t-online.de', port: 993, secure: true },
  'magenta.de': { host: 'secureimap.t-online.de', port: 993, secure: true },

  // Hosting providers
  'strato.de': { host: 'imap.strato.de', port: 993, secure: true },
  '1und1.de': { host: 'imap.1und1.de', port: 993, secure: true },
  'ionos.de': { host: 'imap.ionos.de', port: 993, secure: true },
  'hosteurope.de': { host: 'imap.hosteurope.de', port: 993, secure: true },

  // International
  'yahoo.com': { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  'yahoo.de': { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  'icloud.com': { host: 'imap.mail.me.com', port: 993, secure: true },
  'me.com': { host: 'imap.mail.me.com', port: 993, secure: true },
  'aol.com': { host: 'imap.aol.com', port: 993, secure: true },
  'protonmail.com': { host: 'mail.protonmail.com', port: 993, secure: true },
  'proton.me': { host: 'mail.protonmail.com', port: 993, secure: true },
  'mail.de': { host: 'imap.mail.de', port: 993, secure: true },
  'posteo.de': { host: 'posteo.de', port: 993, secure: true },
  'mailbox.org': { host: 'imap.mailbox.org', port: 993, secure: true },
};

/**
 * Detect IMAP server settings from email domain
 */
function detectIMAPServer(email: string): { host: string; port: number; secure: boolean } | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  // Direct match
  if (IMAP_SERVERS[domain]) {
    return IMAP_SERVERS[domain];
  }

  // Try parent domain (e.g., subdomain.strato.de -> strato.de)
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join('.');
    if (IMAP_SERVERS[parentDomain]) {
      return IMAP_SERVERS[parentDomain];
    }
  }

  // Try generic imap.domain
  return {
    host: `imap.${domain}`,
    port: 993,
    secure: true,
  };
}

/**
 * Test IMAP connection with given credentials
 */
async function testIMAPConnection(
  host: string,
  port: number,
  secure: boolean,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const client = new ImapFlow({
    host,
    port,
    secure,
    auth: {
      user: username,
      pass: password,
    },
    logger: false,
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    await client.logout();
    return { success: true };
  } catch (error: any) {
    console.error('IMAP connection test failed:', error.message);
    return {
      success: false,
      error: error.message || 'Verbindung fehlgeschlagen'
    };
  }
}

/**
 * POST /api/auth/imap - Authenticate with IMAP credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, host, port, secure } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'E-Mail und Passwort sind erforderlich' },
        { status: 400 }
      );
    }

    // Detect or use provided IMAP settings
    let imapHost = host;
    let imapPort = port || 993;
    let imapSecure = secure !== undefined ? secure : true;

    if (!imapHost) {
      const detected = detectIMAPServer(email);
      if (detected) {
        imapHost = detected.host;
        imapPort = detected.port;
        imapSecure = detected.secure;
      } else {
        return NextResponse.json(
          { error: 'IMAP-Server konnte nicht erkannt werden. Bitte manuell angeben.' },
          { status: 400 }
        );
      }
    }

    // Test IMAP connection
    const testResult = await testIMAPConnection(imapHost, imapPort, imapSecure, email, password);

    if (!testResult.success) {
      // Provide helpful error messages
      let errorMessage = 'Anmeldung fehlgeschlagen. ';

      if (testResult.error?.includes('AUTHENTICATIONFAILED') || testResult.error?.includes('Invalid credentials')) {
        errorMessage += 'Falsches Passwort oder E-Mail-Adresse. ';
        if (email.includes('gmail.com') || email.includes('googlemail.com')) {
          errorMessage += 'Für Gmail benötigst du ein App-Passwort: https://myaccount.google.com/apppasswords';
        } else if (email.includes('outlook') || email.includes('hotmail') || email.includes('live')) {
          errorMessage += 'Für Outlook/Hotmail benötigst du ein App-Passwort.';
        }
      } else if (testResult.error?.includes('ENOTFOUND') || testResult.error?.includes('getaddrinfo')) {
        errorMessage += `Server "${imapHost}" nicht gefunden. Bitte IMAP-Server prüfen.`;
      } else if (testResult.error?.includes('ETIMEDOUT') || testResult.error?.includes('timeout')) {
        errorMessage += 'Verbindung zum Server fehlgeschlagen (Timeout).';
      } else {
        errorMessage += testResult.error || 'Unbekannter Fehler.';
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 401 }
      );
    }

    // Create or update user in database
    const dbUser = await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {
        name: email.split('@')[0],
      },
      create: {
        email: email.toLowerCase(),
        name: email.split('@')[0],
      },
    });

    // Create or update IMAP connection
    const connection = await prisma.connection.upsert({
      where: {
        userId_provider_email: {
          userId: dbUser.id,
          provider: 'IMAP',
          email: email.toLowerCase(),
        },
      },
      update: {
        status: 'ACTIVE',
        lastError: null,
        displayName: `${email.split('@')[0]} (${imapHost})`,
      },
      create: {
        userId: dbUser.id,
        provider: 'IMAP',
        email: email.toLowerCase(),
        displayName: `${email.split('@')[0]} (${imapHost})`,
        status: 'ACTIVE',
        settings: {
          useFolders: true,
          folderPrefix: 'EmailCat',
        },
      },
    });

    // Store encrypted IMAP credentials
    await prisma.iMAPCredential.upsert({
      where: { connectionId: connection.id },
      update: {
        host: imapHost,
        port: imapPort,
        secure: imapSecure,
        username: email,
        password: encrypt(password),
      },
      create: {
        connectionId: connection.id,
        host: imapHost,
        port: imapPort,
        secure: imapSecure,
        username: email,
        password: encrypt(password),
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'CONNECTION_CREATED',
        entityType: 'connection',
        entityId: connection.id,
        details: { provider: 'IMAP', host: imapHost, email },
      },
    });

    // Return user data for client-side session handling
    return NextResponse.json({
      success: true,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
      },
      connection: {
        id: connection.id,
        provider: 'IMAP',
        email: connection.email,
        host: imapHost,
      },
      imapSettings: {
        host: imapHost,
        port: imapPort,
        secure: imapSecure,
      },
    });
  } catch (error: any) {
    console.error('IMAP auth error:', error);
    return NextResponse.json(
      { error: 'Ein Fehler ist aufgetreten: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/imap/detect - Detect IMAP settings for an email
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');

  if (!email) {
    return NextResponse.json(
      { error: 'E-Mail ist erforderlich' },
      { status: 400 }
    );
  }

  const settings = detectIMAPServer(email);

  if (settings) {
    return NextResponse.json({
      detected: true,
      ...settings,
    });
  }

  return NextResponse.json({
    detected: false,
    host: '',
    port: 993,
    secure: true,
  });
}
