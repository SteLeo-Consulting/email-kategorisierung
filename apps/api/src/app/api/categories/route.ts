// =============================================================================
// Categories API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateCategorySchema } from '@/lib/shared';
import { createAuditLog } from '@/lib/services/audit';
import { createDefaultCategories } from '@/lib/classification';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';

/**
 * GET /api/categories - List user's categories
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  // Check if user has categories, if not create defaults
  const count = await prisma.category.count({
    where: { userId: user.id },
  });

  if (count === 0) {
    await createDefaultCategories(user.id);
  }

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    include: {
      _count: {
        select: {
          rules: true,
          labelMappings: true,
          processedMessages: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ categories });
}

/**
 * POST /api/categories - Create category
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const parsed = CreateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Check for existing category with same code
    const existing = await prisma.category.findFirst({
      where: {
        userId: user.id,
        internalCode: parsed.data.internalCode,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Category with this code already exists' },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        internalCode: parsed.data.internalCode,
        description: parsed.data.description,
        color: parsed.data.color || '#6366f1',
        icon: parsed.data.icon,
        isSystem: false,
        isActive: true,
      },
    });

    await createAuditLog({
      action: 'CATEGORY_CREATED',
      userId: user.id,
      entityType: 'category',
      entityId: category.id,
      details: { name: category.name, code: category.internalCode },
    });

    return NextResponse.json({ category });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create category', details: error.message },
      { status: 500 }
    );
  }
}
