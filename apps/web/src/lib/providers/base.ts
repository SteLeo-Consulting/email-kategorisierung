// =============================================================================
// Base Provider Interface
// =============================================================================

import type { EmailMessage, ClassificationResult, LabelType } from '@email-cat/shared';

export interface ProviderCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

export interface IMAPCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface FetchOptions {
  since?: Date;
  maxResults?: number;
  pageToken?: string;
}

export interface FetchResult {
  messages: EmailMessage[];
  nextPageToken?: string;
  hasMore: boolean;
}

export interface LabelInfo {
  id: string;
  name: string;
  type: LabelType;
}

export interface ApplyLabelResult {
  success: boolean;
  labelId?: string;
  error?: string;
}

export abstract class EmailProvider {
  abstract readonly providerName: string;

  /**
   * Fetch new emails from the provider
   */
  abstract fetchMessages(options: FetchOptions): Promise<FetchResult>;

  /**
   * Get available labels/categories/folders
   */
  abstract getLabels(): Promise<LabelInfo[]>;

  /**
   * Create a new label if it doesn't exist
   */
  abstract createLabel(name: string): Promise<LabelInfo>;

  /**
   * Apply a label to a message
   */
  abstract applyLabel(messageId: string, labelId: string): Promise<ApplyLabelResult>;

  /**
   * Remove a label from a message
   */
  abstract removeLabel(messageId: string, labelId: string): Promise<ApplyLabelResult>;

  /**
   * Check if the connection is valid
   */
  abstract testConnection(): Promise<boolean>;

  /**
   * Refresh access token if needed
   */
  abstract refreshTokenIfNeeded(): Promise<ProviderCredentials | null>;

  /**
   * Disconnect and cleanup
   */
  abstract disconnect(): Promise<void>;
}
