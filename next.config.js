/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
    outputFileTracingIncludes: {
      '/api/export-slide': ['./node_modules/@sparticuz/chromium/bin/**'],
    },
  },
}

module.exports = nextConfig