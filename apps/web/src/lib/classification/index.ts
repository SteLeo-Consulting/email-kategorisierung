// =============================================================================
// Unified Classification Module
// =============================================================================

import type { EmailMessage, ClassificationResult, CategoryCode } from '@email-cat/shared';
import { CLASSIFICATION_THRESHOLDS } from '@email-cat/shared';
import { RuleBasedClassifier, createDefaultRules } from './rule-classifier';
import { LLMClassifier } from './llm-classifier';
import { prisma } from '../prisma';

export { RuleBasedClassifier, createDefaultRules } from './rule-classifier';
export { LLMClassifier } from './llm-classifier';

export interface ClassificationOptions {
  useLLM?: boolean;
  llmFallbackOnly?: boolean; // Only use LLM if rules don't match
}

export class EmailClassifier {
  private ruleClassifier: RuleBasedClassifier;
  private llmClassifier: LLMClassifier | null = null;
  private userId: string;
  private options: ClassificationOptions;

  constructor(userId: string, options: ClassificationOptions = {}) {
    this.userId = userId;
    this.options = {
      useLLM: options.useLLM ?? LLMClassifier.isEnabled(),
      llmFallbackOnly: options.llmFallbackOnly ?? true,
    };
    this.ruleClassifier = new RuleBasedClassifier(userId);

    if (this.options.useLLM) {
      this.llmClassifier = LLMClassifier.fromEnv(userId);
    }
  }

  /**
   * Initialize the classifier (load rules, categories)
   */
  async initialize(): Promise<void> {
    await this.ruleClassifier.loadRules();
    if (this.llmClassifier) {
      await this.llmClassifier.loadCategories();
    }
  }

  /**
   * Classify an email message
   * Returns a result with REVIEW category if confidence is low
   */
  async classify(message: EmailMessage): Promise<ClassificationResult> {
    // First, try rule-based classification
    let result = this.ruleClassifier.classify(message);

    // If rules matched with high confidence, use that result
    if (result && result.confidence >= CLASSIFICATION_THRESHOLDS.HIGH_CONFIDENCE) {
      return result;
    }

    // If LLM is enabled and either:
    // - No rule match, or
    // - Rule match but not fallback-only mode
    if (
      this.llmClassifier &&
      (!result || !this.options.llmFallbackOnly)
    ) {
      const llmResult = await this.llmClassifier.classify(message);

      if (llmResult) {
        // If LLM has higher confidence, use it
        if (!result || llmResult.confidence > result.confidence) {
          result = llmResult;
        }
      }
    }

    // If we have a result, check confidence thresholds
    if (result) {
      return this.applyConfidenceThresholds(result);
    }

    // No classification possible - mark for review
    return {
      category: 'REVIEW',
      confidence: 0,
      suggestedLabel: 'REVIEW',
      rationaleShort: 'No matching rules or patterns found',
      classifiedBy: 'rules',
    };
  }

  /**
   * Apply confidence thresholds to determine final action
   */
  private applyConfidenceThresholds(result: ClassificationResult): ClassificationResult {
    const { HIGH_CONFIDENCE, MEDIUM_CONFIDENCE } = CLASSIFICATION_THRESHOLDS;

    if (result.confidence >= HIGH_CONFIDENCE) {
      // High confidence - use as-is
      return result;
    }

    if (result.confidence >= MEDIUM_CONFIDENCE) {
      // Medium confidence - mark for review but keep suggestion
      return {
        ...result,
        category: 'REVIEW',
        suggestedLabel: result.category,
        rationaleShort: `[Review needed] ${result.rationaleShort}`,
      };
    }

    // Low confidence - mark for review only
    return {
      ...result,
      category: 'REVIEW',
      suggestedLabel: result.category,
      rationaleShort: `[Low confidence] ${result.rationaleShort}`,
    };
  }

  /**
   * Batch classify multiple messages
   */
  async classifyBatch(
    messages: EmailMessage[]
  ): Promise<Map<string, ClassificationResult>> {
    const results = new Map<string, ClassificationResult>();

    for (const message of messages) {
      const result = await this.classify(message);
      results.set(message.id, result);
    }

    return results;
  }
}

/**
 * Initialize default categories for a new user
 */
export async function createDefaultCategories(userId: string): Promise<void> {
  const { DEFAULT_CATEGORIES } = await import('@email-cat/shared');

  for (const category of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: {
        userId,
        internalCode: category.code,
      },
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          userId,
          name: category.name,
          internalCode: category.code,
          description: category.description,
          color: category.color,
          icon: category.icon,
          isSystem: category.isSystem,
          isActive: true,
        },
      });
    }
  }

  // Also create default rules
  await createDefaultRules(userId);
}

/**
 * Get the label to apply based on classification result and mapping
 */
export async function getLabelForClassification(
  connectionId: string,
  result: ClassificationResult
): Promise<{
  labelId: string;
  labelType: string;
  categoryId: string;
} | null> {
  // Find the category
  const connection = await prisma.connection.findUnique({
    where: { id: connectionId },
    include: { user: true },
  });

  if (!connection) return null;

  const category = await prisma.category.findFirst({
    where: {
      userId: connection.userId,
      internalCode: result.category,
    },
  });

  if (!category) return null;

  // Find label mapping for this connection/category
  const mapping = await prisma.labelMapping.findUnique({
    where: {
      categoryId_connectionId: {
        categoryId: category.id,
        connectionId,
      },
    },
  });

  if (mapping) {
    return {
      labelId: mapping.providerLabel,
      labelType: mapping.labelType,
      categoryId: category.id,
    };
  }

  // Use default label name if no mapping exists
  const { DEFAULT_LABEL_NAMES } = await import('@email-cat/shared');
  const defaultLabel = DEFAULT_LABEL_NAMES[result.category as CategoryCode];

  return {
    labelId: defaultLabel,
    labelType: connection.provider === 'GMAIL' ? 'LABEL' : 'CATEGORY',
    categoryId: category.id,
  };
}
