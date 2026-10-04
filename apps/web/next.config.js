/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const rawApiUrl =
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://fi-46xw.onrender.com' : 'http://localhost:4000');
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
