// =============================================================================
// IMAP Provider Implementation (Strato and other IMAP servers)
// =============================================================================

import { ImapFlow, MailboxObject, FetchMessageObject } from 'imapflow';
import type { EmailMessage, LabelType } from '@/lib/shared';
import {
  EmailProvider,
  IMAPCredentials,
  FetchOptions,
  FetchResult,
  LabelInfo,
  ApplyLabelResult,
} from './base';

export class IMAPProvider extends EmailProvider {
  readonly providerName = 'IMAP';
  private credentials: IMAPCredentials;
  private client: ImapFlow | null = null;
  private useFolders: boolean;
  private folderPrefix: string;

  constructor(credentials: IMAPCredentials, useFolders = true, folderPrefix = '') {
    super();
    this.credentials = credentials;
    this.useFolders = useFolders;
    // No prefix by default - categories are created directly at IMAP root level
    // This ensures EmailCat doesn't create its own namespace
    this.folderPrefix = folderPrefix;
  }

  private async getClient(): Promise<ImapFlow> {
    if (this.client && this.client.usable) {
      return this.client;
    }

    this.client = new ImapFlow({
      host: this.credentials.host,
      port: this.credentials.port,
      secure: this.credentials.secure,
      auth: {
        user: this.credentials.username,
        pass: this.credentials.password,
      },
      logger: false,
    });

    await this.client.connect();
    return this.client;
  }

