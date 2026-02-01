/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'imapflow'],
  },
  // Reduce memory usage during build
  swcMinify: true,
  // Disable source maps in production to reduce memory
  productionBrowserSourceMaps: false,
  // Disable TypeScript type checking during build (handled separately)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize webpack for lower memory usage
  webpack: (config, { isServer }) => {
    // Reduce memory usage
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      minimize: true,
    };

    // Reduce parallelism to save memory
    config.parallelism = 1;

    return config;
  },
};

module.exports = nextConfig;
