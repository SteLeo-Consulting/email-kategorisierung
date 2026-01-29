// =============================================================================
// Email Processing Service
// =============================================================================

import type { ProcessingResult, EmailMessage, ClassificationResult } from '@email-cat/shared';
import { PROCESSING_LIMITS } from '@email-cat/shared';
import { prisma } from '../prisma';
import {
  createProviderFromConnection,
  updateConnectionTokens,
  markConnectionError,
  markConnectionNeedsReauth,
  EmailProvider,
} from '../providers';
import { EmailClassifier, getLabelForClassification } from '../classification';

export interface ProcessConnectionOptions {
  maxEmails?: number;
  dryRun?: boolean;
}

export class EmailProcessor {
  private connectionId: string;
  private provider: EmailProvider | null = null;
  private classifier: EmailClassifier | null = null;
  private options: ProcessConnectionOptions;

  constructor(connectionId: string, options: ProcessConnectionOptions = {}) {
    this.connectionId = connectionId;
    this.options = {
      maxEmails: options.maxEmails ?? PROCESSING_LIMITS.MAX_EMAILS_PER_RUN,
      dryRun: options.dryRun ?? false,
    };
  }

  /**
   * Process emails for a connection
   */
  async process(): Promise<ProcessingResult> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      connectionId: this.connectionId,
      messagesProcessed: 0,
      messagesLabeled: 0,
      messagesReview: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Get connection details
      const connection = await prisma.connection.findUnique({
        where: { id: this.connectionId },
      });

      if (!connection) {
        throw new Error(`Connection not found: ${this.connectionId}`);
      }

      if (connection.status !== 'ACTIVE') {
        throw new Error(`Connection is not active: ${connection.status}`);
      }

      // Initialize provider
      this.provider = await createProviderFromConnection(this.connectionId);

      // Refresh token if needed
      const newTokens = await this.provider.refreshTokenIfNeeded();
      if (newTokens) {
        await updateConnectionTokens(this.connectionId, newTokens);
      }

      // Initialize classifier
      this.classifier = new EmailClassifier(connection.userId);
      await this.classifier.initialize();

      // Fetch messages since last sync
      const fetchResult = await this.provider.fetchMessages({
        since: connection.lastSyncAt || undefined,
        maxResults: this.options.maxEmails,
      });

      // Process each message
      for (const message of fetchResult.messages) {
        try {
          const processed = await this.processMessage(message);
          result.messagesProcessed++;

          if (processed.labeled) {
            result.messagesLabeled++;
          }
          if (processed.needsReview) {
            result.messagesReview++;
          }
        } catch (error: any) {
          console.error(`Error processing message ${message.id}:`, error);
          result.errors.push({
            messageId: message.id,
            error: error.message,
          });
        }
      }

      // Update connection last sync time
      await prisma.connection.update({
        where: { id: this.connectionId },
        data: {
          lastSyncAt: new Date(),
          status: 'ACTIVE',
          lastError: null,
        },
      });
    } catch (error: any) {
      console.error(`Error processing connection ${this.connectionId}:`, error);

      // Determine if this is a token error
      if (
        error.message?.includes('token') ||
        error.message?.includes('unauthorized') ||
        error.message?.includes('401')
      ) {
        await markConnectionNeedsReauth(this.connectionId);
      } else {
        await markConnectionError(this.connectionId, error.message);
      }

      throw error;
    } finally {
      // Cleanup
      if (this.provider) {
        await this.provider.disconnect();
      }

      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Process a single message
   */
  private async processMessage(
    message: EmailMessage
  ): Promise<{ labeled: boolean; needsReview: boolean }> {
    // Check if already processed
    const existing = await prisma.processedMessage.findUnique({
      where: {
        connectionId_messageId: {
          connectionId: this.connectionId,
          messageId: message.id,
        },
      },
    });

    if (existing) {
      // Already processed - skip
      return { labeled: false, needsReview: false };
    }

    // Classify the message
    const classification = await this.classifier!.classify(message);

    // Get label information
    const labelInfo = await getLabelForClassification(this.connectionId, classification);

    let labeled = false;
    let labelApplied: string | null = null;

    // Apply label if not a dry run
    if (!this.options.dryRun && labelInfo && this.provider) {
      // Ensure label exists
      try {
        const label = await this.provider.getOrCreateLabel(labelInfo.labelId);
        const applyResult = await this.provider.applyLabel(message.id, label.id);

        if (applyResult.success) {
          labeled = true;
          labelApplied = label.id;
        }
      } catch (error) {
        console.error(`Error applying label to message ${message.id}:`, error);
      }
    }

    // Record the processed message
    await prisma.processedMessage.create({
      data: {
        connectionId: this.connectionId,
        messageId: message.id,
        threadId: message.threadId,
        categoryId: labelInfo?.categoryId,
        confidence: classification.confidence,
        labelApplied,
        labelType: labelInfo?.labelType as any,
        classifiedBy: classification.classifiedBy,
        rationale: classification.rationaleShort,
        needsReview: classification.category === 'REVIEW',
        emailSubject: message.subject,
        emailFrom: message.from,
        emailDate: message.date,
      },
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'EMAIL_CLASSIFIED',
        entityType: 'message',
        entityId: message.id,
        details: {
          connectionId: this.connectionId,
          category: classification.category,
          confidence: classification.confidence,
          classifiedBy: classification.classifiedBy,
          labelApplied,
          subject: message.subject?.slice(0, 100),
        },
      },
    });

    return {
      labeled,
      needsReview: classification.category === 'REVIEW',
    };
  }
}

/**
 * Process all active connections for a user
 */
export async function processUserConnections(
  userId: string,
  options?: ProcessConnectionOptions
): Promise<ProcessingResult[]> {
  const connections = await prisma.connection.findMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
  });

  const results: ProcessingResult[] = [];

  for (const connection of connections) {
    try {
      const processor = new EmailProcessor(connection.id, options);
      const result = await processor.process();
      results.push(result);
    } catch (error) {
      console.error(`Error processing connection ${connection.id}:`, error);
      // Continue with other connections
    }
  }

  return results;
}

/**
 * Process all active connections (for cron job)
 */
export async function processAllConnections(
  options?: ProcessConnectionOptions
): Promise<ProcessingResult[]> {
  const connections = await prisma.connection.findMany({
    where: {
      status: 'ACTIVE',
    },
  });

  const results: ProcessingResult[] = [];

  for (const connection of connections) {
    try {
      const processor = new EmailProcessor(connection.id, options);
      const result = await processor.process();
      results.push(result);
    } catch (error) {
      console.error(`Error processing connection ${connection.id}:`, error);
      // Continue with other connections
    }
  }

  return results;
}
