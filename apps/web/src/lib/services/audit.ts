// =============================================================================
// Audit Service
// =============================================================================

import type { AuditAction } from '@email-cat/shared';
import { prisma } from '../prisma';

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: entry.action,
      userId: entry.userId,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details: entry.details,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    },
  });
}

/**
 * Get audit logs with pagination
 */
export async function getAuditLogs(options: {
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const {
    userId,
    action,
    entityType,
    from,
    to,
    page = 1,
    pageSize = 50,
  } = options;

  const where: any = {};

  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    }),
  ]);

  return {
    logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Log a cron run
 */
export async function logCronRun(
  status: 'started' | 'completed' | 'failed',
  details?: Record<string, any>
): Promise<void> {
  const actionMap: Record<string, AuditAction> = {
    started: 'CRON_RUN_STARTED',
    completed: 'CRON_RUN_COMPLETED',
    failed: 'CRON_RUN_FAILED',
  };

  await createAuditLog({
    action: actionMap[status],
    entityType: 'cron',
    details,
  });
}
