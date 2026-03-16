import test from 'node:test';
import assert from 'node:assert/strict';

import { applyPlainLanguageReview } from '../backend/plain_language_review.js';

test('approve creates reviewed Einfach record and marks suggestion approved', () => {
  const now = '2026-03-16T12:00:00.000Z';
  const translations = {
    'de-EINFACH-SUGGESTED': {
      title: 'Klar',
      summary: 'Kurz',
      body: 'Einfacher Text',
      provenance: { source: 'example.org', crawledAt: now },
      timestamp: now,
      reviewed: false,
      variant: 'einfach',
      reviewStatus: 'suggested',
    },
  };

  const updated = applyPlainLanguageReview(translations, {
    mode: 'einfach',
    action: 'approve',
    reviewer: 'admin@example.org',
    now,
  });

  assert.equal(updated['de-EINFACH'].reviewStatus, 'approved');
  assert.equal(updated['de-EINFACH'].reviewed, true);
  assert.equal(updated['de-EINFACH'].reviewedBy, 'admin@example.org');
  assert.equal(updated['de-EINFACH-SUGGESTED'].reviewStatus, 'approved');
});

test('reject marks Leicht suggestion rejected without creating reviewed record', () => {
  const now = '2026-03-16T12:00:00.000Z';
  const translations = {
    'de-LEICHT-SUGGESTED': {
      title: 'Leicht',
      summary: 'Kurz',
      body: 'Leichter Text',
      provenance: { source: 'example.org', crawledAt: now },
      timestamp: now,
      reviewed: false,
      variant: 'leicht',
      reviewStatus: 'suggested',
    },
  };

  const updated = applyPlainLanguageReview(translations, {
    mode: 'leicht',
    action: 'reject',
    reviewer: 'admin@example.org',
    now,
  });

  assert.equal(updated['de-LEICHT'], undefined);
  assert.equal(updated['de-LEICHT-SUGGESTED'].reviewStatus, 'rejected');
  assert.equal(updated['de-LEICHT-SUGGESTED'].reviewed, false);
  assert.equal(updated['de-LEICHT-SUGGESTED'].reviewedBy, 'admin@example.org');
});
