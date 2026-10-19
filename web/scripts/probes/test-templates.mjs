#!/usr/bin/env node

import { request } from './lib.mjs'

async function main() {
  console.log('Testing template endpoint...')
  
  // Test without pagination first
  const result1 = await request('GET', '/s2s/v2.1/task/template/hair-transfer')
  console.log('Result without params:', result1.status, result1.data)
  
  // Test with page_size only
  const result2 = await request('GET', '/s2s/v2.1/task/template/hair-transfer?page_size=10')
  console.log('\nResult with page_size=10:', result2.status, result2.data)
  
  // Test v2.0 endpoint
  const result3 = await request('GET', '/s2s/v2.0/task/template/hair-transfer')
  console.log('\nResult v2.0:', result3.status, result3.data)
}

main().catch(console.error)