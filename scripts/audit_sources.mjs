#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];
const VALID_TIERS = new Set([
  'tier_1_law',
  'tier_1_official',
  'tier_2_official',
  'tier_2_ngo_watchdog',
  'tier_3_ngo',
  'tier_3_press',
  'tier_4_academic',
  'tier_4_other',
  'tier_5_contextual',
  'tier_5_partisan_context',
]);
const UNKNOWN_TIERS = new Set(['', 'unknown', 'tier_unknown', 'unclassified', 'undefined', 'null']);
const LOW_SIGNAL_PATHS = [
  'cookie',
  'datenschutz',
  'impressum',
  'login',
  'newsletter',
  'presse',
  'privacy',
  'shop',
  'spenden',
  'warenkorb',
];
const SENSITIVE_TERMS = [
  'depression',
  'burnout',
  'krise',
  'psychisch',
  'suizid',
  'gewalt',
  'missbrauch',
  'wohnungslos',
  'obdachlos',
  'schulden',
  'pflege',
];
const STOPWORDS = new Set([
  'aber',
  'alle',
  'alles',
  'auch',
  'auf',
  'aus',
  'bei',
  'bin',
  'bis',
  'das',
  'den',
  'der',
  'des',
  'die',
  'ein',
  'eine',
  'einer',
  'eines',
  'fuer',
  'gibt',
  'hilfe',
  'ich',
  'im',
  'in',
  'ist',
  'mit',
  'nach',
  'oder',
  'und',
  'von',
  'was',
  'wenn',
  'wie',
  'zu',
  'zum',
  'zur',
]);

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function tokenize(value) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function asEntries(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.entries)) return payload.entries;
  return [];
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function canonicalUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.search = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return String(url || '').trim();
  }
}

function getTitle(entry) {
  if (typeof entry?.title === 'string') return entry.title;
  return entry?.title?.de || entry?.title?.easy_de || entry?.label_de || entry?.id || '(untitled)';
}

function getSummary(entry) {
  if (typeof entry?.summary === 'string') return entry.summary;
  return entry?.summary?.de || '';
}

function getSourceTier(entry) {
  return String(entry?.provenance?.sourceTier || entry?.sourceTier || '').trim().toLowerCase();
}

function getInstitutionType(entry) {
  return String(entry?.provenance?.institutionType || '').trim().toLowerCase();
}

function isUnknownTier(tier) {
  return UNKNOWN_TIERS.has(String(tier || '').trim().toLowerCase());
}

function isActive(entry) {
  return String(entry?.status || 'active').toLowerCase() === 'active' && entry?.sourceUnavailable !== true;
}

function pushLimited(list, item, max = 100) {
  if (list.length < max) list.push(item);
}

function count(map, key) {
  const clean = key || '(missing)';
  map[clean] = (map[clean] || 0) + 1;
}

function loadAllEntries() {
  const entries = [];
  for (const domain of DOMAINS) {
    const filePath = path.join(repoRoot, 'data', domain, 'entries.json');
    for (const entry of asEntries(readJson(filePath, {}))) {
      entries.push({ ...entry, domain });
    }
  }
  return entries;
}

function loadUrlSeeds() {
  const urls = [];
  for (const domain of DOMAINS) {
    const filePath = path.join(repoRoot, 'data', domain, 'urls.json');
    const payload = readJson(filePath, []);
    const list = Array.isArray(payload) ? payload : Array.isArray(payload?.urls) ? payload.urls : [];
    for (const item of list) {
      const url = typeof item === 'string' ? item : item?.url;
      if (!url) continue;
      urls.push({
        domain,
        url,
        host: hostnameOf(url),
        sourceTier: String(item?.sourceTier || item?.source_tier || '').toLowerCase(),
      });
    }
  }
  return urls;
}

function collectTrustedSourceIds() {
  const payload = readJson(path.join(repoRoot, 'data', '_topics', 'trusted_topic_sources.json'), {});
  const ids = new Set();
  const seedUrls = new Set();
  for (const topic of payload?.topics || []) {
    for (const source of topic?.sources || []) {
      if (source?.sourceId) ids.add(String(source.sourceId).toLowerCase());
      for (const url of source?.seedUrls || []) seedUrls.add(canonicalUrl(url));
    }
  }
  return { ids, seedUrls };
}

