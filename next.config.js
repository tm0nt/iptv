/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: 'http',  hostname: '**' },
      { protocol: 'https', hostname: '**' },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
  },

  // Increase body size limit for M3U file uploads (up to 200MB per file)
  experimental: {
    serverActions: {
      bodySizeLimit: '210mb',
    },
    optimizePackageImports: ['lucide-react', 'recharts'],
  },

  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Content-Type', value: 'application/javascript' },
        ],
      },
      {
        source: '/api/stream/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store' }],
      },
      {
        source: '/api/ts/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store' }],
      },
    ]
  },
}

module.exports = nextConfig
