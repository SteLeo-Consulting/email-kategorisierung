// =============================================================================
// Rules API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateRuleSchema } from '@/lib/shared';
import { createAuditLog } from '@/lib/services/audit';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';

/**
 * GET /api/rules - List user's rules
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId');

  const rules = await prisma.rule.findMany({
    where: {
      category: {
        userId: user.id,
      },
      ...(categoryId && { categoryId }),
    },
    include: {
      category: {
        select: {
          name: true,
          internalCode: true,
          color: true,
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json({ rules });
}

/**
 * POST /api/rules - Create rule
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const parsed = CreateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Verify category belongs to user
    const category = await prisma.category.findFirst({
      where: {
        id: parsed.data.categoryId,
        userId: user.id,
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Validate regex if type is REGEX
    if (parsed.data.type === 'REGEX') {
      try {
        new RegExp(parsed.data.pattern);
      } catch {
        return NextResponse.json(
          { error: 'Invalid regex pattern' },
          { status: 400 }
        );
      }
    }

    const rule = await prisma.rule.create({
      data: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        type: parsed.data.type,
        field: parsed.data.field,
        pattern: parsed.data.pattern,
        caseSensitive: parsed.data.caseSensitive ?? false,
        priority: parsed.data.priority ?? 0,
        confidence: parsed.data.confidence ?? 0.85,
        isActive: true,
      },
      include: {
        category: {
          select: {
            name: true,
            internalCode: true,
          },
        },
      },
    });

    await createAuditLog({
      action: 'RULE_CREATED',
      userId: user.id,
      entityType: 'rule',
      entityId: rule.id,
      details: { name: rule.name, pattern: rule.pattern, categoryId: rule.categoryId },
    });

    return NextResponse.json({ rule });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create rule', details: error.message },
      { status: 500 }
    );
  }
}
