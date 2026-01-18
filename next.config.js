/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Enable compression for better bandwidth usage
  compress: true,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    qualities: [50, 75, 90, 100],
  },
  
  // ✅ Add cache headers for static assets
  async headers() {
    return [
      {
        source: '/:all*(svg|jpg|jpeg|png|gif|ico|webp)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
    ];
  },
  
  // Empty turbopack config to silence warning
  turbopack: {},
  // Strict mode for better error detection
  reactStrictMode: true,
  // Type checking during build
  typescript: {
    ignoreBuildErrors: false,
  },
  // Note: ESLint config is no longer supported in next.config.js
  // Use 'next lint' command or configure in .eslintrc.json instead
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
}

module.exports = nextConfig