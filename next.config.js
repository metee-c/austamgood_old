/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
    qualities: [50, 75, 90, 100],
  },
  // Enable Turbopack (Next.js 16 default)
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