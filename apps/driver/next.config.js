/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '/driver',
  trailingSlash: false,
  reactStrictMode: true,
  transpilePackages: ['@vibe-taxi/database'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
