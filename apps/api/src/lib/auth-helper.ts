// =============================================================================
// Auth Helper - Supports both NextAuth and localStorage-based authentication
// =============================================================================

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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
 * Get the authenticated user from either NextAuth session or email query param
 * This supports both OAuth users (via NextAuth) and IMAP users (via localStorage)
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthResult> {
  let userEmail: string | null = null;

  // Try NextAuth session first
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    userEmail = session.user.email;
  }

  // If no NextAuth session, try to get email from query param (for localStorage-based auth)
  if (!userEmail) {
    userEmail = request.nextUrl.searchParams.get('email');
  }

  if (!userEmail) {
    return { user: null, error: 'Unauthorized' };
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
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

/**
 * Simple version for routes that don't have NextRequest
 * Only checks NextAuth session - used by GET routes without request parameter
 */
export async function getSessionUser(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { user: null, error: 'Unauthorized' };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
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
