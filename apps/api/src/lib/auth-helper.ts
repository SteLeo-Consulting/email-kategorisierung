// =============================================================================
// Auth Helper - Supports localStorage-based authentication via email query param
// =============================================================================

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  error: string | null;
}

/**
 * Get the authenticated user from email query param
 * This supports IMAP users authenticated via localStorage
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  // Get email from query param (for localStorage-based auth)
  const userEmail = request.nextUrl.searchParams.get('email');

  if (!userEmail) {
    return { user: null, error: 'Unauthorized' };
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail.toLowerCase() },
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  if (!user) {
    return { user: null, error: 'User not found' };
  }

  return { user, error: null };
}
