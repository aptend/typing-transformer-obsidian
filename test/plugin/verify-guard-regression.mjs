import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

// Run only in the disposable CI checkout, after the unchanged suite passes.
// A deliberate reintroduction of #124 must be detected by its regression test.
assert.equal(process.env.CI, 'true', 'Mutation verification is restricted to CI');
await mkdir('artifacts/e2e', { recursive: true });
const path = 'src/main.ts';
const source = await readFile(path, 'utf8');
const guard = "if (!update.transactions.some(tr => tr.isUserEvent('input'))) { return; }";
assert.equal(source.split(guard).length, 2, 'Expected one production input-event guard');
const report = 'artifacts/e2e/guard-mutation.json';
try {
  await writeFile(path, source.replace(guard, '// Deliberate CI mutation: remove the input-event guard.'));
  const result = spawnSync(process.execPath, [
    'node_modules/vitest/vitest.mjs', 'run', '--project', 'plugin',
    '-t', 'ignores a structural/undo/redo update', '--reporter=json', `--outputFile=${report}`,
  ], { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 1, `Mutated suite must fail with an assertion: ${result.stderr}`);
  const output = JSON.parse(await readFile(report, 'utf8'));
  const failures = output.testResults.flatMap(test => test.assertionResults)
    .filter(test => test.status === 'failed' && test.fullName.includes('ignores a structural/undo/redo update'));
  assert.ok(failures.length > 0, 'Failure must come from the event guard assertion, not test infrastructure');
  console.log(`Mutation verification passed: removing the production guard caused ${failures.length} regression assertion(s) to fail.`);
} finally {
  await writeFile(path, source);
}
