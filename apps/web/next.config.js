/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Standalone output for smaller builds
  output: 'standalone',
  // External packages to reduce bundle
  serverExternalPackages: ['@prisma/client', 'imapflow'],
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
  // Optimize images
  images: {
    unoptimized: true,
  },
  // Optimize webpack for lower memory usage
  webpack: (config, { isServer, dev }) => {
    // Only optimize in production
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        minimize: true,
        // Disable some memory-intensive optimizations
        splitChunks: isServer ? false : {
          chunks: 'async',
          minSize: 30000,
          maxAsyncRequests: 5,
          maxInitialRequests: 3,
        },
      };

      // Reduce parallelism to save memory
      config.parallelism = 1;

      // Reduce cache size
      config.cache = {
        type: 'memory',
        maxMemoryGenerations: 1,
      };
    }

    return config;
  },
};

module.exports = nextConfig;
