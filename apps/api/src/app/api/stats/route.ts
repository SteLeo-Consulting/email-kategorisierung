// =============================================================================
// Statistics API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/**
 * GET /api/stats - Get dashboard statistics
 */
export async function GET(request: NextRequest) {
  // Get email from query param (for localStorage-based auth)
  const userEmail = request.nextUrl.searchParams.get('email');

  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase() },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get various statistics
  const [
    connections,
    categories,
    rules,
    processedToday,
    processedTotal,
    needsReview,
    categoryBreakdown,
    recentActivity,
  ] = await Promise.all([
    // Connection counts by status
    prisma.connection.groupBy({
      by: ['status'],
      where: { userId: user.id },
      _count: true,
    }),

    // Total categories
    prisma.category.count({
      where: { userId: user.id, isActive: true },
    }),

    // Total rules
    prisma.rule.count({
      where: {
        category: { userId: user.id },
        isActive: true,
      },
    }),

    // Processed today
    prisma.processedMessage.count({
      where: {
        connection: { userId: user.id },
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),

    // Total processed
    prisma.processedMessage.count({
      where: {
        connection: { userId: user.id },
      },
    }),

    // Needs review count
    prisma.processedMessage.count({
      where: {
        connection: { userId: user.id },
        needsReview: true,
      },
    }),

    // Category breakdown
    prisma.processedMessage.groupBy({
      by: ['categoryId'],
      where: {
        connection: { userId: user.id },
        categoryId: { not: null },
      },
      _count: true,
    }),

    // Recent audit activity
    prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        action: true,
        entityType: true,
        createdAt: true,
      },
    }),
  ]);

  // Get category names for breakdown
  const categoryIds = categoryBreakdown.map((c: any) => c.categoryId).filter(Boolean) as string[];
  const categoryNames = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, color: true },
  });

  const categoryMap = new Map<string, { name: string; color: string }>(
    categoryNames.map((c: any) => [c.id, { name: c.name, color: c.color }])
  );

  return NextResponse.json({
    connections: {
      total: connections.reduce((sum: number, c: any) => sum + c._count, 0),
      active: connections.find((c: any) => c.status === 'ACTIVE')?._count || 0,
      error: connections.find((c: any) => c.status === 'ERROR')?._count || 0,
      needsReauth: connections.find((c: any) => c.status === 'NEEDS_REAUTH')?._count || 0,
    },
    categories,
    rules,
    processed: {
      today: processedToday,
      total: processedTotal,
    },
    needsReview,
    categoryBreakdown: categoryBreakdown.map((c: any) => ({
      categoryId: c.categoryId,
      categoryName: categoryMap.get(c.categoryId!)?.name || 'Unknown',
      color: categoryMap.get(c.categoryId!)?.color || '#6366f1',
      count: c._count,
    })),
    recentActivity,
  });
}
