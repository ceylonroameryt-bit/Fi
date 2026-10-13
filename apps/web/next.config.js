/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    let rawApiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;

    // In AWS cloud deployments, proxy to AWS App Runner API backend.
    const isCloudEnv = Boolean(process.env.AWS_EXECUTION_ENV || process.env.NODE_ENV === 'production');
    const isLocalhost = !rawApiUrl || rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1');

    if (isCloudEnv && isLocalhost) {
      rawApiUrl = 'https://arpi2ujw2t.eu-west-2.awsapprunner.com';
    } else if (!rawApiUrl) {
      rawApiUrl = isCloudEnv ? 'https://arpi2ujw2t.eu-west-2.awsapprunner.com' : 'http://localhost:4000';
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
