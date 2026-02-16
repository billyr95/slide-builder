/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas'],
  },
  webpack(config, { isServer }) {
    // Handle .node files differently for client vs server
    config.module.rules.push({
      test: /\.node$/,
      use: isServer ? 'node-loader' : 'null-loader',
    })
    
    return config
  },
}

module.exports = nextConfig