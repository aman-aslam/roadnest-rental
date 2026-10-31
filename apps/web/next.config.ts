import type { NextConfig } from 'next';

const apiOrigin = (process.env.API_ORIGIN || 'http://localhost:4000').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
      {
        source: '/vehicle-images/:path*',
        destination: `${apiOrigin}/vehicle-images/:path*`,
      },
    ];
  },
};

export default nextConfig;
