// =============================================================================
// LLM Providers API Routes - Manage LLM API connections
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { encrypt } from '@/lib/shared';

export const runtime = 'nodejs';

/**
 * GET /api/llm-providers - List user's LLM providers
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const providers = await prisma.lLMProvider.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      provider: true,
      model: true,
      isDefault: true,
      status: true,
      lastError: true,
      createdAt: true,
      // Don't return the API key for security
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

  // Map status to lowercase for frontend
  const mappedProviders = providers.map((p: any) => ({
    ...p,
    provider: p.provider.toLowerCase(),
    status: p.status.toLowerCase(),
  }));

  return NextResponse.json({ providers: mappedProviders });
}

/**
 * POST /api/llm-providers - Create new LLM provider
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, provider, apiKey, model, isDefault } = body;

    if (!name || !provider || !apiKey || !model) {
      return NextResponse.json(
        { error: 'Name, Provider, API-Key und Modell sind erforderlich' },
        { status: 400 }
      );
    }

    // Validate provider type
    const validProviders = ['mistral', 'openai', 'anthropic', 'groq'];
    if (!validProviders.includes(provider.toLowerCase())) {
      return NextResponse.json(
        { error: 'Ungültiger Provider' },
        { status: 400 }
      );
    }

    // If this will be the default, unset other defaults
    if (isDefault) {
      await prisma.lLMProvider.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    // Check if this is the first provider - make it default automatically
    const existingCount = await prisma.lLMProvider.count({
      where: { userId: user.id },
    });

    const llmProvider = await prisma.lLMProvider.create({
      data: {
        userId: user.id,
        name,
        provider: provider.toUpperCase() as any,
        apiKey: encrypt(apiKey),
        model,
        isDefault: isDefault || existingCount === 0,
        status: 'UNCHECKED',
      },
    });

    return NextResponse.json({
      provider: {
        id: llmProvider.id,
        name: llmProvider.name,
        provider: llmProvider.provider.toLowerCase(),
        model: llmProvider.model,
        isDefault: llmProvider.isDefault,
        status: 'unchecked',
        createdAt: llmProvider.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Failed to create LLM provider:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen des Providers', details: error.message },
      { status: 500 }
    );
  }
}
