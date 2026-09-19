// Runs every Playwright browser check in tests/*.browser.ts sequentially.
// Requires a running server: dev server for the whole suite (audio/occlusion import source modules),
// or a preview build when only the static-game checks are needed.
// Usage: GAME_URL=http://localhost:5173/thronefall-zombies/ node scripts/browser-tests.ts [filter]
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';

const filter = process.argv[2];
const files = (await readdir('tests'))
  .filter((name) => name.endsWith('.browser.ts'))
  .filter((name) => !filter || name.includes(filter))
  .sort();

if (files.length === 0) {
  console.error(`no browser tests matched "${filter ?? '*'}"`);
  process.exit(1);
}

console.log(
  `GAME_URL=${process.env.GAME_URL ?? 'http://localhost:5173/thronefall-zombies/ (default)'}`,
);
const failures: string[] = [];
for (const file of files) {
  process.stdout.write(`\n=== ${file} ===\n`);
  const code = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, [`tests/${file}`], { stdio: 'inherit' });
    child.on('close', (value) => resolve(value ?? 1));
  });
  if (code === 0) console.log(`PASS ${file}`);
  else failures.push(file);
}

console.log(`\n${files.length - failures.length}/${files.length} browser tests passed`);
if (failures.length) {
  console.error(`failed: ${failures.join(', ')}`);
  process.exit(1);
}
