// =============================================================================
// Category by ID API Routes (GET, PATCH, DELETE)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UpdateCategorySchema } from '@/lib/shared';
import { createAuditLog } from '@/lib/services/audit';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/categories/[id] - Get single category
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const category = await prisma.category.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
    include: {
      _count: {
        select: {
          rules: true,
          labelMappings: true,
          processedMessages: true,
        },
      },
    },
  });

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  return NextResponse.json({ category });
}

/**
 * PATCH /api/categories/[id] - Update category
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.category.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  try {
    const body = await request.json();

    const parsed = UpdateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Build update data, only including provided fields
    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.color !== undefined) updateData.color = parsed.data.color;
    if (parsed.data.icon !== undefined) updateData.icon = parsed.data.icon;

    // Allow toggling isActive
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Don't allow changing internalCode on existing categories
    if (parsed.data.internalCode && parsed.data.internalCode !== existing.internalCode) {
      return NextResponse.json(
        { error: 'Cannot change internal code of existing category' },
        { status: 400 }
      );
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: updateData,
      include: {
        _count: {
          select: {
            rules: true,
            labelMappings: true,
            processedMessages: true,
          },
        },
      },
    });

    await createAuditLog({
      action: 'CATEGORY_UPDATED',
      userId: user.id,
      entityType: 'category',
      entityId: category.id,
      details: { name: category.name, changes: Object.keys(updateData) },
    });

    return NextResponse.json({ category });
  } catch (error: any) {
    console.error('Failed to update category:', error);
    return NextResponse.json(
      { error: 'Failed to update category', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/categories/[id] - Delete category
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.category.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
    include: {
      _count: {
        select: {
          rules: true,
          processedMessages: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  // Prevent deletion of system categories
  if (existing.isSystem) {
    return NextResponse.json(
      { error: 'Cannot delete system categories. You can deactivate them instead.' },
      { status: 400 }
    );
  }

  // Warn if category has associated data
  if (existing._count.processedMessages > 0) {
    // Mark as deleted instead of hard delete to preserve history
    const category = await prisma.category.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    await createAuditLog({
      action: 'CATEGORY_DELETED',
      userId: user.id,
      entityType: 'category',
      entityId: category.id,
      details: { name: existing.name, softDelete: true },
    });

    return NextResponse.json({
      category,
      message: 'Category deactivated (has associated messages)'
    });
  }

  // Hard delete if no associated data
  await prisma.category.delete({
    where: { id: params.id },
  });

  await createAuditLog({
    action: 'CATEGORY_DELETED',
    userId: user.id,
    entityType: 'category',
    entityId: params.id,
    details: { name: existing.name, hardDelete: true },
  });

  return NextResponse.json({ success: true });
}