  async fetchMessages(options: FetchOptions): Promise<FetchResult> {
    try {
      const client = await this.getClient();
      const messages: EmailMessage[] = [];

      // Open INBOX
      await client.mailboxOpen('INBOX');

      // Build search criteria
      const searchCriteria: any = {};
      if (options.since) {
        searchCriteria.since = options.since;
      }

      // Get mailbox status to know total count
      const mailboxStatus = await client.status('INBOX', { messages: true });
      const totalMessages = mailboxStatus.messages || 0;

      // Calculate sequence range for newest messages
      const maxResults = options.maxResults || 50;
      const startSeq = Math.max(1, totalMessages - maxResults + 1);
      const range = `${startSeq}:*`;

      console.log(`[IMAP] Mailbox has ${totalMessages} messages, fetching range ${range} (max: ${maxResults})`);

      // Fetch messages with UIDs - we need UIDs for proper message identification
      // and for applying labels later
      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        uid: true, // Request UID
      }, { uid: false })) {
        const envelope = msg.envelope;
        if (!envelope) continue;

        // Check date filter if since is specified
        const msgDate = envelope.date ? new Date(envelope.date) : new Date();
        if (options.since && msgDate < options.since) {
          continue; // Skip messages older than since date
        }

        // Use UID as the message ID (required for label operations)
        const messageId = msg.uid?.toString() || '';
        if (!messageId) {
          console.warn(`[IMAP] Message without UID, seq=${msg.seq}, skipping`);
          continue;
        }

        messages.push({
          id: messageId,
          threadId: envelope.messageId || undefined,
          provider: 'IMAP',
          from: envelope.from?.[0]
            ? `${envelope.from[0].name || ''} <${envelope.from[0].address || ''}>`
            : '',
          to: envelope.to?.map((a) => a.address || '') || [],
          cc: envelope.cc?.map((a) => a.address || ''),
          subject: envelope.subject || '',
          snippet: undefined, // IMAP doesn't provide snippets without fetching body
          date: msgDate,
          labels: msg.flags ? Array.from(msg.flags) : undefined,
          isRead: msg.flags?.has('\\Seen'),
          hasAttachments: this.hasAttachments(msg.bodyStructure),
        });
      }

      // Sort by date descending (newest first) and limit
      messages.sort((a, b) => b.date.getTime() - a.date.getTime());
      const limitedMessages = messages.slice(0, maxResults);

      console.log(`[IMAP] Fetched ${messages.length} messages, returning ${limitedMessages.length}`);

      return {
        messages: limitedMessages,
        nextPageToken: messages.length > maxResults ? String(maxResults) : undefined,
        hasMore: messages.length > maxResults,
      };
    } catch (error) {
      console.error('IMAP fetchMessages error:', error);
      throw error;
    }
  }

  private hasAttachments(bodyStructure: any): boolean {
    if (!bodyStructure) return false;
    if (bodyStructure.disposition === 'attachment') return true;
    if (bodyStructure.childNodes) {
      return bodyStructure.childNodes.some((child: any) => this.hasAttachments(child));
    }
    return false;
  }

  async getLabels(): Promise<LabelInfo[]> {
    try {
      const client = await this.getClient();
      const labels: LabelInfo[] = [];

      // List all mailboxes (folders)
      const mailboxes = await client.list();
      for (const mailbox of mailboxes) {
        labels.push({
          id: mailbox.path,
          name: mailbox.name,
          type: this.useFolders ? 'FOLDER' : 'FLAG',
        });
      }

      return labels;
    } catch (error) {
      console.error('IMAP getLabels error:', error);
      throw error;
    }
  }

  async createLabel(name: string): Promise<LabelInfo> {
    try {
      const client = await this.getClient();
      // Create folder directly with the given name - no prefix
      // EmailCat does NOT create its own namespace
      const folderPath = name;

      console.log(`[IMAP] createLabel: creating folder "${folderPath}"`);

      // Create the folder
      await client.mailboxCreate(folderPath);

      console.log(`[IMAP] createLabel: folder "${folderPath}" created successfully`);

      return {
        id: folderPath,
        name: name,
        type: 'FOLDER',
      };
    } catch (error: any) {
      // If folder already exists, return it
      if (error.code === 'ALREADYEXISTS' || error.message?.includes('already exists')) {
        console.log(`[IMAP] createLabel: folder "${name}" already exists`);
        return {
          id: name,
          name: name,
          type: 'FOLDER',
        };
      }
      console.error(`[IMAP] createLabel error:`, error.message);
      throw error;
    }
  }

  async applyLabel(messageId: string, labelId: string): Promise<ApplyLabelResult> {
    try {
      const client = await this.getClient();
      const uid = parseInt(messageId);

      console.log(`[IMAP] Applying label "${labelId}" to message UID ${uid}`);

      // Open INBOX
      await client.mailboxOpen('INBOX');

      if (this.useFolders) {
        // First ensure the target folder exists
        try {
          const mailboxes = await client.list();
          const folderExists = mailboxes.some((mb) => mb.path === labelId);

          if (!folderExists) {
            console.log(`[IMAP] Folder "${labelId}" does not exist, creating it...`);
            await client.mailboxCreate(labelId);
            console.log(`[IMAP] Folder "${labelId}" created successfully`);
          }
        } catch (createError: any) {
          // Folder might already exist (race condition)
          if (!createError.message?.includes('already exists') && createError.code !== 'ALREADYEXISTS') {
            console.error(`[IMAP] Error creating folder "${labelId}":`, createError.message);
            throw createError;
          }
        }

        // Re-open INBOX (mailbox may have been changed by create)
        await client.mailboxOpen('INBOX');

        // MOVE message to the target folder (not copy)
        console.log(`[IMAP] Moving message UID ${uid} to folder "${labelId}"`);
        await client.messageMove([uid], labelId, { uid: true });
        console.log(`[IMAP] Message moved successfully to "${labelId}"`);
      } else {
        // Set a custom flag/keyword
        await client.messageFlagsAdd([uid], [labelId], { uid: true });
        console.log(`[IMAP] Flag "${labelId}" added to message UID ${uid}`);
      }

      return { success: true, labelId };
    } catch (error: any) {
      console.error(`[IMAP] applyLabel error for message ${messageId} -> "${labelId}":`, error.message);
      return { success: false, error: error.message };
    }
  }

  async removeLabel(messageId: string, labelId: string): Promise<ApplyLabelResult> {
    try {
      const client = await this.getClient();
      const uid = parseInt(messageId);

      if (this.useFolders) {
        // Open the folder and delete the copy
        try {
          await client.mailboxOpen(labelId);
          // Find the message in this folder (by message-id header would be better)
          // For now, we can't reliably remove from a folder without more context
          // This is a limitation of the folder-based approach
        } catch {
          // Folder might not exist
        }
      } else {
        // Remove the flag
        await client.mailboxOpen('INBOX');
        await client.messageFlagsRemove([uid], [labelId], { uid: true });
      }

      return { success: true, labelId };
    } catch (error: any) {
      console.error('IMAP removeLabel error:', error);
      return { success: false, error: error.message };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const client = await this.getClient();
      await client.mailboxOpen('INBOX');
      return true;
    } catch {
      return false;
    }
  }

  async refreshTokenIfNeeded(): Promise<null> {
    // IMAP doesn't use OAuth tokens
    return null;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        // Ignore logout errors
      }
      this.client = null;
    }
  }

  /**
   * Get or create a folder by name
   * Name should be the category name directly (e.g., "Rechnung")
   * EmailCat does NOT create its own namespace - categories are created directly at IMAP root level
   */
  async getOrCreateLabel(name: string): Promise<LabelInfo> {
    const labels = await this.getLabels();

    // The name provided is the direct folder name (e.g., "Rechnung")
    // We use it as-is since EmailCat should NOT create its own namespace
    const folderPath = name;

    console.log(`[IMAP] getOrCreateLabel: looking for folder "${folderPath}"`);

    // Check for existing folder
    const existing = labels.find((l) => l.id === folderPath || l.name === name);
    if (existing) {
      console.log(`[IMAP] Found existing folder: ${existing.id}`);
      return existing;
    }

    // Create the folder directly with the given name
    console.log(`[IMAP] Creating new folder: "${folderPath}"`);
    return this.createLabel(name);
  }

  /**
   * Fetch message body/snippet (for classification)
   */
  async fetchMessageBody(messageId: string, maxLength = 500): Promise<string> {
    try {
      const client = await this.getClient();
      const uid = parseInt(messageId);

      await client.mailboxOpen('INBOX');

      let bodyText = '';
      for await (const msg of client.fetch([uid], {
        uid: true,
        bodyParts: ['TEXT'],
      })) {
        if (msg.bodyParts) {
          for (const [, part] of msg.bodyParts) {
            bodyText += part.toString('utf-8');
          }
        }
      }

      // Truncate to maxLength
      return bodyText.slice(0, maxLength);
    } catch (error) {
      console.error('IMAP fetchMessageBody error:', error);
      return '';
    }
  }
}