function auditEntries(entries, trusted) {
  const active = entries.filter(isActive);
  const byDomain = {};
  const byTier = {};
  const byInstitution = {};
  const byHost = {};
  const unknownTier = [];
  const invalidTier = [];
  const unknownInstitution = [];
  const untrustedSensitive = [];
  const lowSignalUrls = [];
  const duplicateUrlGroups = [];
  const urlGroups = new Map();
  let untrustedSensitiveCount = 0;
  let lowSignalUrlCount = 0;

  for (const entry of active) {
    const title = getTitle(entry);
    const url = entry.url || entry.provenance?.source || '';
    const host = hostnameOf(url);
    const tier = getSourceTier(entry);
    const institutionType = getInstitutionType(entry);
    const sourceId = String(entry.provenance?.sourceId || '').toLowerCase();
    const canonical = canonicalUrl(url);
    const text = normalizeText(`${title} ${url} ${getSummary(entry)} ${entry.content?.de || ''}`);

    count(byDomain, entry.domain);
    count(byTier, tier || '(missing)');
    count(byInstitution, institutionType || '(missing)');
    count(byHost, host || '(invalid-url)');

    if (!urlGroups.has(canonical)) urlGroups.set(canonical, []);
    urlGroups.get(canonical).push({ domain: entry.domain, id: entry.id, title, tier: tier || '(missing)' });

    if (isUnknownTier(tier)) {
      pushLimited(unknownTier, { domain: entry.domain, id: entry.id, title, url, tier: tier || '(missing)', host });
    } else if (!VALID_TIERS.has(tier)) {
      pushLimited(invalidTier, { domain: entry.domain, id: entry.id, title, url, tier, host });
    }

    if (!institutionType || institutionType === 'unknown') {
      pushLimited(unknownInstitution, { domain: entry.domain, id: entry.id, title, url, tier: tier || '(missing)', host });
    }

    const mentionsSensitive = SENSITIVE_TERMS.some((term) => text.includes(term));
    const trustedSource = trusted.ids.has(sourceId) || trusted.seedUrls.has(canonical);
    if (mentionsSensitive && (isUnknownTier(tier) || !trustedSource)) {
      untrustedSensitiveCount += 1;
      pushLimited(untrustedSensitive, {
        domain: entry.domain,
        id: entry.id,
        title,
        url,
        tier: tier || '(missing)',
        institutionType: institutionType || '(missing)',
        sourceId: sourceId || '(missing)',
      });
    }

    if (LOW_SIGNAL_PATHS.some((needle) => normalizeText(url).includes(needle))) {
      lowSignalUrlCount += 1;
      pushLimited(lowSignalUrls, { domain: entry.domain, id: entry.id, title, url, tier: tier || '(missing)' });
    }
  }

  for (const [url, items] of urlGroups.entries()) {
    const domains = new Set(items.map((item) => item.domain));
    if (items.length > 1 && domains.size > 1) {
      pushLimited(duplicateUrlGroups, { url, items }, 100);
    }
  }

  return {
    totals: {
      entries: entries.length,
      activeEntries: active.length,
      unknownTier: active.filter((entry) => isUnknownTier(getSourceTier(entry))).length,
      invalidTier: active.filter((entry) => {
        const tier = getSourceTier(entry);
        return !isUnknownTier(tier) && !VALID_TIERS.has(tier);
      }).length,
      unknownInstitution: active.filter((entry) => {
        const type = getInstitutionType(entry);
        return !type || type === 'unknown';
      }).length,
      duplicateUrlGroups: duplicateUrlGroups.length,
      untrustedSensitive: untrustedSensitiveCount,
      lowSignalUrls: lowSignalUrlCount,
    },
    byDomain,
    byTier,
    byInstitution,
    topHosts: Object.fromEntries(
      Object.entries(byHost)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
    ),
    samples: {
      unknownTier,
      invalidTier,
      unknownInstitution,
      untrustedSensitive,
      lowSignalUrls,
      duplicateUrlGroups,
    },
  };
}

function scenarioTokens(scenario) {
  const parts = [
    scenario?.id,
    scenario?.label_de,
    ...(scenario?.keywords || []),
    ...(scenario?.expansions || []),
    ...Object.values(scenario?.resource_targets || {}).flat(),
  ];
  return new Set(tokenize(parts.join(' ')));
}

function isPinnedResource(scenario, resource) {
  const groups = Object.values(scenario?.resource_pins || {}).flat();
  const target = canonicalUrl(resource?.url);
  return groups.some((pin) => canonicalUrl(pin?.url) === target);
}

function resourceOverlap(tokens, resource) {
  const resourceTokens = new Set(tokenize(`${resource?.title || ''} ${resource?.url || ''}`));
  if (tokens.size === 0 || resourceTokens.size === 0) return 0;
  let hits = 0;
  for (const token of resourceTokens) {
    if (tokens.has(token)) hits += 1;
  }
  return hits / Math.min(tokens.size, resourceTokens.size);
}

