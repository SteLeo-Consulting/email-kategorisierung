// =============================================================================
// LLM Provider API Routes - Single provider operations
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth-helper';
import { encrypt } from '@/lib/shared';

export const runtime = 'nodejs';

/**
 * GET /api/llm-providers/[id] - Get single provider
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const provider = await prisma.lLMProvider.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
      provider: true,
      model: true,
      isDefault: true,
      status: true,
      lastError: true,
      createdAt: true,
    },
  });

  if (!provider) {
    return NextResponse.json({ error: 'Provider nicht gefunden' }, { status: 404 });
  }

  return NextResponse.json({
    provider: {
      ...provider,
      provider: provider.provider.toLowerCase(),
      status: provider.status.toLowerCase(),
    },
  });
}

/**
 * PATCH /api/llm-providers/[id] - Update provider
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, model, apiKey, isDefault } = body;

    // Verify provider belongs to user
    const existing = await prisma.lLMProvider.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Provider nicht gefunden' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.lLMProvider.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (model !== undefined) updateData.model = model;
    if (apiKey !== undefined) updateData.apiKey = encrypt(apiKey);
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    const provider = await prisma.lLMProvider.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({
      provider: {
        id: provider.id,
        name: provider.name,
        provider: provider.provider.toLowerCase(),
        model: provider.model,
        isDefault: provider.isDefault,
        status: provider.status.toLowerCase(),
      },
    });
  } catch (error: any) {
    console.error('Failed to update LLM provider:', error);
    return NextResponse.json(
      { error: 'Fehler beim Aktualisieren', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/llm-providers/[id] - Delete provider
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    // Verify provider belongs to user
    const existing = await prisma.lLMProvider.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Provider nicht gefunden' }, { status: 404 });
    }

    await prisma.lLMProvider.delete({
      where: { id: params.id },
    });

    // If deleted provider was default, set another one as default
    if (existing.isDefault) {
      const firstProvider = await prisma.lLMProvider.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'asc' },
      });

      if (firstProvider) {
        await prisma.lLMProvider.update({
          where: { id: firstProvider.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete LLM provider:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen', details: error.message },
      { status: 500 }
    );
  }
}
