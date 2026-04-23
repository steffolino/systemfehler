#!/usr/bin/env node
/**
 * Systemfehler - Entry Validation Script
 * 
 * Validates all entries against core schema, domain extension schemas,
 * and taxonomy rules. This script runs during development and CI.
 * 
 * @see DATA-05 (Issue #28) - Implement schema validation and linting pipeline
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    ci: false,
    failOnErrors: true,
    maxSamples: 5,
    domain: null
  };

  for (const arg of argv) {
    if (arg === '--ci') {
      options.ci = true;
      continue;
    }
    if (arg.startsWith('--fail-on-errors=')) {
      const value = arg.split('=')[1];
      options.failOnErrors = value !== 'false' && value !== '0';
      continue;
    }
    if (arg.startsWith('--max-samples=')) {
      const value = Number(arg.split('=')[1]);
      if (Number.isInteger(value) && value > 0) {
        options.maxSamples = value;
      }
      continue;
    }
    if (arg.startsWith('--domain=')) {
      const value = arg.split('=')[1];
      if (DOMAINS.includes(value)) {
        options.domain = value;
      }
    }
  }

  return options;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function toSetFromTaxonomy(filePath, key) {
  const payload = loadJson(filePath);
  const arr = Array.isArray(payload?.[key]) ? payload[key] : [];
  const ids = new Set();
  function collect(items) {
    for (const item of items) {
      if (item && typeof item.id === 'string') {
        ids.add(item.id);
        if (Array.isArray(item.children)) collect(item.children);
      }
    }
  }
  collect(arr);
  return ids;
}

function asEntries(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.entries)) return payload.entries;
  return [];
}

function makeAjv(coreSchema) {
  const ajv = new Ajv({
    allErrors: true,
    strict: false
  });
  addFormats(ajv);
  ajv.addSchema(coreSchema, coreSchema.$id || 'core.schema.json');
  ajv.addSchema(coreSchema, 'core.schema.json');
  ajv.addSchema(coreSchema, '../core.schema.json');
  return ajv;
}

function formatAjvErrors(errors = []) {
  return errors.map((error) => {
    const path = error.instancePath ? error.instancePath.slice(1).replace(/\//g, '.') : 'root';
    return `${path}: ${error.message}`;
  });
}

function getAllowedTopLevelFields(coreSchema, extensionSchema) {
  const core = Object.keys(coreSchema?.properties || {});
  const ext = Object.keys(extensionSchema?.properties || {});
  return new Set([...core, ...ext]);
}

function checkUnknownTopLevelKeys(entry, allowedKeys) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return ['root: entry must be an object'];
  }
  return Object.keys(entry)
    .filter((key) => !allowedKeys.has(key))
    .sort()
    .map((key) => `root: unknown top-level key '${key}'`);
}

function validateTaxonomy(entry, taxonomies) {
  const errors = [];
  for (const topic of (entry.topics || [])) {
    if (!taxonomies.topics.has(topic)) {
      errors.push(`topics: unknown taxonomy id '${topic}'`);
    }
  }
  for (const tag of (entry.tags || [])) {
    if (!taxonomies.tags.has(tag)) {
      errors.push(`tags: unknown taxonomy id '${tag}'`);
    }
  }
  for (const targetGroup of (entry.targetGroups || [])) {
    if (!taxonomies.targetGroups.has(targetGroup)) {
      errors.push(`targetGroups: unknown taxonomy id '${targetGroup}'`);
    }
  }
  return errors;
}

function lintEntry(entry) {
  const warnings = [];
  if (!entry.summary || !entry.summary.de) warnings.push('missing summary.de');
  if (!entry.content || !entry.content.de) warnings.push('missing content.de');
  if (!entry.topics || entry.topics.length === 0) warnings.push('missing topics');
  if (!entry.tags || entry.tags.length === 0) warnings.push('missing tags');
  if (!entry.qualityScores) warnings.push('missing qualityScores');

  const hasEasyGerman = Boolean(entry.title?.easy_de) || Boolean(entry.translations?.['de-LEICHT']);
  if (!hasEasyGerman) warnings.push('missing Easy German translation (title.easy_de or translations.de-LEICHT)');

  return warnings;
}

function pickSamples(items, maxSamples) {
  return items.slice(0, Math.max(1, maxSamples));
}

function printHumanReport(report, options) {
  const { totals, byDomain, sampleFailures, sampleWarnings } = report;

  console.log('🔍 Systemfehler Entry Validation');
  console.log('================================');
  console.log(`Mode: ${options.ci ? 'CI' : 'local'}`);
  console.log(`Domains: ${Object.keys(byDomain).join(', ')}`);
  console.log(`Entries: ${totals.entries}`);
  console.log(`Schema/structural errors: ${totals.errors}`);
  console.log(`Lint warnings: ${totals.warnings}`);
  console.log('');

  for (const [domain, stats] of Object.entries(byDomain)) {
    console.log(`📁 ${domain}: ${stats.entries} entries, ${stats.errors} errors, ${stats.warnings} warnings`);
  }

  if (sampleFailures.length > 0) {
    console.log('\nSample failures:');
    for (const item of sampleFailures) {
      console.log(`- [${item.domain}] ${item.entryId}: ${item.message}`);
    }
  }

  if (sampleWarnings.length > 0) {
    console.log('\nSample warnings:');
    for (const item of sampleWarnings) {
      console.log(`- [${item.domain}] ${item.entryId}: ${item.message}`);
    }
  }
}

function printCiJson(report) {
  console.log(JSON.stringify(report, null, 2));
}

async function validateEntries() {
  const options = parseArgs();
  const domains = options.domain ? [options.domain] : DOMAINS;

  const schemasDir = join(process.cwd(), 'data', '_schemas');
  const coreSchema = loadJson(join(schemasDir, 'core.schema.json'));
  const extensionSchemas = Object.fromEntries(
    domains.map((domain) => [domain, loadJson(join(schemasDir, 'extensions', `${domain}.schema.json`))])
  );

  const taxonomies = {
    topics: toSetFromTaxonomy(join(process.cwd(), 'data', '_taxonomy', 'topics.json'), 'topics'),
    tags: toSetFromTaxonomy(join(process.cwd(), 'data', '_taxonomy', 'tags.json'), 'tags'),
    targetGroups: toSetFromTaxonomy(join(process.cwd(), 'data', '_taxonomy', 'target_groups.json'), 'targetGroups')
  };

  const ajv = makeAjv(coreSchema);
  const validateCore = ajv.compile(coreSchema);
  const validateExtensionByDomain = Object.fromEntries(
    Object.entries(extensionSchemas).map(([domain, schema]) => [domain, ajv.compile(schema)])
  );

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.ci ? 'ci' : 'local',
    totals: {
      entries: 0,
      errors: 0,
      warnings: 0,
      domainsProcessed: domains.length
    },
    byDomain: {},
    sampleFailures: [],
    sampleWarnings: []
  };

  for (const domain of domains) {
    const entriesPath = join(process.cwd(), 'data', domain, 'entries.json');
    if (!existsSync(entriesPath)) {
      report.byDomain[domain] = { entries: 0, errors: 0, warnings: 0, missingFile: true };
      continue;
    }

    const entries = asEntries(loadJson(entriesPath));
    const validateExtension = validateExtensionByDomain[domain];
    const allowedTopLevel = getAllowedTopLevelFields(coreSchema, extensionSchemas[domain]);

    let domainErrors = 0;
    let domainWarnings = 0;

    for (const entry of entries) {
      const entryId = entry?.id || '(missing-id)';
      report.totals.entries += 1;

      const coreOk = validateCore(entry);
      if (!coreOk) {
        for (const err of formatAjvErrors(validateCore.errors)) {
          report.sampleFailures.push({ domain, entryId, message: err });
          domainErrors += 1;
          report.totals.errors += 1;
        }
      }

      const extOk = validateExtension(entry);
      if (!extOk) {
        for (const err of formatAjvErrors(validateExtension.errors)) {
          report.sampleFailures.push({ domain, entryId, message: err });
          domainErrors += 1;
          report.totals.errors += 1;
        }
      }

      for (const err of checkUnknownTopLevelKeys(entry, allowedTopLevel)) {
        report.sampleFailures.push({ domain, entryId, message: err });
        domainErrors += 1;
        report.totals.errors += 1;
      }

      for (const err of validateTaxonomy(entry, taxonomies)) {
        report.sampleFailures.push({ domain, entryId, message: err });
        domainErrors += 1;
        report.totals.errors += 1;
      }

      for (const warning of lintEntry(entry)) {
        report.sampleWarnings.push({ domain, entryId, message: warning });
        domainWarnings += 1;
        report.totals.warnings += 1;
      }
    }

    report.byDomain[domain] = {
      entries: entries.length,
      errors: domainErrors,
      warnings: domainWarnings,
      missingFile: false
    };
  }

  report.sampleFailures = pickSamples(report.sampleFailures, options.maxSamples);
  report.sampleWarnings = pickSamples(report.sampleWarnings, options.maxSamples);

  if (options.ci) {
    printCiJson(report);
  } else {
    printHumanReport(report, options);
  }

  if (options.failOnErrors && report.totals.errors > 0) {
    process.exit(1);
  }
  process.exit(0);
}

validateEntries().catch(console.error);
