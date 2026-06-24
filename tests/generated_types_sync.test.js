import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';

const DB_TYPES_PATH = 'frontend/src/lib/db_types.ts';

test('generated database types stay in sync with generator', () => {
  const before = fs.readFileSync(DB_TYPES_PATH, 'utf8');

  try {
    execFileSync(process.execPath, ['scripts/generate_ts_interfaces.js'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    });

    const after = fs.readFileSync(DB_TYPES_PATH, 'utf8');
    assert.equal(after, before);
    assert.match(after, /variant\?: 'einfach' \| 'leicht';/);
    assert.match(after, /reviewStatus\?: 'suggested' \| 'approved' \| 'rejected';/);
    assert.match(after, /reviewedBy\?: string;/);
    assert.match(after, /reviewedAt\?: string;/);
  } finally {
    fs.writeFileSync(DB_TYPES_PATH, before, 'utf8');
  }
});
