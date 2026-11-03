/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true
  },
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
    if (!backendUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
