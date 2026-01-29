// =============================================================================
// Outlook/Microsoft Graph Provider Implementation
// =============================================================================

import type { EmailMessage, LabelType } from '@/lib/shared';
import {
  EmailProvider,
  ProviderCredentials,
  FetchOptions,
  FetchResult,
  LabelInfo,
  ApplyLabelResult,
} from './base';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

interface GraphMessage {
  id: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  from: { emailAddress: { address: string; name: string } };
  toRecipients: Array<{ emailAddress: { address: string; name: string } }>;
  ccRecipients: Array<{ emailAddress: { address: string; name: string } }>;
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
  categories: string[];
}

interface GraphCategory {
  id: string;
  displayName: string;
  color: string;
}

interface GraphFolder {
  id: string;
  displayName: string;
  parentFolderId: string;
}

export class OutlookProvider extends EmailProvider {
  readonly providerName = 'OUTLOOK';
  private credentials: ProviderCredentials;
  private useFolders: boolean;

  constructor(credentials: ProviderCredentials, useFolders = false) {
    super();
    this.credentials = credentials;
    this.useFolders = useFolders;
  }

  private async graphRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${GRAPH_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.credentials.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Graph API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  async fetchMessages(options: FetchOptions): Promise<FetchResult> {
    try {
      let filter = '';
      if (options.since) {
        filter = `receivedDateTime ge ${options.since.toISOString()}`;
      }

      const queryParams = new URLSearchParams();
      queryParams.set('$top', String(options.maxResults || 50));
      queryParams.set('$select', 'id,conversationId,subject,bodyPreview,from,toRecipients,ccRecipients,receivedDateTime,isRead,hasAttachments,categories');
      queryParams.set('$orderby', 'receivedDateTime desc');
      if (filter) {
        queryParams.set('$filter', filter);
      }
      if (options.pageToken) {
        queryParams.set('$skiptoken', options.pageToken);
      }

      const response = await this.graphRequest<{
        value: GraphMessage[];
        '@odata.nextLink'?: string;
      }>(`/me/messages?${queryParams.toString()}`);

      const messages: EmailMessage[] = response.value.map((msg) => ({
        id: msg.id,
        threadId: msg.conversationId,
        provider: 'OUTLOOK' as const,
        from: msg.from?.emailAddress
          ? `${msg.from.emailAddress.name} <${msg.from.emailAddress.address}>`
          : '',
        to: msg.toRecipients?.map((r) => r.emailAddress.address) || [],
        cc: msg.ccRecipients?.map((r) => r.emailAddress.address),
        subject: msg.subject || '',
        snippet: msg.bodyPreview || undefined,
        date: new Date(msg.receivedDateTime),
        labels: msg.categories || undefined,
        isRead: msg.isRead,
        hasAttachments: msg.hasAttachments,
      }));

      // Extract next page token from nextLink
      let nextPageToken: string | undefined;
      if (response['@odata.nextLink']) {
        const url = new URL(response['@odata.nextLink']);
        nextPageToken = url.searchParams.get('$skiptoken') || undefined;
      }

      return {
        messages,
        nextPageToken,
        hasMore: !!response['@odata.nextLink'],
      };
    } catch (error) {
      console.error('Outlook fetchMessages error:', error);
      throw error;
    }
  }

  async getLabels(): Promise<LabelInfo[]> {
    try {
      if (this.useFolders) {
        const response = await this.graphRequest<{ value: GraphFolder[] }>('/me/mailFolders');
        return response.value.map((folder) => ({
          id: folder.id,
          name: folder.displayName,
          type: 'FOLDER' as LabelType,
        }));
      } else {
        const response = await this.graphRequest<{ value: GraphCategory[] }>(
          '/me/outlook/masterCategories'
        );
        return response.value.map((cat) => ({
          id: cat.id || cat.displayName,
          name: cat.displayName,
          type: 'CATEGORY' as LabelType,
        }));
      }
    } catch (error) {
      console.error('Outlook getLabels error:', error);
      throw error;
    }
  }

  async createLabel(name: string): Promise<LabelInfo> {
    try {
      if (this.useFolders) {
        const response = await this.graphRequest<GraphFolder>('/me/mailFolders', {
          method: 'POST',
          body: JSON.stringify({
            displayName: name,
          }),
        });
        return {
          id: response.id,
          name: response.displayName,
          type: 'FOLDER',
        };
      } else {
        // Create a new category
        const response = await this.graphRequest<GraphCategory>(
          '/me/outlook/masterCategories',
          {
            method: 'POST',
            body: JSON.stringify({
              displayName: name,
              color: 'preset0', // Default color
            }),
          }
        );
        return {
          id: response.displayName, // Categories are identified by name
          name: response.displayName,
          type: 'CATEGORY',
        };
      }
    } catch (error: any) {
      // If category already exists, return it
      if (error.message?.includes('already exists')) {
        const labels = await this.getLabels();
        const existing = labels.find((l) => l.name === name);
        if (existing) return existing;
      }
      throw error;
    }
  }

  async applyLabel(messageId: string, labelId: string): Promise<ApplyLabelResult> {
    try {
      if (this.useFolders) {
        // Move message to folder
        await this.graphRequest(`/me/messages/${messageId}/move`, {
          method: 'POST',
          body: JSON.stringify({
            destinationId: labelId,
          }),
        });
      } else {
        // Get current categories and add new one
        const message = await this.graphRequest<GraphMessage>(`/me/messages/${messageId}?$select=categories`);
        const currentCategories = message.categories || [];
        if (!currentCategories.includes(labelId)) {
          await this.graphRequest(`/me/messages/${messageId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              categories: [...currentCategories, labelId],
            }),
          });
        }
      }

      return { success: true, labelId };
    } catch (error: any) {
      console.error('Outlook applyLabel error:', error);
      return { success: false, error: error.message };
    }
  }

  async removeLabel(messageId: string, labelId: string): Promise<ApplyLabelResult> {
    try {
      if (this.useFolders) {
        // Move back to inbox
        await this.graphRequest(`/me/messages/${messageId}/move`, {
          method: 'POST',
          body: JSON.stringify({
            destinationId: 'inbox',
          }),
        });
      } else {
        // Remove category
        const message = await this.graphRequest<GraphMessage>(`/me/messages/${messageId}?$select=categories`);
        const currentCategories = message.categories || [];
        await this.graphRequest(`/me/messages/${messageId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            categories: currentCategories.filter((c) => c !== labelId),
          }),
        });
      }

      return { success: true, labelId };
    } catch (error: any) {
      console.error('Outlook removeLabel error:', error);
      return { success: false, error: error.message };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.graphRequest('/me');
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
      const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      const params = new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: this.credentials.refreshToken,
        grant_type: 'refresh_token',
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      const newCredentials: ProviderCredentials = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.credentials.refreshToken,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };

      this.credentials = newCredentials;
      return newCredentials;
    } catch (error) {
      console.error('Outlook token refresh error:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Nothing to cleanup
  }

  /**
   * Get or create a category/folder by name
   */
  async getOrCreateLabel(name: string): Promise<LabelInfo> {
    const labels = await this.getLabels();
    const existing = labels.find((l) => l.name === name);
    if (existing) return existing;

    return this.createLabel(name);
  }
}
