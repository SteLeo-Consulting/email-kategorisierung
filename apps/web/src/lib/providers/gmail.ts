// =============================================================================
// Gmail Provider Implementation
// =============================================================================

import { google, gmail_v1 } from 'googleapis';
import type { EmailMessage, LabelType } from '@email-cat/shared';
import {
  EmailProvider,
  ProviderCredentials,
  FetchOptions,
  FetchResult,
  LabelInfo,
  ApplyLabelResult,
} from './base';

export class GmailProvider extends EmailProvider {
  readonly providerName = 'GMAIL';
  private gmail: gmail_v1.Gmail;
  private credentials: ProviderCredentials;
  private oauth2Client: ReturnType<typeof google.auth.OAuth2.prototype>;

  constructor(credentials: ProviderCredentials) {
    super();
    this.credentials = credentials;

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiresAt?.getTime(),
    });

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async fetchMessages(options: FetchOptions): Promise<FetchResult> {
    try {
      // Build query
      let query = '';
      if (options.since) {
        const afterDate = Math.floor(options.since.getTime() / 1000);
        query = `after:${afterDate}`;
      }

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults: options.maxResults || 50,
        pageToken: options.pageToken,
        q: query,
      });

      const messages: EmailMessage[] = [];

      if (response.data.messages) {
        // Fetch full message details in parallel (batch of 10)
        const batchSize = 10;
        for (let i = 0; i < response.data.messages.length; i += batchSize) {
          const batch = response.data.messages.slice(i, i + batchSize);
          const details = await Promise.all(
            batch.map((msg) =>
              this.gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'metadata',
                metadataHeaders: ['From', 'To', 'Cc', 'Subject', 'Date'],
              })
            )
          );

          for (const detail of details) {
            const headers = detail.data.payload?.headers || [];
            const getHeader = (name: string) =>
              headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

            messages.push({
              id: detail.data.id!,
              threadId: detail.data.threadId || undefined,
              provider: 'GMAIL',
              from: getHeader('From'),
              to: getHeader('To').split(',').map((s) => s.trim()),
              cc: getHeader('Cc') ? getHeader('Cc').split(',').map((s) => s.trim()) : undefined,
              subject: getHeader('Subject'),
              snippet: detail.data.snippet || undefined,
              date: new Date(parseInt(detail.data.internalDate || '0')),
              labels: detail.data.labelIds || undefined,
              isRead: !detail.data.labelIds?.includes('UNREAD'),
              hasAttachments:
                detail.data.payload?.parts?.some((p) => p.filename && p.filename.length > 0) ||
                false,
            });
          }
        }
      }

      return {
        messages,
        nextPageToken: response.data.nextPageToken || undefined,
        hasMore: !!response.data.nextPageToken,
      };
    } catch (error) {
      console.error('Gmail fetchMessages error:', error);
      throw error;
    }
  }

  async getLabels(): Promise<LabelInfo[]> {
    try {
      const response = await this.gmail.users.labels.list({ userId: 'me' });

      return (response.data.labels || []).map((label) => ({
        id: label.id!,
        name: label.name!,
        type: 'LABEL' as LabelType,
      }));
    } catch (error) {
      console.error('Gmail getLabels error:', error);
      throw error;
    }
  }

  async createLabel(name: string): Promise<LabelInfo> {
    try {
      const response = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      return {
        id: response.data.id!,
        name: response.data.name!,
        type: 'LABEL',
      };
    } catch (error: any) {
      // If label already exists, try to find it
      if (error.code === 409) {
        const labels = await this.getLabels();
        const existing = labels.find((l) => l.name === name);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async applyLabel(messageId: string, labelId: string): Promise<ApplyLabelResult> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });

      return { success: true, labelId };
    } catch (error: any) {
      console.error('Gmail applyLabel error:', error);
      return { success: false, error: error.message };
    }
  }

  async removeLabel(messageId: string, labelId: string): Promise<ApplyLabelResult> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: [labelId],
        },
      });

      return { success: true, labelId };
    } catch (error: any) {
      console.error('Gmail removeLabel error:', error);
      return { success: false, error: error.message };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.gmail.users.getProfile({ userId: 'me' });
      return true;
    } catch {
      return false;
    }
  }

  async refreshTokenIfNeeded(): Promise<ProviderCredentials | null> {
    if (!this.credentials.expiresAt || !this.credentials.refreshToken) {
      return null;
    }

    // Refresh if expires in less than 5 minutes
    const bufferMs = 5 * 60 * 1000;
    if (this.credentials.expiresAt.getTime() - Date.now() > bufferMs) {
      return null;
    }

    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      this.oauth2Client.setCredentials(credentials);

      const newCredentials: ProviderCredentials = {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || this.credentials.refreshToken,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error) {
      console.error('Gmail token refresh error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Nothing to cleanup for Gmail API
  }

  /**
   * Get or create a label by name
   */
  async getOrCreateLabel(name: string): Promise<LabelInfo> {
    const labels = await this.getLabels();
    const existing = labels.find((l) => l.name === name);
    if (existing) return existing;

    return this.createLabel(name);
  }
}
