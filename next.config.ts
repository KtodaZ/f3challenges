import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@f3-bedrock/shared'],
  // Headers for FCM service worker scope
  async headers() {
    return [
      {
        source: '/firebase-messaging-sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
    ]
  },
}

export default nextConfig
