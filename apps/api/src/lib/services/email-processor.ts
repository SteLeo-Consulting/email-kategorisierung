// =============================================================================
// Email Processing Service
// =============================================================================

import type { ProcessingResult, EmailMessage, ClassificationResult } from '@/lib/shared';
import { PROCESSING_LIMITS } from '@/lib/shared';
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
  forceReprocess?: boolean; // Reprocess even if already processed
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
      forceReprocess: options.forceReprocess ?? false,
    };
  }

  /**
   * Process emails for a connection
   * Fetches ALL emails from INBOX and processes only those not yet categorized
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

      // Get list of already processed message IDs for this connection
      const processedMessages = await prisma.processedMessage.findMany({
        where: { connectionId: this.connectionId },
        select: { messageId: true },
      });
      const processedMessageIds = new Set(processedMessages.map((m) => m.messageId));
      console.log(`[Processor] Found ${processedMessageIds.size} already processed messages`);

      // Fetch ALL messages from INBOX (no date filter)
      // This ensures we process all uncategorized emails
      const fetchResult = await this.provider.fetchMessages({
        maxResults: this.options.maxEmails,
        // NO 'since' filter - we want ALL emails
      });

      console.log(`[Processor] Fetched ${fetchResult.messages.length} messages from mailbox`);

      // Filter to only unprocessed messages (unless forceReprocess is enabled)
      const messagesToProcess = this.options.forceReprocess
        ? fetchResult.messages
        : fetchResult.messages.filter((m) => !processedMessageIds.has(m.id));

      console.log(`[Processor] ${messagesToProcess.length} messages need processing`);

      // Process each unprocessed message
      for (const message of messagesToProcess) {
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

    if (existing && !this.options.forceReprocess) {
      // Already processed - skip (unless forceReprocess is enabled)
      return { labeled: false, needsReview: false };
    }

    // If forceReprocess and exists, delete the old record first
    if (existing && this.options.forceReprocess) {
      await prisma.processedMessage.delete({
        where: { id: existing.id },
      });
    }

    // Classify the message
    console.log(`[Processor] Classifying message ${message.id}: "${message.subject}" from ${message.from}`);
    const classification = await this.classifier!.classify(message);
    console.log(`[Processor] Classification result: category=${classification.category}, confidence=${classification.confidence}, by=${classification.classifiedBy}`);

    // Get label information
    const labelInfo = await getLabelForClassification(this.connectionId, classification);
    console.log(`[Processor] Label info:`, labelInfo ? `labelId="${labelInfo.labelId}", categoryId=${labelInfo.categoryId}` : 'null');

    let labeled = false;
    let labelApplied: string | null = null;

    // Apply label if not a dry run
    if (!this.options.dryRun && labelInfo && this.provider) {
      // Ensure label exists and apply it
      try {
        console.log(`[Processor] Getting or creating label "${labelInfo.labelId}" for message ${message.id}`);
        const label = await this.provider.getOrCreateLabel(labelInfo.labelId);
        console.log(`[Processor] Applying label "${label.id}" to message ${message.id}`);
        const applyResult = await this.provider.applyLabel(message.id, label.id);

        if (applyResult.success) {
          labeled = true;
          labelApplied = label.id;
          console.log(`[Processor] Successfully labeled message ${message.id} with "${label.id}"`);
        } else {
          console.error(`[Processor] Failed to apply label to message ${message.id}: ${applyResult.error}`);
        }
      } catch (error: any) {
        console.error(`[Processor] Error applying label to message ${message.id}:`, error.message);
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
