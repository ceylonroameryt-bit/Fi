/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const rawApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
    if (!rawApiUrl) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          'CRITICAL CONFIGURATION NOTICE: Neither API_URL nor NEXT_PUBLIC_API_URL is configured for production backend proxy. Defaulting to same-host /api/v1.',
        );
      }
      return [
        {
          source: '/api/v1/:path*',
          destination: 'http://localhost:4000/api/v1/:path*',
        },
      ];
    }
    const cleanApiUrl = rawApiUrl.replace(/\/$/, '').replace(/\/api\/v1$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${cleanApiUrl}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
