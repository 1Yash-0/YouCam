#!/usr/bin/env node

import { getCreditBalance } from './lib.mjs'

async function main() {
  try {
    const balance = await getCreditBalance()
    console.log(`Current credit balance: ${balance} units`)
    return balance
  } catch (error) {
    console.error(`Error checking balance: ${error.message}`)
    throw error
  }
}

main().catch(console.error)