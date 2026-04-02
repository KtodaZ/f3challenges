import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable static export compatibility for PWA assets
  reactStrictMode: true,
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
