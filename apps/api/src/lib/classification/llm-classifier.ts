// =============================================================================
// LLM-Based Email Classifier (Optional)
// =============================================================================

import type { EmailMessage, ClassificationResult, CategoryCode, LLMProvider } from '@/lib/shared';
import { decrypt } from '@/lib/shared';
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
   * Check if LLM classification is enabled for a user
   * Checks both environment variables and database providers
   */
  static isEnabled(): boolean {
    // Check environment variables first
    const envProvider = process.env.LLM_PROVIDER as LLMProvider;
    if (envProvider && envProvider !== 'none' && process.env.LLM_API_KEY) {
      return true;
    }
    // Will be checked async via hasDbProvider
    return true; // Return true to allow DB check in fromEnv
  }

  /**
   * Check if user has a DB-configured LLM provider
   */
  static async hasDbProvider(userId: string): Promise<boolean> {
    const provider = await prisma.lLMProvider.findFirst({
      where: {
        userId,
        isDefault: true,
        status: { not: 'ERROR' },
      },
    });
    return !!provider;
  }

  /**
   * Create an LLM classifier from environment config or database
   */
  static fromEnv(userId: string): LLMClassifier | null {
    // Check environment variables first
    const envProvider = process.env.LLM_PROVIDER as LLMProvider;
    const envApiKey = process.env.LLM_API_KEY;

    if (envProvider && envProvider !== 'none' && envApiKey) {
      return new LLMClassifier(userId, {
        provider: envProvider,
        apiKey: envApiKey,
        model: process.env.LLM_MODEL,
      });
    }

    // Return a placeholder that will load from DB
    return new LLMClassifier(userId, {
      provider: 'mistral' as LLMProvider,
      apiKey: '',
      model: '',
    });
  }

  /**
   * Load LLM config from database if not set
   */
  private async ensureConfig(): Promise<boolean> {
    if (this.config.apiKey) {
      return true;
    }

    // Try to load from database
    const dbProvider = await prisma.lLMProvider.findFirst({
      where: {
        userId: this.userId,
        isDefault: true,
        status: { not: 'ERROR' },
      },
    });

    if (!dbProvider) {
      return false;
    }

    try {
      this.config = {
        provider: dbProvider.provider.toLowerCase() as LLMProvider,
        apiKey: decrypt(dbProvider.apiKey),
        model: dbProvider.model,
      };
      return true;
    } catch (error) {
      console.error('Failed to decrypt LLM API key:', error);
      return false;
    }
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

    this.categories = dbCategories.map((c: { internalCode: string; name: string; description: string | null }) => ({
      code: c.internalCode,
      name: c.name,
      description: c.description || undefined,
    }));
  }

  /**
   * Classify an email message using LLM
   */
  async classify(message: EmailMessage): Promise<ClassificationResult | null> {
    // Ensure we have a valid config
    const hasConfig = await this.ensureConfig();
    if (!hasConfig) {
      console.log('No LLM provider configured, skipping LLM classification');
      return null;
    }

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
      console.log(`[LLM] Classifying message with ${this.config.provider}/${this.config.model}`);
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

      console.log(`[LLM] Classified as ${parsed.category} with confidence ${parsed.confidence}`);
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
      case 'mistral':
        return this.callMistral(prompt);
      case 'groq':
        return this.callGroq(prompt);
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
   * Call Mistral API
   */
  private async callMistral(prompt: string): Promise<string> {
    const model = this.config.model || 'mistral-small-latest';

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
      throw new Error(`Mistral API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Call Groq API
   */
  private async callGroq(prompt: string): Promise<string> {
    const model = this.config.model || 'llama-3.1-8b-instant';

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
      throw new Error(`Groq API error: ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
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
