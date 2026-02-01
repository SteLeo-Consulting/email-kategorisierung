// =============================================================================
// LLM Provider Test API - Test LLM API connection
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { decrypt } from '@/lib/shared';

export const runtime = 'nodejs';

/**
 * POST /api/llm-providers/[id]/test - Test LLM provider connection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get provider
    const provider = await prisma.lLMProvider.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider nicht gefunden' }, { status: 404 });
    }

    // Decrypt API key
    const apiKey = decrypt(provider.apiKey);

    // Test the connection based on provider type
    let testResult: { success: boolean; error?: string };

    switch (provider.provider) {
      case 'MISTRAL':
        testResult = await testMistral(apiKey, provider.model);
        break;
      case 'OPENAI':
        testResult = await testOpenAI(apiKey, provider.model);
        break;
      case 'ANTHROPIC':
        testResult = await testAnthropic(apiKey, provider.model);
        break;
      case 'GROQ':
        testResult = await testGroq(apiKey, provider.model);
        break;
      default:
        testResult = { success: false, error: 'Unbekannter Provider' };
    }

    // Update provider status
    await prisma.lLMProvider.update({
      where: { id: params.id },
      data: {
        status: testResult.success ? 'ACTIVE' : 'ERROR',
        lastError: testResult.error || null,
      },
    });

    return NextResponse.json(testResult);
  } catch (error: any) {
    console.error('Failed to test LLM provider:', error);

    // Update status to error
    await prisma.lLMProvider.update({
      where: { id: params.id },
      data: {
        status: 'ERROR',
        lastError: error.message,
      },
    });

    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Test Mistral AI API
 */
async function testMistral(apiKey: string, model: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Test OpenAI API
 */
async function testOpenAI(apiKey: string, model: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Anthropic API
 */
async function testAnthropic(apiKey: string, model: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Groq API
 */
async function testGroq(apiKey: string, model: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
