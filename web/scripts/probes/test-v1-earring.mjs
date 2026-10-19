#!/usr/bin/env node

import { request } from './lib.mjs'

async function main() {
  console.log('Testing V1.0 earring endpoint...')
  
  // Test if V1.0 endpoint exists
  const result = await request('GET', '/s2s/v1.0/task/2d-vto/earring')
  console.log('V1.0 endpoint test:', result.status, result.data)
  
  // Test V2.0 endpoint for comparison
  const result2 = await request('GET', '/s2s/v2.0/task/2d-vto/earring')
  console.log('\nV2.0 endpoint test:', result2.status, result2.data)
}

main().catch(console.error)