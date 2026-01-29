/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@email-cat/shared'],
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'imapflow'],
  },
};

module.exports = nextConfig;
