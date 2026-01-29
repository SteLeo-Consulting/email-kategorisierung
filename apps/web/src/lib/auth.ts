import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { prisma } from './prisma';
import { GMAIL_SCOPES, OUTLOOK_SCOPES } from '@email-cat/shared';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: ['openid', 'email', 'profile', ...GMAIL_SCOPES].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: 'common', // Allow personal and work accounts
      authorization: {
        params: {
          scope: ['openid', 'email', 'profile', ...OUTLOOK_SCOPES].join(' '),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) return false;

      try {
        // Create or update user
        const dbUser = await prisma.user.upsert({
          where: { email: user.email },
          update: {
            name: user.name,
            image: user.image,
          },
          create: {
            email: user.email,
            name: user.name,
            image: user.image,
          },
        });

        // Store the account as a connection + oauth token
        const provider = account.provider === 'google' ? 'GMAIL' : 'OUTLOOK';

        // Create or update connection
        const connection = await prisma.connection.upsert({
          where: {
            userId_provider_email: {
              userId: dbUser.id,
              provider,
              email: user.email,
            },
          },
          update: {
            status: 'ACTIVE',
            lastError: null,
            displayName: user.name,
          },
          create: {
            userId: dbUser.id,
            provider,
            email: user.email,
            displayName: user.name,
            status: 'ACTIVE',
          },
        });

        // Import encryption functions dynamically to avoid issues with edge runtime
        const { encrypt } = await import('@email-cat/shared');

        // Store OAuth tokens (encrypted)
        await prisma.oAuthToken.upsert({
          where: { connectionId: connection.id },
          update: {
            accessToken: encrypt(account.access_token!),
            refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
            expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
            scope: account.scope,
            tokenType: account.token_type,
          },
          create: {
            connectionId: connection.id,
            accessToken: encrypt(account.access_token!),
            refreshToken: account.refresh_token ? encrypt(account.refresh_token) : null,
            expiresAt: account.expires_at ? new Date(account.expires_at * 1000) : null,
            scope: account.scope,
            tokenType: account.token_type,
          },
        });

        // Log the connection
        await prisma.auditLog.create({
          data: {
            userId: dbUser.id,
            action: 'CONNECTION_CREATED',
            entityType: 'connection',
            entityId: connection.id,
            details: { provider, email: user.email },
          },
        });

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        // Fetch user from database
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email! },
        });
        if (dbUser) {
          (session.user as any).id = dbUser.id;
        }
      }
      return session;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
