import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { canonicalizeUrl, detectDuplicate, validateUrl, removeTrackingParams } from '../services/_shared/url_normalization.js';

const fixturePath = path.resolve(process.cwd(), 'tests', 'fixtures', 'url_canonicalization_cases.json');
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

for (const testCase of fixtures.canonicalization) {
  const actual = canonicalizeUrl(testCase.input);
  assert.strictEqual(
    actual,
    testCase.expected,
    `Canonicalization failed for ${testCase.name}: expected '${testCase.expected}' got '${actual}'`
  );
}

for (const testCase of fixtures.duplicates) {
  const result = detectDuplicate(testCase.input, testCase.existing);
  assert.strictEqual(result.isDuplicate, testCase.isDuplicate, `Duplicate detection failed for ${testCase.name}`);
  assert.strictEqual(result.matchedUrl, testCase.matchedUrl, `Duplicate matchedUrl failed for ${testCase.name}`);
}

const cleaned = removeTrackingParams('https://example.org/path?x=1&utm_source=test&utm_medium=email');
assert.strictEqual(cleaned, 'https://example.org/path?x=1');

const valid = validateUrl('https://service.example.org/help?id=1', ['example.org']);
assert.strictEqual(valid.valid, true, 'Expected URL to be valid with allowed source');

const invalid = validateUrl('ftp://example.org/file', ['example.org']);
assert.strictEqual(invalid.valid, false, 'Expected non-http(s) URL to be invalid');

console.log('✓ URL canonicalization fixture tests passed');