function auditLifeEventPacks() {
  const scenariosPayload = readJson(path.join(repoRoot, 'data', '_topics', 'life_events.json'), {});
  const curatedPinsPayload = readJson(path.join(repoRoot, 'data', '_topics', 'life_event_source_pins.json'), {});
  const packPayload = readJson(path.join(repoRoot, 'data', '_topics', 'life_event_resource_packs.json'), {});
  const scenarios = new Map((scenariosPayload?.scenarios || []).map((scenario) => [scenario.id, scenario]));
  const curatedPins = curatedPinsPayload?.scenarios || {};
  const unknownOrInvalidTier = [];
  const lowRelevance = [];
  const belowTarget = [];
  const countsBySection = {};
  let unknownOrInvalidTierCount = 0;
  let lowRelevanceCount = 0;
  const targets = packPayload?.targets || {};

  for (const pack of packPayload?.scenarios || []) {
    const scenario = scenarios.get(pack.scenario_id) || {};
    const tokens = scenarioTokens(scenario);
    for (const [section, resources] of Object.entries(pack?.resources || {})) {
      count(countsBySection, section);
      for (const resource of resources || []) {
        const tier = String(resource?.source_tier || '').trim().toLowerCase();
        const item = {
          scenarioId: pack.scenario_id,
          label: pack.label_de || scenario.label_de || pack.scenario_id,
          section,
          title: resource?.title || '(untitled)',
          url: resource?.url || '',
          domain: resource?.domain || '(missing)',
          sourceTier: tier || '(missing)',
        };
        if (isUnknownTier(tier) || !VALID_TIERS.has(tier)) {
          unknownOrInvalidTierCount += 1;
          pushLimited(unknownOrInvalidTier, item, 200);
        }

        const pinned = isPinnedResource(scenario, resource) || isPinnedResource({ resource_pins: curatedPins[pack.scenario_id] }, resource);
        const overlap = resourceOverlap(tokens, resource);
        if (!pinned && overlap < 0.08) {
          lowRelevanceCount += 1;
          pushLimited(lowRelevance, { ...item, overlap: Number(overlap.toFixed(2)) }, 200);
        }
      }
    }

    const documentsCount = pack?.resources?.documents?.length || 0;
    const contactsCount = pack?.resources?.contacts?.length || 0;
    const ngoCount = pack?.resources?.ngo_assistance?.length || 0;
    const docsMin = Number(targets.docsMin || 0);
    const contactsMin = Number(targets.contacts || 0);
    const ngoMin = Number(targets.ngoMin || 0);
    if (documentsCount < docsMin || contactsCount < contactsMin || ngoCount < ngoMin) {
      belowTarget.push({
        scenarioId: pack.scenario_id,
        label: pack.label_de || scenario.label_de || pack.scenario_id,
        documents: documentsCount,
        documentsMin: docsMin,
        contacts: contactsCount,
        contactsMin,
        ngoAssistance: ngoCount,
        ngoAssistanceMin: ngoMin,
      });
    }
  }

  return {
    totals: {
      scenarios: packPayload?.scenarios?.length || 0,
      unknownOrInvalidTier: unknownOrInvalidTierCount,
      lowRelevance: lowRelevanceCount,
      belowTarget: belowTarget.length,
    },
    countsBySection,
    samples: {
      unknownOrInvalidTier,
      lowRelevance,
      belowTarget,
    },
  };
}

function auditUrlSeeds(urls) {
  const byDomain = {};
  const byHost = {};
  const missingTier = [];
  for (const item of urls) {
    count(byDomain, item.domain);
    count(byHost, item.host || '(invalid-url)');
    if (isUnknownTier(item.sourceTier)) {
      pushLimited(missingTier, item, 100);
    }
  }
  return {
    totals: {
      urls: urls.length,
      missingTier: urls.filter((item) => isUnknownTier(item.sourceTier)).length,
    },
    byDomain,
    topHosts: Object.fromEntries(Object.entries(byHost).sort((a, b) => b[1] - a[1]).slice(0, 30)),
    samples: { missingTier },
  };
}

function severity(report) {
  const critical =
    report.entries.totals.unknownTier +
    report.entries.totals.invalidTier +
    report.lifeEventPacks.totals.unknownOrInvalidTier;
  const warnings =
    report.entries.totals.unknownInstitution +
    report.entries.totals.untrustedSensitive +
    report.lifeEventPacks.totals.lowRelevance +
    report.lifeEventPacks.totals.belowTarget +
    report.urlSeeds.totals.missingTier;
  return { critical, warnings };
}

