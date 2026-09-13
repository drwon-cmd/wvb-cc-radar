const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { mkdtempSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// Compile with the installed TypeScript version; tests also work on Node 18.
const temporary = mkdtempSync(path.join(os.tmpdir(), 'cc-radar-test-'));
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'),
  'lib/digest-store.ts', '--outDir', temporary, '--module', 'commonjs',
  '--target', 'ES2022', '--moduleResolution', 'node', '--esModuleInterop',
  '--skipLibCheck', '--strict'], { cwd: path.join(__dirname, '..') });
const { createDigestStore, firstReadableDigest, isDigestDate, isValidDigest } =
  require(path.join(temporary, 'digest-store.js'));
after(() => fs.rm(temporary, { recursive: true, force: true }));

test('dates reject traversal and impossible calendar dates', () => {
  for (const date of ['../2026-09-01', '2026-02-29', '2026-13-01', '2026-9-01', '2026-09-01/..']) {
    assert.equal(isDigestDate(date), false, date);
  }
  assert.equal(isDigestDate('2024-02-29'), true);
});

test('envelope validation preserves historical snapshots', () => {
  assert.equal(isValidDigest({ date: '2026-09-01', categories: [{ category: 'ai-agents', items: [] }] }), true);
  for (const value of [null, [], {}, { date: '2026-09-01', categories: [null] },
    { date: '2026-09-01', categories: [{ category: 'ai-agents', items: {} }] }]) {
    assert.equal(isValidDigest(value), false);
  }
});

test('store lists snapshots and skips corrupt or mismatched dates', async () => {
  const directory = await fs.mkdtemp(path.join(temporary, 'data-'));
  const valid = date => JSON.stringify({ date, categories: [] });
  await Promise.all([
    fs.writeFile(path.join(directory, '2026-09-05.json'), '{'),
    fs.writeFile(path.join(directory, '2026-09-04.json'), valid('2026-09-03')),
    fs.writeFile(path.join(directory, '2026-09-03.json'), valid('2026-09-03')),
    fs.writeFile(path.join(directory, '2026-09-02.json'), '{}'),
    fs.writeFile(path.join(directory, '2026-09-01.json'), valid('2026-09-01')),
    fs.writeFile(path.join(directory, '2026-02-30.json'), '{}'),
    fs.writeFile(path.join(directory, 'korean-owners.json'), '[]'),
    fs.mkdir(path.join(directory, '2026-09-06.json')),
  ]);
  const store = createDigestStore(directory);
  const dates = await store.readAllDates();
  assert.deepEqual(dates, ['2026-09-05', '2026-09-04', '2026-09-03', '2026-09-02', '2026-09-01']);
  assert.equal((await firstReadableDigest(dates, store.readDigestFile)).date, '2026-09-03');
  assert.equal((await firstReadableDigest(dates.slice(3), store.readDigestFile)).date, '2026-09-01');
  assert.equal(await store.readDigestFile('../2026-09-01'), null);
  assert.equal(await store.readDigestFile('2026-09-04'), null);
  assert.equal(await store.readDigestFile('2026-09-09'), null);
  assert.equal(await firstReadableDigest(dates.slice(0, 2), store.readDigestFile), null);
});

test('missing directories and empty selections return no digest', async () => {
  const store = createDigestStore(path.join(temporary, 'missing'));
  assert.deepEqual(await store.readAllDates(), []);
  assert.equal(await firstReadableDigest([], store.readDigestFile), null);
});
