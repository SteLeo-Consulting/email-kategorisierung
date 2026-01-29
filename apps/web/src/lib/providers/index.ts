// =============================================================================
// Provider Factory and Exports
// =============================================================================

import { Provider, decrypt } from '@/lib/shared';
import { prisma } from '../prisma';
import { EmailProvider, ProviderCredentials, IMAPCredentials } from './base';
import { GmailProvider } from './gmail';
import { OutlookProvider } from './outlook';
import { IMAPProvider } from './imap';

export * from './base';
export { GmailProvider } from './gmail';
export { OutlookProvider } from './outlook';
export { IMAPProvider } from './imap';

/**
 * Create a provider instance for a connection
 */
export async function createProviderFromConnection(
  connectionId: string
): Promise<EmailProvider> {
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: {
      oauthToken: true,
      imapCredential: true,
    },
  });

  if (!connection) {
    throw new Error(`Connection not found: ${connectionId}`);
  }

  switch (connection.provider) {
    case 'GMAIL': {
      if (!connection.oauthToken) {
        throw new Error('No OAuth token for Gmail connection');
      }
      const credentials: ProviderCredentials = {
        accessToken: decrypt(connection.oauthToken.accessToken),
        refreshToken: connection.oauthToken.refreshToken
          ? decrypt(connection.oauthToken.refreshToken)
          : undefined,
        expiresAt: connection.oauthToken.expiresAt || undefined,
      };
      return new GmailProvider(credentials);
    }

    case 'OUTLOOK': {
      if (!connection.oauthToken) {
        throw new Error('No OAuth token for Outlook connection');
      }
      const credentials: ProviderCredentials = {
        accessToken: decrypt(connection.oauthToken.accessToken),
        refreshToken: connection.oauthToken.refreshToken
          ? decrypt(connection.oauthToken.refreshToken)
          : undefined,
        expiresAt: connection.oauthToken.expiresAt || undefined,
      };
      const useFolders = (connection.settings as any)?.useFolders === true;
      return new OutlookProvider(credentials, useFolders);
    }

    case 'IMAP': {
      if (!connection.imapCredential) {
        throw new Error('No IMAP credentials for IMAP connection');
      }
      const credentials: IMAPCredentials = {
        host: connection.imapCredential.host,
        port: connection.imapCredential.port,
        secure: connection.imapCredential.secure,
        username: connection.imapCredential.username,
        password: decrypt(connection.imapCredential.password),
      };
      const useFolders = (connection.settings as any)?.useFolders !== false;
      const folderPrefix = (connection.settings as any)?.folderPrefix || 'EmailCat';
      return new IMAPProvider(credentials, useFolders, folderPrefix);
    }

    default:
      throw new Error(`Unknown provider: ${connection.provider}`);
  }
}

/**
 * Update tokens after refresh
 */
export async function updateConnectionTokens(
  connectionId: string,
  newCredentials: ProviderCredentials
): Promise<void> {
  const { encrypt } = await import('@/lib/shared');

  await prisma.oAuthToken.update({
    where: { connectionId },
    data: {
      accessToken: encrypt(newCredentials.accessToken),
      refreshToken: newCredentials.refreshToken
        ? encrypt(newCredentials.refreshToken)
        : undefined,
      expiresAt: newCredentials.expiresAt,
    },
  });
}

/**
 * Mark connection as having an error
 */
export async function markConnectionError(
  connectionId: string,
  error: string
): Promise<void> {
  await prisma.connection.update({
    where: { id: connectionId },
    data: {
      status: 'ERROR',
      lastError: error,
    },
  });
}

/**
 * Mark connection as needing reauthorization
 */
export async function markConnectionNeedsReauth(connectionId: string): Promise<void> {
  await prisma.connection.update({
    where: { id: connectionId },
    data: {
      status: 'NEEDS_REAUTH',
      lastError: 'Token refresh failed - reauthorization required',
    },
  });
}
