#!/usr/bin/env node

/**
 * Darpan ("Kaari Studio") E2E Test Runner
 * 
 * Executes opaque-box end-to-end tests across Tiers 1-4 per TEST_INFRA.md:
 * - Tier 1: Feature Coverage (33 features × 5 tests = 165 tests)
 * - Tier 2: Boundary & Corner Cases (33 features × 5 tests = 165 tests)
 * - Tier 3: Cross-Feature Combinations (33 pairwise tests)
 * - Tier 4: Real-World Workload Scenarios (5 user workflows)
 * 
 * Usage:
 *   node scripts/e2e-runner.mjs
 *   node scripts/e2e-runner.mjs --tier=1
 *   node scripts/e2e-runner.mjs --tier=2
 *   node scripts/e2e-runner.mjs --tier=3
 *   node scripts/e2e-runner.mjs --tier=4
 *   node scripts/e2e-runner.mjs --verbose
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GOLD = '\x1b[38;5;220m';
const BG_DARK = '\x1b[48;5;235m';

const TIERS = [
  {
    id: 1,
    file: 'tests/e2e/tier1-features.test.mjs',
    name: 'Tier 1: Feature Coverage',
    targetCount: 165,
    description: 'Happy path verification across all 33 cataloged features (≥5 tests per feature)',
  },
  {
    id: 2,
    file: 'tests/e2e/tier2-boundaries.test.mjs',
    name: 'Tier 2: Boundary & Corner Cases',
    targetCount: 165,
    description: 'Boundary value analysis, edge conditions & error recovery (≥5 tests per feature)',
  },
  {
    id: 3,
    file: 'tests/e2e/tier3-pairwise.test.mjs',
    name: 'Tier 3: Cross-Feature Combinations',
    targetCount: 33,
    description: 'Pairwise combinatorial interaction testing between subsystems',
  },
  {
    id: 4,
    file: 'tests/e2e/tier4-scenarios.test.mjs',
    name: 'Tier 4: Real-World Workload Scenarios',
    targetCount: 5,
    description: 'Realistic end-to-end user workflows and customer journeys',
  },
];

function parseArgs() {
  const args = process.argv.slice(2);
  let selectedTier = null;
  let verbose = false;
  let help = false;

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true;
    } else if (arg.startsWith('--tier=')) {
      const val = arg.split('=')[1];
      if (val === 'all') {
        selectedTier = null;
      } else {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
          selectedTier = parsed;
        } else {
          console.error(`${RED}Invalid tier specified: ${val}. Must be 1, 2, 3, or 4.${RESET}`);
          process.exit(1);
        }
      }
    }
  }

  return { selectedTier, verbose, help };
}

function printHelp() {
  console.log(`
${GOLD}${BOLD}Darpan ("Kaari Studio") E2E Test Runner${RESET}

${BOLD}USAGE:${RESET}
  node scripts/e2e-runner.mjs [options]
  npm run test:e2e [-- [options]]

${BOLD}OPTIONS:${RESET}
  --tier=1        Run only Tier 1: Feature Coverage (165 tests)
  --tier=2        Run only Tier 2: Boundary & Corner Cases (165 tests)
  --tier=3        Run only Tier 3: Cross-Feature Combinations (33 tests)
  --tier=4        Run only Tier 4: Real-World Workloads (5 tests)
  --tier=all      Run all tiers (default: 368 tests)
  --verbose, -v   Show detailed assertions for each test
  --help, -h      Display this help dialog
`);
}

function runVitestJson(testFilePath) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npx.cmd' : 'npx';
    const args = ['vitest', 'run', '--reporter=json', testFilePath];

    const cmdStr = `${npmCmd} ${args.join(' ')}`;
    const child = spawn(cmdStr, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      // Find JSON block in stdout
      try {
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonStr = stdout.slice(jsonStart, jsonEnd + 1);
          const parsed = JSON.parse(jsonStr);
          resolve({ code, parsed, stdout, stderr });
        } else {
          reject(new Error(`Failed to parse JSON test output:\n${stdout}\n${stderr}`));
        }
      } catch (err) {
        reject(new Error(`Error parsing Vitest JSON output: ${err.message}\nRaw stdout:\n${stdout}\nRaw stderr:\n${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  const { selectedTier, verbose, help } = parseArgs();

  if (help) {
    printHelp();
    process.exit(0);
  }

  console.log(`\n${GOLD}${BOLD}================================================================================${RESET}`);
  console.log(`${GOLD}${BOLD}     DARPAN ("KAARI STUDIO") — OPAQUE-BOX E2E TEST VERIFICATION RUNNER          ${RESET}`);
  console.log(`${GOLD}${BOLD}================================================================================${RESET}`);
  console.log(`${DIM}Root Directory: ${PROJECT_ROOT}${RESET}`);
  console.log(`${DIM}Node Version:   ${process.version}${RESET}`);
  console.log(`${DIM}Timestamp:      ${new Date().toISOString()}${RESET}\n`);

  const activeTiers = selectedTier
    ? TIERS.filter((t) => t.id === selectedTier)
    : TIERS;

  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;
  const startTime = Date.now();

  for (const tier of activeTiers) {
    console.log(`${CYAN}${BOLD}▶ Executing ${tier.name}...${RESET}`);
    console.log(`  ${DIM}${tier.description}${RESET}`);

    try {
      const { code, parsed } = await runVitestJson(tier.file);

      const numTests = parsed.numTotalTests || 0;
      const numPassed = parsed.numPassedTests || 0;
      const numFailed = parsed.numFailedTests || 0;

      totalTests += numTests;
      totalPassed += numPassed;
      totalFailed += numFailed;

      results.push({
        tier,
        numTests,
        numPassed,
        numFailed,
        success: numFailed === 0 && numTests >= tier.targetCount,
        assertionResults: parsed.testResults?.[0]?.assertionResults || [],
      });

      const statusBadge =
        numFailed === 0 && numTests >= tier.targetCount
          ? `${GREEN}${BOLD}✓ PASSED${RESET}`
          : `${RED}${BOLD}✗ FAILED${RESET}`;

      console.log(`  ${statusBadge} ${BOLD}${numPassed}/${numTests}${RESET} tests passed (target: ≥${tier.targetCount})\n`);

      if (verbose) {
        const assertions = parsed.testResults?.[0]?.assertionResults || [];
        for (const test of assertions) {
          const symbol = test.status === 'passed' ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
          console.log(`    ${symbol} ${test.fullName} ${DIM}(${(test.duration || 0).toFixed(1)}ms)${RESET}`);
          if (test.failureMessages && test.failureMessages.length > 0) {
            for (const msg of test.failureMessages) {
              console.log(`      ${RED}${msg}${RESET}`);
            }
          }
        }
        console.log('');
      }
    } catch (err) {
      console.error(`  ${RED}${BOLD}✗ ERROR:${RESET} ${err.message}\n`);
      results.push({
        tier,
        numTests: 0,
        numPassed: 0,
        numFailed: 1,
        success: false,
        error: err.message,
      });
      totalFailed += 1;
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  // Consolidated Executive Summary
  console.log(`${GOLD}${BOLD}================================================================================${RESET}`);
  console.log(`${GOLD}${BOLD}                       E2E EXECUTION REPORT SUMMARY                             ${RESET}`);
  console.log(`${GOLD}${BOLD}================================================================================${RESET}`);
  console.log(`${BOLD}${'Tier'.padEnd(38)} | ${'Target'.padEnd(8)} | ${'Executed'.padEnd(8)} | ${'Passed'.padEnd(8)} | ${'Status'.padEnd(8)}${RESET}`);
  console.log(`---------------------------------------+----------+----------+----------+---------`);

  for (const r of results) {
    const statusStr = r.success ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    console.log(
      `${r.tier.name.padEnd(38)} | ${String(r.tier.targetCount).padEnd(8)} | ${String(r.numTests).padEnd(8)} | ${String(r.numPassed).padEnd(8)} | ${statusStr}`
    );
  }

  console.log(`---------------------------------------+----------+----------+----------+---------`);
  const allGreen = results.every((r) => r.success);
  const totalStatus = allGreen ? `${GREEN}${BOLD}ALL PASS${RESET}` : `${RED}${BOLD}FAILURES${RESET}`;
  console.log(
    `${BOLD}${'TOTAL E2E SUITE'.padEnd(38)} | ${String(activeTiers.reduce((a, b) => a + b.targetCount, 0)).padEnd(8)} | ${String(totalTests).padEnd(8)} | ${String(totalPassed).padEnd(8)} | ${totalStatus}${RESET}`
  );
  console.log(`${GOLD}${BOLD}================================================================================${RESET}`);
  console.log(`Total Duration: ${durationSec}s`);
  console.log(`Final Status:   ${allGreen ? `${GREEN}${BOLD}✓ ALL E2E TIERS VERIFIED CLEANLY (0 REGRESSIONS)${RESET}` : `${RED}${BOLD}✗ VERIFICATION FAILED${RESET}`}`);
  console.log(`${GOLD}${BOLD}================================================================================${RESET}\n`);

  process.exit(allGreen ? 0 : 1);
}

main().catch((err) => {
  console.error(`${RED}Fatal runner exception:${RESET}`, err);
  process.exit(1);
});
