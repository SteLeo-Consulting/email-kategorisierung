// =============================================================================
// LLM-Based Email Classifier (Optional)
// =============================================================================

import type { EmailMessage, ClassificationResult, CategoryCode, LLMProvider } from '@email-cat/shared';
import { prisma } from '../prisma';

interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
}

interface CategoryInfo {
  code: string;
  name: string;
  description?: string;
}

const CLASSIFICATION_PROMPT = `You are an email classification assistant. Analyze the following email and classify it into exactly one of the provided categories.

EMAIL:
From: {from}
Subject: {subject}
Preview: {snippet}

AVAILABLE CATEGORIES:
{categories}

Respond with a JSON object in this exact format:
{
  "category": "CATEGORY_CODE",
  "confidence": 0.85,
  "rationale": "Brief explanation (max 100 chars)"
}

Rules:
- category must be one of the category codes listed above
- confidence must be a number between 0 and 1
- If unsure, use "REVIEW" as category with lower confidence
- Be concise in rationale

JSON Response:`;

export class LLMClassifier {
  private config: LLMConfig;
  private categories: CategoryInfo[] = [];
  private userId: string;

  constructor(userId: string, config: LLMConfig) {
    this.userId = userId;
    this.config = config;
  }

  /**
   * Check if LLM classification is enabled
   */
  static isEnabled(): boolean {
    const provider = process.env.LLM_PROVIDER as LLMProvider;
    return provider && provider !== 'none' && !!process.env.LLM_API_KEY;
  }

  /**
   * Create an LLM classifier from environment config
   */
  static fromEnv(userId: string): LLMClassifier | null {
    const provider = process.env.LLM_PROVIDER as LLMProvider;
    const apiKey = process.env.LLM_API_KEY;

    if (!provider || provider === 'none' || !apiKey) {
      return null;
    }

    return new LLMClassifier(userId, {
      provider,
      apiKey,
      model: process.env.LLM_MODEL,
    });
  }

  /**
   * Load categories from database
   */
  async loadCategories(): Promise<void> {
    const dbCategories = await prisma.category.findMany({
      where: {
        userId: this.userId,
        isActive: true,
      },
    });

    this.categories = dbCategories.map((c) => ({
      code: c.internalCode,
      name: c.name,
      description: c.description || undefined,
    }));
  }

  /**
   * Classify an email message using LLM
   */
  async classify(message: EmailMessage): Promise<ClassificationResult | null> {
    if (this.categories.length === 0) {
      await this.loadCategories();
    }

    const categoriesText = this.categories
      .map((c) => `- ${c.code}: ${c.name}${c.description ? ` (${c.description})` : ''}`)
      .join('\n');

    const prompt = CLASSIFICATION_PROMPT
      .replace('{from}', message.from)
      .replace('{subject}', message.subject)
      .replace('{snippet}', message.snippet || message.body?.slice(0, 300) || 'No preview available')
      .replace('{categories}', categoriesText);

    try {
      const response = await this.callLLM(prompt);
      const parsed = this.parseResponse(response);

      if (!parsed) {
        return null;
      }

      // Validate category
      const validCategory = this.categories.find((c) => c.code === parsed.category);
      if (!validCategory) {
        console.warn(`LLM returned invalid category: ${parsed.category}`);
        return null;
      }

      return {
        category: parsed.category as CategoryCode,
        confidence: Math.min(1, Math.max(0, parsed.confidence)),
        suggestedLabel: parsed.category,
        rationaleShort: parsed.rationale.slice(0, 200),
        classifiedBy: 'llm',
      };
    } catch (error) {
      console.error('LLM classification error:', error);
      return null;
    }
  }

  /**
   * Call the LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    switch (this.config.provider) {
      case 'openai':
        return this.callOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const model = this.config.model || 'gpt-4o-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a precise email classifier. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropic(prompt: string): Promise<string> {
    const model = this.config.model || 'claude-3-haiku-20240307';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 150,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  /**
   * Parse LLM response to classification result
   */
  private parseResponse(
    response: string
  ): { category: string; confidence: number; rationale: string } | null {
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '');
      }

      // Find JSON object in response
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (
        typeof parsed.category !== 'string' ||
        typeof parsed.confidence !== 'number' ||
        typeof parsed.rationale !== 'string'
      ) {
        return null;
      }

      return {
        category: parsed.category.toUpperCase(),
        confidence: parsed.confidence,
        rationale: parsed.rationale,
      };
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
      return null;
    }
  }
}
