// =============================================================================
// Rule-Based Email Classifier
// =============================================================================

import type { EmailMessage, ClassificationResult, CategoryCode, RuleType, RuleField } from '@email-cat/shared';
import { prisma } from '../prisma';

interface Rule {
  id: string;
  categoryId: string;
  categoryCode: string;
  name: string;
  type: RuleType;
  field: RuleField;
  pattern: string;
  caseSensitive: boolean;
  priority: number;
  confidence: number;
}

export class RuleBasedClassifier {
  private rules: Rule[] = [];
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Load rules from database
   */
  async loadRules(): Promise<void> {
    const dbRules = await prisma.rule.findMany({
      where: {
        isActive: true,
        category: {
          userId: this.userId,
          isActive: true,
        },
      },
      include: {
        category: {
          select: {
            internalCode: true,
          },
        },
      },
      orderBy: {
        priority: 'desc',
      },
    });

    this.rules = dbRules.map((r) => ({
      id: r.id,
      categoryId: r.categoryId,
      categoryCode: r.category.internalCode,
      name: r.name,
      type: r.type as RuleType,
      field: r.field as RuleField,
      pattern: r.pattern,
      caseSensitive: r.caseSensitive,
      priority: r.priority,
      confidence: r.confidence,
    }));
  }

  /**
   * Classify an email message
   */
  classify(message: EmailMessage): ClassificationResult | null {
    const matches: Array<{ rule: Rule; score: number }> = [];

    for (const rule of this.rules) {
      const match = this.matchRule(rule, message);
      if (match) {
        matches.push({ rule, score: match });
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // Sort by priority first, then by score
    matches.sort((a, b) => {
      if (a.rule.priority !== b.rule.priority) {
        return b.rule.priority - a.rule.priority;
      }
      return b.score - a.score;
    });

    const best = matches[0];

    return {
      category: best.rule.categoryCode as CategoryCode,
      confidence: best.rule.confidence * best.score,
      suggestedLabel: best.rule.categoryCode,
      rationaleShort: `Matched rule: ${best.rule.name}`,
      classifiedBy: 'rules',
      matchedRule: best.rule.name,
    };
  }

  /**
   * Match a single rule against a message
   * Returns a score between 0 and 1, or null if no match
   */
  private matchRule(rule: Rule, message: EmailMessage): number | null {
    const fields = this.getFieldsToCheck(rule.field, message);

    for (const fieldValue of fields) {
      if (!fieldValue) continue;

      const match = this.matchPattern(rule.type, rule.pattern, fieldValue, rule.caseSensitive);
      if (match !== null) {
        return match;
      }
    }

    return null;
  }

  /**
   * Get the field values to check based on rule field type
   */
  private getFieldsToCheck(field: RuleField, message: EmailMessage): string[] {
    switch (field) {
      case 'FROM':
        return [message.from];
      case 'TO':
        return message.to;
      case 'SUBJECT':
        return [message.subject];
      case 'BODY':
        return message.body ? [message.body] : message.snippet ? [message.snippet] : [];
      case 'ANY':
        return [
          message.from,
          ...message.to,
          message.subject,
          message.body || message.snippet || '',
        ];
      default:
        return [];
    }
  }

  /**
   * Match a pattern against a value
   * Returns a score between 0 and 1, or null if no match
   */
  private matchPattern(
    type: RuleType,
    pattern: string,
    value: string,
    caseSensitive: boolean
  ): number | null {
    const normalizedValue = caseSensitive ? value : value.toLowerCase();
    const normalizedPattern = caseSensitive ? pattern : pattern.toLowerCase();

    switch (type) {
      case 'KEYWORD': {
        if (normalizedValue.includes(normalizedPattern)) {
          // Higher score for exact word match vs substring
          const wordBoundary = new RegExp(`\\b${this.escapeRegex(normalizedPattern)}\\b`, 'i');
          return wordBoundary.test(value) ? 1.0 : 0.8;
        }
        return null;
      }

      case 'REGEX': {
        try {
          const flags = caseSensitive ? '' : 'i';
          const regex = new RegExp(pattern, flags);
          if (regex.test(value)) {
            return 1.0;
          }
        } catch (e) {
          console.warn(`Invalid regex pattern: ${pattern}`, e);
        }
        return null;
      }

      case 'SENDER': {
        // Match sender email or domain
        const emailMatch = value.match(/<([^>]+)>/);
        const email = emailMatch ? emailMatch[1] : value;
        const normalizedEmail = caseSensitive ? email : email.toLowerCase();

        if (normalizedEmail.includes(normalizedPattern)) {
          return 1.0;
        }
        // Check domain match
        if (normalizedPattern.startsWith('@')) {
          const domain = normalizedEmail.split('@')[1];
          if (domain && domain === normalizedPattern.slice(1)) {
            return 1.0;
          }
        }
        return null;
      }

      case 'SUBJECT': {
        if (normalizedValue.includes(normalizedPattern)) {
          return 1.0;
        }
        return null;
      }

      case 'COMBINED': {
        // Combined rules use regex with multiple conditions
        try {
          const flags = caseSensitive ? '' : 'i';
          const regex = new RegExp(pattern, flags);
          if (regex.test(value)) {
            return 1.0;
          }
        } catch (e) {
          console.warn(`Invalid combined pattern: ${pattern}`, e);
        }
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * Create default rules for a user
 */
export async function createDefaultRules(userId: string): Promise<void> {
  const { DEFAULT_RULES } = await import('@email-cat/shared');

  // Get the user's categories
  const categories = await prisma.category.findMany({
    where: { userId },
  });

  const categoryMap = new Map(categories.map((c) => [c.internalCode, c.id]));

  for (const rule of DEFAULT_RULES) {
    const categoryId = categoryMap.get(rule.categoryCode);
    if (!categoryId) continue;

    // Check if rule already exists
    const existing = await prisma.rule.findFirst({
      where: {
        categoryId,
        name: rule.name,
      },
    });

    if (!existing) {
      await prisma.rule.create({
        data: {
          categoryId,
          name: rule.name,
          type: rule.type,
          field: rule.field,
          pattern: rule.pattern,
          priority: rule.priority,
          confidence: rule.confidence,
          isActive: true,
        },
      });
    }
  }
}
