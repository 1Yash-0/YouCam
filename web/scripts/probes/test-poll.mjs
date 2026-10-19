#!/usr/bin/env node

import { request } from './lib.mjs'

async function main() {
  // Test polling a known task ID (from the failed attempt)
  const taskId = 'kr5KvRjceIBnoxbstIUWZKP1eyxy8VtwKtViAEuNNjf1y8BXalMoDyWEX4SNT7JUrsVEnq3ffBAO2Lf_ZLul6Q'
  const result = await request('GET', `/s2s/v2.0/task/2d-vto/earring/${taskId}`)
  console.log('Full response:', JSON.stringify(result, null, 2))
}

main().catch(console.error)