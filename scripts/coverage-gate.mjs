import { spawnSync } from 'node:child_process';

const THRESHOLDS = {
  line: 94,
  branch: 80,
  funcs: 88.5,
};

const run = spawnSync('npm', ['run', 'test:coverage'], {
  encoding: 'utf8',
  stdio: 'pipe',
});

const output = `${run.stdout || ''}${run.stderr || ''}`;
process.stdout.write(output);

if (run.status !== 0) {
  process.exit(run.status || 1);
}

const summaryLine = output
  .split('\n')
  .find((line) => line.includes('all files') && line.includes('|'));

if (!summaryLine) {
  console.error('Coverage gate failed: could not find "all files" summary line.');
  process.exit(1);
}

const columns = summaryLine
  .split('|')
  .map((part) => part.trim())
  .filter(Boolean);

const [lineStr, branchStr, funcsStr] = columns.slice(1, 4);
const linePct = Number.parseFloat(lineStr);
const branchPct = Number.parseFloat(branchStr);
const funcsPct = Number.parseFloat(funcsStr);

const failures = [];
if (linePct < THRESHOLDS.line) failures.push(`line ${linePct}% < ${THRESHOLDS.line}%`);
if (branchPct < THRESHOLDS.branch) failures.push(`branch ${branchPct}% < ${THRESHOLDS.branch}%`);
if (funcsPct < THRESHOLDS.funcs) failures.push(`funcs ${funcsPct}% < ${THRESHOLDS.funcs}%`);

if (failures.length > 0) {
  console.error(`Coverage gate failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(
  `Coverage gate passed: line ${linePct}%, branch ${branchPct}%, funcs ${funcsPct}%.`,
);
