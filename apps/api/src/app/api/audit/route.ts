// =============================================================================
// Audit Log API Routes
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/services/audit';
import { getAuthenticatedUser } from '@/lib/auth-helper';

export const runtime = 'nodejs';

/**
 * GET /api/audit - List audit logs
 */
export async function GET(request: NextRequest) {
  const { user, error } = await getAuthenticatedUser(request);

  if (!user) {
    return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') as any;
  const entityType = searchParams.get('entityType');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');

  const result = await getAuditLogs({
    userId: user.id,
    action: action || undefined,
    entityType: entityType || undefined,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    page,
    pageSize,
  });

  return NextResponse.json(result);
}
