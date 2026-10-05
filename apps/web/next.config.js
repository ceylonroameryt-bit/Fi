/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    let rawApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

    // In cloud environments (like Vercel), proxying to localhost causes DNS_HOSTNAME_RESOLVED_PRIVATE.
    // Fallback to the production Render backend service if API_URL is unset or contains localhost.
    const isCloudEnv = Boolean(process.env.VERCEL || process.env.RENDER || process.env.NODE_ENV === 'production');
    const isLocalhost = !rawApiUrl || rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1');

    if (isCloudEnv && isLocalhost) {
      rawApiUrl = 'https://ledgerline-api.onrender.com';
    } else if (!rawApiUrl) {
      rawApiUrl = 'http://localhost:4000';
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
