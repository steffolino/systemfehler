#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import pg from 'pg'
import { PrismaClient } from '@prisma/client'
// services/ingest/ingest.ts
import type { Benefit, Tool, AidOffer, RelatedLink } from '@prisma/client'

// example: a function shaped by DB types
function formatBenefit(b: Benefit) {
  return { id: b.id, title: b.title_de, topics: b.topic }
}


dotenv.config({ path: path.resolve(process.cwd(), '.env') })
const { Client } = pg
const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/systemfehler'

function slugify(s = '') {
  return s.toLowerCase()
    .normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}
const shash = (s) => createHash('sha1').update(s).digest('hex').slice(0, 12)
const idFor = (kind, title) => `${kind}.${slugify(title || 'unknown')}`
const rlId = (kind, parentId, url) => `rl.${kind}.${shash(parentId + '|' + url)}`

async function upsertBenefit(c, rec) {
  const id = rec.id || idFor('benefit', rec.title_de || rec.title_en || rec.title)
  const title_de = rec.title_de || rec.title || '';
  const title_en = rec.title_en || '';
  const summary_de = rec.summary_de || '';
  const summary_en = rec.summary_en || '';
  const topic = Array.isArray(rec.topic) ? rec.topic : [rec.topic || ''];
  const language = Array.isArray(rec.language) ? rec.language : [rec.language || 'de'];
  try {
    await c.query(`
      INSERT INTO "Benefit"(id, title_de, title_en, summary_de, summary_en, topic, language, "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6::text[],$7::text[], now(), now())
      ON CONFLICT (id) DO UPDATE SET
        title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,
        summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,
        topic=EXCLUDED.topic, language=EXCLUDED.language, "updatedAt"=now()
    `, [id, title_de, title_en, summary_de, summary_en, topic, language])
    console.log(`[Benefit] Upserted: ${id}`)
    await upsertLinks(c, 'benefit', id, rec.links || [])
    return true;
  } catch (e) {
    console.warn(`[Benefit] Failed: ${id}`, e)
    return false;
  }
}

async function upsertTool(c, rec) {
  const id = rec.id || idFor('tool', rec.title_de || rec.title_en || rec.title)
  const title_de = rec.title_de || rec.title || '';
  const title_en = rec.title_en || '';
  const summary_de = rec.summary_de || '';
  const summary_en = rec.summary_en || '';
  const url = rec.url || null;
  const category = rec.category || null;
  const language = Array.isArray(rec.language) ? rec.language : [rec.language || 'de'];
  const topic = Array.isArray(rec.topic) ? rec.topic : [rec.topic || ''];
  try {
    await c.query(`
      INSERT INTO "Tool"(id, title_de, title_en, summary_de, summary_en, url, category, language, topic, "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9::text[], now(), now())
      ON CONFLICT (id) DO UPDATE SET
        title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,
        summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,
        url=EXCLUDED.url, category=EXCLUDED.category,
        language=EXCLUDED.language, topic=EXCLUDED.topic, "updatedAt"=now()
    `, [id, title_de, title_en, summary_de, summary_en, url, category, language, topic])
    console.log(`[Tool] Upserted: ${id}`)
    await upsertLinks(c, 'tool', id, rec.links || [])
    return true;
  } catch (e) {
    console.warn(`[Tool] Failed: ${id}`, e)
    return false;
  }
}

async function upsertAid(c, rec) {
  const id = rec.id || idFor('aid', rec.title_de || rec.title_en || rec.title)
  const title_de = rec.title_de || rec.title || '';
  const title_en = rec.title_en || '';
  const summary_de = rec.summary_de || '';
  const summary_en = rec.summary_en || '';
  const organization = rec.organization || null;
  const contact = rec.contact || null;
  const region = rec.region || null;
  const language = Array.isArray(rec.language) ? rec.language : [rec.language || 'de'];
  const topic = Array.isArray(rec.topic) ? rec.topic : [rec.topic || ''];
  try {
    await c.query(`
      INSERT INTO "AidOffer"(id, title_de, title_en, summary_de, summary_en, organization, contact, region, language, topic, "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::text[], now(), now())
      ON CONFLICT (id) DO UPDATE SET
        title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,
        summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,
        organization=EXCLUDED.organization, contact=EXCLUDED.contact, region=EXCLUDED.region,
        language=EXCLUDED.language, topic=EXCLUDED.topic, "updatedAt"=now()
    `, [id, title_de, title_en, summary_de, summary_en, organization, contact, region, language, topic])
    console.log(`[AidOffer] Upserted: ${id}`)
    await upsertLinks(c, 'aid', id, rec.links || [])
    return true;
  } catch (e) {
    console.warn(`[AidOffer] Failed: ${id}`, e)
    return false;
  }
}