function markdownTable(rows, columns) {
  if (rows.length === 0) return '_None found._\n';
  const header = `| ${columns.join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows
    .map((row) => `| ${columns.map((column) => String(row[column] ?? '').replace(/\|/g, '/')).join(' | ')} |`)
    .join('\n');
  return `${header}\n${divider}\n${body}\n`;
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Source Audit Report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Active entries: ${report.entries.totals.activeEntries}`);
  lines.push(`- Entry sources with unknown tier: ${report.entries.totals.unknownTier}`);
  lines.push(`- Entry sources with invalid tier: ${report.entries.totals.invalidTier}`);
  lines.push(`- Active entries with unknown institution type: ${report.entries.totals.unknownInstitution}`);
  lines.push(`- Life-event resources with unknown or invalid tier: ${report.lifeEventPacks.totals.unknownOrInvalidTier}`);
  lines.push(`- Life-event resources with low scenario-token overlap: ${report.lifeEventPacks.totals.lowRelevance}`);
  lines.push(`- Life-event scenarios below quantity target: ${report.lifeEventPacks.totals.belowTarget}`);
  lines.push(`- Severity counters: ${report.severity.critical} critical, ${report.severity.warnings} warnings`);
  lines.push('');
  lines.push('## Entry Source Tiers');
  lines.push('');
  lines.push(markdownTable(Object.entries(report.entries.byTier).map(([tier, countValue]) => ({ tier, count: countValue })), ['tier', 'count']));
  lines.push('');
  lines.push('## Unknown Or Invalid Entry Tiers');
  lines.push('');
  lines.push(markdownTable([...report.entries.samples.unknownTier, ...report.entries.samples.invalidTier].slice(0, 50), ['domain', 'tier', 'title', 'url']));
  lines.push('');
  lines.push('## Sensitive Entries Needing Source Review');
  lines.push('');
  lines.push(markdownTable(report.entries.samples.untrustedSensitive.slice(0, 50), ['domain', 'tier', 'institutionType', 'sourceId', 'title', 'url']));
  lines.push('');
  lines.push('## Life-Event Pack Tier Problems');
  lines.push('');
  lines.push(markdownTable(report.lifeEventPacks.samples.unknownOrInvalidTier.slice(0, 80), ['scenarioId', 'section', 'sourceTier', 'title', 'url']));
  lines.push('');
  lines.push('## Life-Event Pack Quantity Gaps');
  lines.push('');
  lines.push(markdownTable(report.lifeEventPacks.samples.belowTarget.slice(0, 80), ['scenarioId', 'documents', 'documentsMin', 'contacts', 'contactsMin', 'ngoAssistance', 'ngoAssistanceMin']));
  lines.push('');
  lines.push('## Life-Event Pack Relevance Review');
  lines.push('');
  lines.push(markdownTable(report.lifeEventPacks.samples.lowRelevance.slice(0, 80), ['scenarioId', 'section', 'sourceTier', 'overlap', 'title', 'url']));
  lines.push('');
  lines.push('## Duplicate URLs Across Domains');
  lines.push('');
  lines.push(markdownTable(report.entries.samples.duplicateUrlGroups.slice(0, 40).map((group) => ({
    url: group.url,
    entries: group.items.map((item) => `${item.domain}:${item.title}`).join('; '),
  })), ['url', 'entries']));
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const entries = loadAllEntries();
  const urls = loadUrlSeeds();
  const trusted = collectTrustedSourceIds();
  const report = {
    generatedAt: new Date().toISOString(),
    policy: {
      validTiers: [...VALID_TIERS],
      unknownTiers: [...UNKNOWN_TIERS],
      note: 'Unknown, missing, and invalid tiers must not be used as answer evidence.',
    },
    entries: auditEntries(entries, trusted),
    lifeEventPacks: auditLifeEventPacks(),
    urlSeeds: auditUrlSeeds(urls),
  };
  report.severity = severity(report);

  const jsonPath = path.join(repoRoot, 'data', '_quality', 'source_audit_report.json');
  const mdPath = path.join(repoRoot, 'data', '_quality', 'source_audit_report.md');
  writeJson(jsonPath, report);
  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf8');

  console.log(`Wrote ${path.relative(repoRoot, jsonPath)}`);
  console.log(`Wrote ${path.relative(repoRoot, mdPath)}`);
  console.log(`Critical: ${report.severity.critical}`);
  console.log(`Warnings: ${report.severity.warnings}`);
}

main();
