#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const SCHEMA_FILE = path.resolve(process.cwd(), 'backend', 'database', 'schema.sql');
const OUT_FILE = path.resolve(process.cwd(), 'frontend', 'src', 'lib', 'db_types.ts');

if (!fs.existsSync(SCHEMA_FILE)) {
  console.error('schema.sql not found at', SCHEMA_FILE);
  process.exit(1);
}

const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');

// Parse ENUM types
const enumRegex = /CREATE TYPE\s+(\w+)\s+AS\s+ENUM\s*\(([^;]+?)\);/gims;
const enums = {};
let m;
while ((m = enumRegex.exec(sql)) !== null) {
  const name = m[1];
  const valsRaw = m[2];
  const vals = Array.from(valsRaw.matchAll(/'([^']+)'/g)).map(x => x[1]);
  enums[name] = vals;
}

const enumNames = new Set(Object.keys(enums));

// Parse CREATE TABLE blocks
const tableRegex = /CREATE TABLE\s+(\w+)\s*\(([^;]+?)\);/gims;
const tables = {};
while ((m = tableRegex.exec(sql)) !== null) {
  const name = m[1];
  const body = m[2];
  // split by lines and collect column definitions until a line that starts with ')' or contains constraint-only lines
  const rawLines = body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const cols = [];
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];
    // stop if we hit a table-level constraint or closing
    if (line.startsWith(')') || line.toUpperCase().startsWith('CONSTRAINT') || line.toUpperCase().startsWith('PRIMARY KEY') || line.toUpperCase().startsWith('UNIQUE')) break;
    // remove trailing commas
    if (line.endsWith(',')) line = line.slice(0, -1).trim();
    // skip comments
    if (line.startsWith('--')) continue;
    const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+(.+)$/);
    if (!colMatch) continue;
    let [, colName, rest] = colMatch;
    // remove inline constraints keywords for type extraction
    rest = rest.replace(/\s+DEFAULT\s+[^,]+/i, '').replace(/\s+PRIMARY KEY/i, '').replace(/\s+NOT NULL/i, '').replace(/\s+REFERENCES\s+[^\s]+\s*\([^\)]+\)/i, '').trim();
    // collapse multiple spaces
    rest = rest.replace(/\s+/g, ' ');
    cols.push({ name: colName, type: rest });
  }
  tables[name] = cols;
}

function jsonColumnType(columnName) {
  switch (columnName) {
    case 'provenance':
      return 'DbProvenance | null';
    case 'translations':
      return 'DbTranslationsMap | null';
    case 'quality_scores':
      return 'DbQualityScores | null';
    case 'candidate_data':
    case 'existing_data':
    case 'diff':
    case 'details':
    case 'contact_info':
      return 'Record<string, unknown> | null';
    case 'application_steps':
    case 'required_documents':
    case 'application_process':
    case 'features':
    case 'services_offered':
    case 'locations':
      return 'unknown[]';
    default:
      return 'Record<string, unknown> | null';
  }
}

function scalarSqlTypeToTs(type) {
  const normalized = type.toLowerCase();
  if (enumNames.has(type)) return type;
  if (normalized.startsWith('uuid')) return 'string';
  if (normalized.startsWith('text') || normalized.startsWith('varchar') || normalized.startsWith('character')) return 'string';
  if (normalized.startsWith('timestamp') || normalized.startsWith('date') || normalized.startsWith('time')) return 'string';
  if (normalized.includes('boolean')) return 'boolean';
  if (normalized.includes('numeric') || normalized.includes('int') || normalized.includes('decimal')) return 'number';
  return 'unknown';
}

function sqlTypeToTs(type, columnName) {
  const normalized = type.toLowerCase();

  if (normalized.endsWith('[]')) {
    const baseType = type.slice(0, -2).trim();
    const scalarType = scalarSqlTypeToTs(baseType);
    return `${scalarType}[]`;
  }

  if (normalized.includes('json')) {
    return jsonColumnType(columnName);
  }

  return scalarSqlTypeToTs(type);
}

let out = `/* AUTO-GENERATED FROM backend/database/schema.sql - DO NOT EDIT BY HAND */\n\n`;
out += `export interface DbMultilingualText {\n`;
out += `  de?: string | null;\n`;
out += `  en?: string | null;\n`;
out += `  easy_de?: string | null;\n`;
out += `  [key: string]: string | null | undefined;\n`;
out += `}\n\n`;
out += `export interface DbProvenance {\n`;
out += `  source: string;\n`;
out += `  crawlId?: string;\n`;
out += `  crawlerVersion?: string;\n`;
out += `  checksum?: string;\n`;
out += `  crawledAt: string;\n`;
out += `  method?: string;\n`;
out += `  generator?: string;\n`;
out += `  [key: string]: string | undefined;\n`;
out += `}\n\n`;
out += `export interface DbTranslationRecord {\n`;
out += `  title: string;\n`;
out += `  summary?: string;\n`;
out += `  body?: string;\n`;
out += `  provenance: DbProvenance;\n`;
out += `  method?: 'llm' | 'rule' | 'human' | 'mt';\n`;
out += `  generator?: string;\n`;
out += `  timestamp: string;\n`;
out += `  reviewed?: boolean;\n`;
out += `}\n\n`;
out += `export type DbTranslationsMap = Record<string, DbTranslationRecord>;\n\n`;
out += `export interface DbQualityScores {\n`;
out += `  iqs?: number;\n`;
out += `  ais?: number;\n`;
out += `  computedAt?: string;\n`;
out += `  [key: string]: number | string | undefined;\n`;
out += `}\n\n`;
// emit enums
for (const [ename, vals] of Object.entries(enums)) {
  const union = vals.map(v => `'${v}'`).join(' | ');
  out += `export type ${ename} = ${union};\n\n`;
}

for (const [tname, cols] of Object.entries(tables)) {
  const intName = tname.split('_').map((s,i)=> i===0? s : s[0].toUpperCase()+s.slice(1)).join('');
  out += `export interface ${intName} {\n`;
  for (const col of cols) {
    const tsType = sqlTypeToTs(col.type, col.name);
    out += `  ${col.name}?: ${tsType};\n`;
  }
  out += `}\n\n`;
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, out, 'utf8');
console.log('Wrote', OUT_FILE);