async function upsertLinks(c, kind, parentId, links) {
  const fk = kind === 'benefit' ? 'benefitId' : kind === 'tool' ? 'toolId' : 'aidOfferId'
  for (const l of links) {
    if (!l?.url) continue
    const id = l.id || rlId(kind, parentId, l.url)
    await c.query(`
      INSERT INTO "RelatedLink"(id, url, title, relation, "proposedAsEntry", status, "${fk}")
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET
        url=EXCLUDED.url, title=EXCLUDED.title, relation=EXCLUDED.relation,
        "proposedAsEntry"=EXCLUDED."proposedAsEntry", status=EXCLUDED.status, "${fk}"=EXCLUDED."${fk}"
    `, [
      id, l.url, l.title || null, l.relation || null,
      Boolean(l.proposedAsEntry) || false, l.status || 'pending',
      parentId
    ])
  }
}

async function refreshMV(c) {
  await c.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY entries_mv;`)
}

async function ingestNdjsonFile(client, filePath) {
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
  let n = 0, nBenefit = 0, nTool = 0, nAid = 0, nSkipped = 0, nDup = 0, nInvalid = 0;
  const dryRun = process.argv.includes('--dry-run');
  const seenIds = new Set();
  for await (const line of rl) {
    const s = line.trim()
    if (!s) continue
    let rec
    try { rec = JSON.parse(s) } catch { console.warn('Skip bad JSON:', s); nSkipped++; nInvalid++; continue }
    if (!rec.kind) { console.warn('Skip missing kind:', s); nSkipped++; nInvalid++; continue }
    // Pflichtfelder prüfen
    if (!rec.id || (!rec.title && !rec.title_de && !rec.name)) {
      console.warn('Skip missing id/title:', rec);
      nSkipped++; nInvalid++; continue;
    }
    // Duplikate prüfen
    if (seenIds.has(rec.id)) {
      console.warn('Skip duplicate id:', rec.id);
      nSkipped++; nDup++; continue;
    }
    seenIds.add(rec.id);
    // Dry-Run: nur validieren, nicht schreiben
    if (dryRun) {
      n++;
      continue;
    }
    if (rec.kind === 'benefit')      { if (await upsertBenefit(client, rec)) nBenefit++; else nSkipped++; }
    else if (rec.kind === 'tool')    { if (await upsertTool(client, rec)) nTool++; else nSkipped++; }
    else if (rec.kind === 'aid')     { if (await upsertAid(client, rec)) nAid++; else nSkipped++; }
    else { console.warn('Unknown kind:', rec.kind); nSkipped++; nInvalid++; continue }
    n++
  }
  console.log(`[Summary] Benefits: ${nBenefit}, Tools: ${nTool}, AidOffers: ${nAid}, Skipped: ${nSkipped}, Duplicates: ${nDup}, Invalid: ${nInvalid}`);
  return n
}

async function run() {
  const args = process.argv.slice(2)
  const pFile = args.indexOf('--file') >= 0 ? args[args.indexOf('--file') + 1] : null
  const pDir  = args.indexOf('--dir')  >= 0 ? args[args.indexOf('--dir')  + 1] : null
  const refreshOnly = args.includes('--refresh-only')

  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  try {
    if (refreshOnly) {
      await refreshMV(client)
      console.log('REFRESH OK')
      return
    }

    await client.query('BEGIN')
    let total = 0
    if (pFile) {
      if (!fs.existsSync(pFile)) {
        console.error(`File not found: ${pFile}`)
        process.exit(2)
      }
      total += await ingestNdjsonFile(client, path.resolve(pFile))
    } else if (pDir) {
      if (!fs.existsSync(pDir) || !fs.statSync(pDir).isDirectory()) {
        console.error(`Directory not found: ${pDir}`)
        process.exit(2)
      }
      const files = fs.readdirSync(pDir).filter(f => f.endsWith('.ndjson'))
      if (files.length === 0) {
        console.error(`No .ndjson files found in directory: ${pDir}`)
        process.exit(2)
      }
      for (const f of files) total += await ingestNdjsonFile(client, path.join(pDir, f))
    } else {
      console.error('Usage: node ingest.js --file <path.ndjson> | --dir <folder>')
      process.exit(2)
    }
    await client.query('COMMIT')
    console.log(`UPSERTS: ${total}`)

    await refreshMV(client)
    console.log('REFRESH OK')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run().catch(e => { console.error(e); process.exit(1) })
