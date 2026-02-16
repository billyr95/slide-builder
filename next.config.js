/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@napi-rs/canvas'],
  webpack(config, { isServer }) {
    if (!isServer) {
      // Stub out @napi-rs/canvas on the client only
      config.resolve.alias = {
        ...config.resolve.alias,
        '@napi-rs/canvas': false,
      }
      // Prevent .node files from erroring on client
      config.module.rules.push({
        test: /\.node$/,
        use: 'null-loader',
      })
    } else {
      config.externals = [...(config.externals || []), '@napi-rs/canvas']
      config.module.rules.push({
        test: /\.node$/,
        use: 'node-loader',
      })
    }
    return config
  },
}

module.exports = nextConfig