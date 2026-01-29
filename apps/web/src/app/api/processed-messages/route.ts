// =============================================================================
// Processed Messages API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/processed-messages - List processed messages
 */
export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('connectionId');
  const needsReview = searchParams.get('needsReview');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');

  const where: any = {
    connection: {
      userId: user.id,
    },
  };

  if (connectionId) {
    where.connectionId = connectionId;
  }

  if (needsReview !== null) {
    where.needsReview = needsReview === 'true';
  }

  const [total, messages] = await Promise.all([
    prisma.processedMessage.count({ where }),
    prisma.processedMessage.findMany({
      where,
      include: {
        connection: {
          select: {
            provider: true,
            email: true,
          },
        },
        category: {
          select: {
            name: true,
            internalCode: true,
            color: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    messages,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
