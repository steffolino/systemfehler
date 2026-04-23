#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];
const LIFE_EVENTS_FILE = path.join(repoRoot, 'data', '_topics', 'life_events.json');
const OUTPUT_FILE = path.join(repoRoot, 'data', '_topics', 'life_event_resource_packs.json');

const TARGETS = {
  docsMin: 5,
  docsMax: 10,
  contacts: 5,
  ngoMin: 3,
  ngoMax: 5,
};

const OFFICIAL_TIERS = new Set(['tier_1_law', 'tier_1_official', 'tier_2_official']);
const NGO_TIERS = new Set(['tier_2_ngo_watchdog', 'tier_3_ngo']);
const CONTACT_HINTS = ['beratung', 'hotline', 'jobcenter', 'arbeitsagentur', 'telefon', 'kontakt', 'anlaufstelle'];

function loadJson(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function localized(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value.de || value.en || value.easy_de || '';
  }
  return '';
}

function collectEntries() {
  const entries = [];
  for (const domain of DOMAINS) {
    const file = path.join(repoRoot, 'data', domain, 'entries.json');
    if (!fs.existsSync(file)) continue;
    const raw = loadJson(file);
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    for (const e of list) {
      if (!e || typeof e !== 'object') continue;
      if (String(e.status || 'active').toLowerCase() !== 'active') continue;
      const provenance = e.provenance && typeof e.provenance === 'object' ? e.provenance : {};
      const sourceTier = normalizeText(provenance.sourceTier || e.sourceTier || 'unknown');
      const institutionType = normalizeText(provenance.institutionType || 'unknown');
      const title = localized(e.title);
      const summary = localized(e.summary);
      const content = localized(e.content);
      const url = String(e.url || '');
      const blob = normalizeText([
        title,
        summary,
        content,
        url,
        domain,
        Array.isArray(e.topics) ? e.topics.join(' ') : '',
        Array.isArray(e.tags) ? e.tags.join(' ') : '',
        Array.isArray(e.targetGroups) ? e.targetGroups.join(' ') : '',
        Array.isArray(e.target_groups) ? e.target_groups.join(' ') : '',
      ].join(' '));

      entries.push({
        id: e.id || `${domain}:${url}`,
        domain,
        url,
        title,
        sourceTier,
        institutionType,
        blob,
      });
    }
  }
  return entries;
}

function uniqByUrl(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = item.url || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function score(entry, scenario) {
  let s = 0;
  const text = entry.blob;
  for (const term of scenario.keywords || []) {
    if (text.includes(term)) s += 3;
  }
  for (const term of scenario.expansions || []) {
    if (text.includes(term)) s += 2.25;
  }
  for (const term of scenario.resource_targets?.documents || []) {
    if (text.includes(term)) s += 2;
  }
  for (const term of scenario.resource_targets?.information || []) {
    if (text.includes(term)) s += 1.5;
  }
  for (const term of scenario.resource_targets?.contacts || []) {
    if (text.includes(term)) s += 1.5;
  }
  if ((scenario.domains || []).includes(entry.domain)) s += 1;

  if (OFFICIAL_TIERS.has(entry.sourceTier)) s += 0.75;
  if (entry.institutionType === 'ngo' || NGO_TIERS.has(entry.sourceTier)) s += 0.5;

  return s;
}

function pickScenarioPack(entries, scenario, ngoFallback) {
  const blockedAny = Array.isArray(scenario.relevance_guard?.blocked_any)
    ? scenario.relevance_guard.blocked_any.map((s) => normalizeText(s))
    : [];
  const allowedEntries = blockedAny.length > 0
    ? entries.filter((e) => !blockedAny.some((sig) => e.blob.includes(sig)))
    : entries;

  const ranked = allowedEntries
    .map((entry) => ({ entry, score: score(entry, scenario) }))
    .filter((x) => x.score >= 2.5)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.entry);

  const docs = uniqByUrl(
    ranked.filter((e) => e.domain !== 'contacts' && OFFICIAL_TIERS.has(e.sourceTier))
  ).slice(0, TARGETS.docsMax);

  const contacts = uniqByUrl(
    ranked.filter((e) =>
      e.domain === 'contacts' ||
      CONTACT_HINTS.some((hint) => e.blob.includes(hint))
    )
  ).slice(0, TARGETS.contacts);

  let ngo = uniqByUrl(
    ranked.filter((e) =>
      e.domain !== 'organizations' &&
      (e.institutionType === 'ngo' || NGO_TIERS.has(e.sourceTier))
    )
  ).slice(0, TARGETS.ngoMax);

  if (ngo.length < TARGETS.ngoMin) {
    const missing = TARGETS.ngoMin - ngo.length;
    const supplement = ngoFallback.filter((e) => !ngo.some((n) => n.url === e.url)).slice(0, missing);
    ngo = [...ngo, ...supplement];
  }

  return {
    scenario_id: scenario.id,
    label_de: scenario.label_de || scenario.id,
    resources: {
      documents: docs.map((e) => ({ title: e.title, url: e.url, domain: e.domain, source_tier: e.sourceTier })),
      contacts: contacts.map((e) => ({ title: e.title, url: e.url, domain: e.domain, source_tier: e.sourceTier })),
      ngo_assistance: ngo.map((e) => ({ title: e.title, url: e.url, domain: e.domain, source_tier: e.sourceTier })),
    },
  };
}

function main() {
  const lifeEvents = loadJson(LIFE_EVENTS_FILE);
  const scenarios = Array.isArray(lifeEvents?.scenarios) ? lifeEvents.scenarios : [];
  const entries = collectEntries();

  const ngoFallback = uniqByUrl(entries.filter((e) =>
    e.domain !== 'organizations' && (e.institutionType === 'ngo' || NGO_TIERS.has(e.sourceTier))
  )).slice(0, 10);

  const packs = scenarios.map((scenario) => pickScenarioPack(entries, scenario, ngoFallback));

  const output = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    targets: TARGETS,
    scenarios: packs,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  let missing = 0;
  for (const pack of packs) {
    const docs = pack.resources.documents.length;
    const contacts = pack.resources.contacts.length;
    const ngo = pack.resources.ngo_assistance.length;
    const ok = docs >= TARGETS.docsMin && contacts >= TARGETS.contacts && ngo >= TARGETS.ngoMin;
    if (!ok) missing += 1;
  }

  console.log(`Generated ${OUTPUT_FILE}`);
  console.log(`Scenarios: ${packs.length}`);
  console.log(`Scenarios below target: ${missing}`);
  if (missing > 0) process.exitCode = 2;
}

main();
