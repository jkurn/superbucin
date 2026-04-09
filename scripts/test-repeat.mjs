import { spawnSync } from 'node:child_process';

const RUNS = 3;
const codes = [];

for (let i = 1; i <= RUNS; i += 1) {
  console.log(`\n--- test:repeat run ${i}/${RUNS} ---\n`);
  const result = spawnSync('npm', ['test'], {
    stdio: 'inherit',
    env: process.env,
  });
  codes.push(result.status ?? 1);
}

const unique = new Set(codes);
if (unique.size !== 1) {
  console.error(`test:repeat: inconsistent exit codes across runs: [${codes.join(', ')}]`);
  process.exit(1);
}

process.exit(codes[0] === 0 ? 0 : codes[0]);
