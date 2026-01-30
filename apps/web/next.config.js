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
  // Optimize webpack for lower memory usage
  webpack: (config, { isServer }) => {
    // Reduce memory usage
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      splitChunks: isServer ? false : {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        cacheGroups: {
          default: false,
          vendors: false,
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
          },
        },
      },
    };
    return config;
  },
};

module.exports = nextConfig;
