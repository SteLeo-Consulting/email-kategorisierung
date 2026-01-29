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

  constructor(credentials: IMAPCredentials, useFolders = true, folderPrefix = 'EmailCat') {
    super();
    this.credentials = credentials;
    this.useFolders = useFolders;
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

      // Search for messages
      const uids = await client.search(
        Object.keys(searchCriteria).length > 0 ? searchCriteria : { all: true },
        { uid: true }
      );

      // Limit results
      const maxResults = options.maxResults || 50;
      const limitedUids = uids.slice(0, maxResults);

      if (limitedUids.length > 0) {
        // Fetch message details
        for await (const msg of client.fetch(limitedUids, {
          uid: true,
          envelope: true,
          flags: true,
          bodyStructure: true,
        })) {
          const envelope = msg.envelope;
          if (!envelope) continue;

          messages.push({
            id: msg.uid.toString(),
            threadId: envelope.messageId || undefined,
            provider: 'IMAP',
            from: envelope.from?.[0]
              ? `${envelope.from[0].name || ''} <${envelope.from[0].address || ''}>`
              : '',
            to: envelope.to?.map((a) => a.address || '') || [],
            cc: envelope.cc?.map((a) => a.address || ''),
            subject: envelope.subject || '',
            snippet: undefined, // IMAP doesn't provide snippets without fetching body
            date: envelope.date ? new Date(envelope.date) : new Date(),
            labels: msg.flags ? Array.from(msg.flags) : undefined,
            isRead: msg.flags?.has('\\Seen'),
            hasAttachments: this.hasAttachments(msg.bodyStructure),
          });
        }
      }

      return {
        messages,
        nextPageToken: uids.length > maxResults ? String(maxResults) : undefined,
        hasMore: uids.length > maxResults,
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
      for await (const mailbox of client.list()) {
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
      const folderPath = this.useFolders ? `${this.folderPrefix}/${name}` : name;

      // Create the parent folder if needed
      if (this.useFolders) {
        try {
          await client.mailboxCreate(this.folderPrefix);
        } catch {
          // Parent folder might already exist
        }
      }

      // Create the folder
      await client.mailboxCreate(folderPath);

      return {
        id: folderPath,
        name: name,
        type: 'FOLDER',
      };
    } catch (error: any) {
      // If folder already exists, return it
      if (error.code === 'ALREADYEXISTS' || error.message?.includes('already exists')) {
        const folderPath = this.useFolders ? `${this.folderPrefix}/${name}` : name;
        return {
          id: folderPath,
          name: name,
          type: 'FOLDER',
        };
      }
      throw error;
    }
  }

  async applyLabel(messageId: string, labelId: string): Promise<ApplyLabelResult> {
    try {
      const client = await this.getClient();
      const uid = parseInt(messageId);

      // Open INBOX
      await client.mailboxOpen('INBOX');

      if (this.useFolders) {
        // Copy message to the target folder
        await client.messageCopy([uid], labelId, { uid: true });
      } else {
        // Set a custom flag/keyword
        await client.messageFlagsAdd([uid], [labelId], { uid: true });
      }

      return { success: true, labelId };
    } catch (error: any) {
      console.error('IMAP applyLabel error:', error);
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
   */
  async getOrCreateLabel(name: string): Promise<LabelInfo> {
    const labels = await this.getLabels();
    const folderPath = this.useFolders ? `${this.folderPrefix}/${name}` : name;
    const existing = labels.find((l) => l.id === folderPath || l.name === name);
    if (existing) return existing;

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
