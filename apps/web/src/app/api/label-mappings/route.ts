// =============================================================================
// Label Mappings API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CreateLabelMappingSchema } from '@/lib/shared';
import { createAuditLog } from '@/lib/services/audit';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';

/**
 * GET /api/label-mappings - List label mappings
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('connectionId');

  const mappings = await prisma.labelMapping.findMany({
    where: {
      connection: {
        userId: user.id,
      },
      ...(connectionId && { connectionId }),
    },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          internalCode: true,
          color: true,
        },
      },
      connection: {
        select: {
          id: true,
          provider: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ mappings });
}

/**
 * POST /api/label-mappings - Create or update label mapping
 */
export async function POST(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const parsed = CreateLabelMappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Verify category and connection belong to user
    const [category, connection] = await Promise.all([
      prisma.category.findFirst({
        where: {
          id: parsed.data.categoryId,
          userId: user.id,
        },
      }),
      prisma.connection.findFirst({
        where: {
          id: parsed.data.connectionId,
          userId: user.id,
        },
      }),
    ]);

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Upsert the mapping
    const mapping = await prisma.labelMapping.upsert({
      where: {
        categoryId_connectionId: {
          categoryId: parsed.data.categoryId,
          connectionId: parsed.data.connectionId,
        },
      },
      update: {
        providerLabel: parsed.data.providerLabel,
        labelType: parsed.data.labelType,
        autoCreate: parsed.data.autoCreate ?? true,
      },
      create: {
        categoryId: parsed.data.categoryId,
        connectionId: parsed.data.connectionId,
        providerLabel: parsed.data.providerLabel,
        labelType: parsed.data.labelType,
        autoCreate: parsed.data.autoCreate ?? true,
      },
      include: {
        category: {
          select: {
            name: true,
            internalCode: true,
          },
        },
        connection: {
          select: {
            provider: true,
            email: true,
          },
        },
      },
    });

    await createAuditLog({
      action: 'LABEL_MAPPING_CREATED',
      userId: user.id,
      entityType: 'label_mapping',
      entityId: mapping.id,
      details: {
        categoryId: parsed.data.categoryId,
        connectionId: parsed.data.connectionId,
        providerLabel: parsed.data.providerLabel,
      },
    });

    return NextResponse.json({ mapping });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to create mapping', details: error.message },
      { status: 500 }
    );
  }
}
