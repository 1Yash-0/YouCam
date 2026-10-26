import type { NextConfig } from 'next'
import { loadEnvConfig } from '@next/env'

// Load environment variables from parent directory
const projectDir = process.cwd()
loadEnvConfig(projectDir)

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true, // We'll handle our own image optimization
  },
  serverExternalPackages: ['sharp'],
  outputFileTracingIncludes: {
    '/*': ['./data/products.json'],
    '/api/tryon': ['./public/products/**/*'],
    '/api/tryon/*': ['./public/products/**/*'],
    '/api/products/*/image': ['./public/products/**/*'],
  },
  outputFileTracingExcludes: {
    '/*': ['./.env*', '../.env*', './.test-data/**/*', '../.data/**/*', '../outputs/**/*'],
  },
}

export default nextConfig
