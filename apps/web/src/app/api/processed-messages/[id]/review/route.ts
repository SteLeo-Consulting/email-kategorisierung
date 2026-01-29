// =============================================================================
// Review Processed Message API Route
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/services/audit';
import { createProviderFromConnection } from '@/lib/providers';
import { DEFAULT_LABEL_NAMES } from '@/lib/shared';

export const runtime = 'nodejs';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/processed-messages/[id]/review - Review and update classification
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const message = await prisma.processedMessage.findFirst({
    where: {
      id: params.id,
      connection: {
        userId: user.id,
      },
    },
    include: {
      connection: true,
      category: true,
    },
  });

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { action, newCategoryId } = body;

    // action: "approve" | "change" | "reject"

    if (action === 'approve') {
      // Keep the current classification
      await prisma.processedMessage.update({
        where: { id: params.id },
        data: {
          needsReview: false,
          reviewedAt: new Date(),
          reviewedAction: 'approved',
        },
      });
    } else if (action === 'change' && newCategoryId) {
      // Change to a different category
      const newCategory = await prisma.category.findFirst({
        where: {
          id: newCategoryId,
          userId: user.id,
        },
      });

      if (!newCategory) {
        return NextResponse.json(
          { error: 'New category not found' },
          { status: 404 }
        );
      }

      // Apply the new label
      const provider = await createProviderFromConnection(message.connectionId);

      try {
        // Get label mapping or use default
        const mapping = await prisma.labelMapping.findUnique({
          where: {
            categoryId_connectionId: {
              categoryId: newCategoryId,
              connectionId: message.connectionId,
            },
          },
        });

        const labelName =
          mapping?.providerLabel ||
          DEFAULT_LABEL_NAMES[newCategory.internalCode as keyof typeof DEFAULT_LABEL_NAMES];

        // Create label if needed and apply
        const label = await provider.getOrCreateLabel(labelName);
        await provider.applyLabel(message.messageId, label.id);

        // Remove old label if it exists
        if (message.labelApplied) {
          try {
            await provider.removeLabel(message.messageId, message.labelApplied);
          } catch {
            // Ignore removal errors
          }
        }

        await provider.disconnect();

        // Update the record
        await prisma.processedMessage.update({
          where: { id: params.id },
          data: {
            categoryId: newCategoryId,
            labelApplied: label.id,
            needsReview: false,
            reviewedAt: new Date(),
            reviewedAction: 'changed',
          },
        });
      } finally {
        await provider.disconnect();
      }
    } else if (action === 'reject') {
      // Remove the label entirely
      const provider = await createProviderFromConnection(message.connectionId);

      try {
        if (message.labelApplied) {
          await provider.removeLabel(message.messageId, message.labelApplied);
        }
        await provider.disconnect();
      } catch {
        // Ignore removal errors
      }

      await prisma.processedMessage.update({
        where: { id: params.id },
        data: {
          categoryId: null,
          labelApplied: null,
          needsReview: false,
          reviewedAt: new Date(),
          reviewedAction: 'rejected',
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    await createAuditLog({
      action: 'EMAIL_REVIEWED',
      userId: user.id,
      entityType: 'message',
      entityId: params.id,
      details: {
        action,
        newCategoryId,
        originalCategoryId: message.categoryId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to review message', details: error.message },
      { status: 500 }
    );
  }
}
