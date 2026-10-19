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
}

export default nextConfig