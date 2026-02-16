/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@napi-rs/canvas'],
  webpack(config, { isServer }) {
    config.module.rules.push({
      test: /\.node$/,
      use: isServer ? 'node-loader' : 'null-loader',
    })
    return config
  },
}

module.exports = nextConfig