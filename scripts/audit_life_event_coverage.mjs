#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localEvaluateEntries } from '../cloudflare-pages/functions/api/_lib/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];
const SCENARIO_FILE = path.join(repoRoot, 'data', '_topics', 'life_events.json');

const TARGETS = {
  docsMin: 5,
  docsMax: 10,
  contactsMin: 5,
  ngoMin: 3,
  ngoMax: 5,
};

const OFFICIAL_TIERS = new Set(['tier_1_law', 'tier_1_official', 'tier_2_official']);
const NGO_TIERS = new Set(['tier_2_ngo_watchdog', 'tier_3_ngo']);

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function collectEntries() {
  const entries = [];
  for (const domain of DOMAINS) {
    const file = path.join(repoRoot, 'data', domain, 'entries.json');
    if (!fs.existsSync(file)) continue;
    const raw = loadJson(file);
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const status = String(entry.status || 'active').toLowerCase();
      if (status !== 'active') continue;
      entries.push({
        ...entry,
        domain,
      });
    }
  }
  return entries;
}

function buildEntryLookup(entries) {
  const byUrl = new Map();
  for (const entry of entries) {
    const url = String(entry.url || '');
    if (!url) continue;
    if (!byUrl.has(url)) byUrl.set(url, entry);
  }
  return byUrl;
}

function buildProbeQueries(scenario) {
  const keywords = (scenario.keywords || []).slice(0, 4);
  const expansions = (scenario.expansions || []).slice(0, 4);
  const docs = (scenario.resource_targets?.documents || []).slice(0, 3);
  const contacts = (scenario.resource_targets?.contacts || []).slice(0, 3);

  const probes = [
    keywords.join(' '),
    expansions.join(' '),
    [...docs, ...contacts].join(' '),
  ].map((q) => String(q || '').trim()).filter(Boolean);

  return Array.from(new Set(probes));
}

function classify(entry) {
  const provenance = entry.provenance && typeof entry.provenance === 'object' ? entry.provenance : {};
  const sourceTier = String(provenance.sourceTier || entry.sourceTier || 'unknown').toLowerCase();
  const institutionType = String(provenance.institutionType || 'unknown').toLowerCase();

  const isDocHq = entry.domain !== 'contacts' && OFFICIAL_TIERS.has(sourceTier);
  const isContact = entry.domain === 'contacts';
  const isNgoAssist =
    entry.domain !== 'organizations' &&
    (institutionType === 'ngo' || NGO_TIERS.has(sourceTier));

  return { isDocHq, isContact, isNgoAssist, sourceTier, institutionType };
}

function uniqByUrl(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.url || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function evaluateScenario(entries, byUrl, scenarios, scenario) {
  const probes = buildProbeQueries(scenario);
  const pool = [];

  for (const query of probes) {
    const result = localEvaluateEntries(entries, query, {
      lifeEventId: scenario.id,
      lifeEventScenarios: scenarios,
    });

    for (const item of result.results.slice(0, 10)) {
      const entry = byUrl.get(item.url);
      if (!entry) continue;
      pool.push({
        ...entry,
        retrievedScore: item.score,
      });
    }
  }

  const candidates = uniqByUrl(pool).sort((a, b) => (Number(b.retrievedScore || 0) - Number(a.retrievedScore || 0)));

  const docs = [];
  const contacts = [];
  const ngos = [];

  for (const entry of candidates) {
    const flags = classify(entry);
    if (flags.isDocHq) docs.push(entry);
    if (flags.isContact) contacts.push(entry);
    if (flags.isNgoAssist) ngos.push(entry);
  }

  const docsTop = docs.slice(0, TARGETS.docsMax);
  const contactsTop = contacts.slice(0, TARGETS.contactsMin);
  const ngosTop = ngos.slice(0, TARGETS.ngoMax);

  const gaps = {
    docs: Math.max(0, TARGETS.docsMin - docsTop.length),
    contacts: Math.max(0, TARGETS.contactsMin - contactsTop.length),
    ngos: Math.max(0, TARGETS.ngoMin - ngosTop.length),
  };

  return {
    id: scenario.id,
    label_de: scenario.label_de || scenario.id,
    probes,
    docs: docsTop,
    contacts: contactsTop,
    ngos: ngosTop,
    gaps,
  };
}

function printScenario(result) {
  const ok = result.gaps.docs === 0 && result.gaps.contacts === 0 && result.gaps.ngos === 0;
  console.log(`\n[${ok ? 'OK' : 'GAP'}] ${result.id} - ${result.label_de}`);
  console.log(`  probes: ${result.probes.join(' | ')}`);
  console.log(`  docs_hq: ${result.docs.length}/${TARGETS.docsMin}-${TARGETS.docsMax}`);
  console.log(`  contacts: ${result.contacts.length}/${TARGETS.contactsMin}`);
  console.log(`  ngo_assist: ${result.ngos.length}/${TARGETS.ngoMin}-${TARGETS.ngoMax}`);

  if (!ok) {
    const missing = [];
    if (result.gaps.docs > 0) missing.push(`docs +${result.gaps.docs}`);
    if (result.gaps.contacts > 0) missing.push(`contacts +${result.gaps.contacts}`);
    if (result.gaps.ngos > 0) missing.push(`ngo +${result.gaps.ngos}`);
    console.log(`  missing: ${missing.join(', ')}`);
  }

  if (result.docs.length > 0) {
    console.log('  sample_docs:');
    result.docs.slice(0, 2).forEach((entry) => console.log(`    - ${entry.url}`));
  }
  if (result.contacts.length > 0) {
    console.log('  sample_contacts:');
    result.contacts.slice(0, 2).forEach((entry) => console.log(`    - ${entry.url}`));
  }
  if (result.ngos.length > 0) {
    console.log('  sample_ngos:');
    result.ngos.slice(0, 2).forEach((entry) => console.log(`    - ${entry.url}`));
  }
}

function main() {
  const payload = loadJson(SCENARIO_FILE);
  const scenarios = Array.isArray(payload?.scenarios) ? payload.scenarios : [];
  const entries = collectEntries();
  const byUrl = buildEntryLookup(entries);

  console.log(`Scenarios: ${scenarios.length}`);
  console.log(`Active entries: ${entries.length}`);

  const results = scenarios.map((scenario) => evaluateScenario(entries, byUrl, scenarios, scenario));
  const withGaps = results.filter((r) => r.gaps.docs > 0 || r.gaps.contacts > 0 || r.gaps.ngos > 0);

  for (const result of results) {
    printScenario(result);
  }

  console.log('\nSummary:');
  console.log(`  scenarios_with_gaps: ${withGaps.length}/${results.length}`);
  console.log(`  scenarios_ready: ${results.length - withGaps.length}/${results.length}`);

  if (withGaps.length > 0) {
    console.log('  gap_ids:');
    withGaps.forEach((item) => {
      const missing = [];
      if (item.gaps.docs > 0) missing.push(`docs+${item.gaps.docs}`);
      if (item.gaps.contacts > 0) missing.push(`contacts+${item.gaps.contacts}`);
      if (item.gaps.ngos > 0) missing.push(`ngo+${item.gaps.ngos}`);
      console.log(`    - ${item.id}: ${missing.join(', ')}`);
    });
    process.exitCode = 2;
  }
}

main();
