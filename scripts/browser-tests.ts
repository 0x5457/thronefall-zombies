// Runs every Playwright browser check in tests/*.browser.ts with a worker pool.
// Requires a running server: dev server for the whole suite (audio/occlusion import source modules),
// or a preview build when only the static-game checks are needed.
// Usage: GAME_URL=http://localhost:5173/thronefall-zombies/ node scripts/browser-tests.ts [filter]
// Filter matches file names and accepts a comma-separated list, e.g. "campaign,save".
// Override the worker count with TEST_CONCURRENCY=<n>.
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const filters = (process.argv[2] ?? '').split(',').filter(Boolean);
const files = (await readdir('tests'))
  .filter((name) => name.endsWith('.browser.ts'))
  .filter((name) => filters.length === 0 || filters.some((filter) => name.includes(filter)))
  .sort();

if (files.length === 0) {
  console.error(`no browser tests matched "${filters.join(',') || '*'}"`);
  process.exit(1);
}

const concurrency = Math.max(
  1,
  Math.min(files.length, Math.floor(Number(process.env.TEST_CONCURRENCY)) || 3),
);
console.log(
  `GAME_URL=${process.env.GAME_URL ?? 'http://localhost:5173/thronefall-zombies/ (default)'} · concurrency ${concurrency}`,
);

function run(file: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [`tests/${file}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk));
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

const queue = [...files];
const failures: string[] = [];
async function worker(): Promise<void> {
  for (;;) {
    const file = queue.shift();
    if (!file) return;
    process.stdout.write(`\n=== ${file} ===\n`);
    const started = Date.now();
    const { code, output } = await run(file);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    if (output) process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
    if (code === 0) console.log(`PASS ${file} (${seconds}s)`);
    else {
      failures.push(file);
      console.error(`FAIL ${file} (${seconds}s)`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));

console.log(`\n${files.length - failures.length}/${files.length} browser tests passed`);
if (failures.length) {
  console.error(`failed: ${failures.sort().join(', ')}`);
  process.exit(1);
}
