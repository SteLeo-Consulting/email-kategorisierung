// =============================================================================
// Single Rule API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UpdateRuleSchema } from '@/lib/shared';
import { createAuditLog } from '@/lib/services/audit';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/rules/[id] - Get rule details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const rule = await prisma.rule.findFirst({
    where: {
      id: params.id,
      category: {
        userId: user.id,
      },
    },
    include: {
      category: true,
    },
  });

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  return NextResponse.json({ rule });
}

/**
 * PATCH /api/rules/[id] - Update rule
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const rule = await prisma.rule.findFirst({
    where: {
      id: params.id,
      category: {
        userId: user.id,
      },
    },
  });

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  try {
    const body = await request.json();

    const parsed = UpdateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Validate regex if type is REGEX
    if (parsed.data.type === 'REGEX' && parsed.data.pattern) {
      try {
        new RegExp(parsed.data.pattern);
      } catch {
        return NextResponse.json(
          { error: 'Invalid regex pattern' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.rule.update({
      where: { id: params.id },
      data: parsed.data,
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
      action: 'RULE_UPDATED',
      userId: user.id,
      entityType: 'rule',
      entityId: params.id,
      details: { changes: body },
    });

    return NextResponse.json({ rule: updated });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update rule', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rules/[id] - Delete rule
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const rule = await prisma.rule.findFirst({
    where: {
      id: params.id,
      category: {
        userId: user.id,
      },
    },
  });

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
  }

  try {
    await prisma.rule.delete({
      where: { id: params.id },
    });

    await createAuditLog({
      action: 'RULE_DELETED',
      userId: user.id,
      entityType: 'rule',
      entityId: params.id,
      details: { name: rule.name },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete rule', details: error.message },
      { status: 500 }
    );
  }
}
