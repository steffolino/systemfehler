#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOCS_SOURCE_FILE = path.join(repoRoot, 'docs', 'life_events_sources_25_complete.json');
const PACKS_FILE = path.join(repoRoot, 'data', '_topics', 'life_event_resource_packs.json');

const ID_MAP = {
  unemployed_recently: 'job_loss_start',
  short_time_work: 'short_work_or_hours_cut',
  self_employment_failed: 'self_employment_failed',
  low_income_topup: 'low_income_topup',
  child_birth: 'family_children',
  single_parent: 'single_parent_new',
  separation_divorce: 'separation_divorce',
  care_for_relatives: 'caregiving_relatives',
  new_in_country_orientation: 'migration_arrival',
  no_residence_status: 'unclear_residence_status',
  language_barrier: 'migration_arrival',
  illness_short_term: 'health_disruption',
  long_term_illness_reha: 'long_term_work_incapacity',
  mental_health_crisis: 'mental_burnout',
  disability: 'long_term_work_incapacity',
  housing_loss: 'housing_loss_homelessness_risk',
  rent_too_high: 'housing_loss_homelessness_risk',
  energy_cost_crisis: 'energy_cost_unaffordable',
  debt_or_pfaendung: 'debt_crisis',
  benefits_sanction_or_cut: 'sanctions_conflict',
  application_rejected_appeal: 'sanctions_conflict',
  start_studies_or_training: 'education_finished_no_income',
};

const TARGET_SCENARIOS = new Set([
  'upskilling',
  'caregiving_relatives',
  'migration_arrival',
  'unclear_residence_status',
  'housing_loss_homelessness_risk',
  'energy_cost_unaffordable',
  'sanctions_conflict',
  'recognition_missing',
]);

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function toDomain(url, lane) {
  const u = String(url || '').toLowerCase();
  if (lane === 'contacts') return 'contacts';
  if (lane === 'ngo_assistance') return 'aid';
  if (u.includes('/download') || u.endsWith('.pdf')) return 'tools';
  if (u.includes('arbeitsagentur.de') || u.includes('jobcenter.de') || u.includes('bmas.de') || u.includes('bund.de')) return 'benefits';
  return lane === 'documents' ? 'benefits' : 'aid';
}

function toTier(url, lane) {
  if (lane === 'ngo_assistance') return 'tier_2_ngo_watchdog';
  const u = String(url || '').toLowerCase();
  if (u.includes('.bund.de') || u.includes('arbeitsagentur.de') || u.includes('jobcenter.de') || u.includes('bamf.de') || u.includes('bmas.de')) {
    return 'tier_1_official';
  }
  return 'tier_2_official';
}

function pushItem(target, lane, item) {
  const title = String(item?.name || item?.title || '').trim();
  const url = String(item?.url || '').trim();
  if (!url) return;
  target.resources[lane].push({
    title: title || url,
    url,
    domain: toDomain(url, lane),
    source_tier: toTier(url, lane),
  });
}

function dedupeResources(resources) {
  for (const lane of ['documents', 'ngo_assistance', 'contacts']) {
    const seen = new Set();
    resources[lane] = resources[lane].filter((item) => {
      const key = String(item.url || '').replace(/\/+$/, '').toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

function main() {
  const source = loadJson(DOCS_SOURCE_FILE);
  const packs = loadJson(PACKS_FILE);
  const scenarios = Array.isArray(packs?.scenarios) ? packs.scenarios : [];
  const byId = new Map(scenarios.map((s) => [String(s.scenario_id || '').toLowerCase(), s]));

  for (const row of source) {
    const sourceId = String(row?.life_event || '').trim().toLowerCase();
    const targetId = ID_MAP[sourceId];
    if (!targetId || !TARGET_SCENARIOS.has(targetId)) continue;
    if (!byId.has(targetId)) {
      byId.set(targetId, {
        scenario_id: targetId,
        label_de: row?.title_de || targetId,
        resources: { documents: [], ngo_assistance: [], contacts: [] },
      });
    }
    const target = byId.get(targetId);
    if (!target.resources || typeof target.resources !== 'object') {
      target.resources = { documents: [], ngo_assistance: [], contacts: [] };
    }
    target.resources.documents = Array.isArray(target.resources.documents) ? target.resources.documents : [];
    target.resources.ngo_assistance = Array.isArray(target.resources.ngo_assistance) ? target.resources.ngo_assistance : [];
    target.resources.contacts = Array.isArray(target.resources.contacts) ? target.resources.contacts : [];

    for (const item of row.official_sources || []) pushItem(target, 'documents', item);
    for (const item of row.pdfs || []) pushItem(target, 'documents', item);
    for (const item of row.ngo_sources || []) pushItem(target, 'ngo_assistance', item);
    for (const item of row.contacts || []) pushItem(target, 'contacts', item);

    dedupeResources(target.resources);
    byId.set(targetId, target);
  }

  packs.version = String(packs.version || '1.0.0');
  packs.generated_at = new Date().toISOString();
  packs.generated_from = 'docs/life_events_sources_25_complete.json';
  packs.scenarios = Array.from(byId.values());

  fs.writeFileSync(PACKS_FILE, JSON.stringify(packs, null, 2) + '\n');
  console.log(`updated ${path.relative(repoRoot, PACKS_FILE)}`);
}

main();
