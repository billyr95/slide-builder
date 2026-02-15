/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@napi-rs/canvas'],
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [...(config.externals || []), '@napi-rs/canvas']
    }
    // Handle .node native binaries
    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
    })
    return config
  },
}

module.exports = nextConfig