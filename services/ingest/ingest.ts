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
  await c.query(`
    INSERT INTO "Benefit"(id, title_de, title_en, summary_de, summary_en, topic, language, "createdAt", "updatedAt")
    VALUES ($1,$2,$3,$4,$5,$6::text[],$7::text[], now(), now())
    ON CONFLICT (id) DO UPDATE SET
      title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,
      summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,
      topic=EXCLUDED.topic, language=EXCLUDED.language, "updatedAt"=now()
  `, [
    id, rec.title_de || '', rec.title_en || '',
    rec.summary_de || '', rec.summary_en || '',
    rec.topic || [], rec.language || ['de']
  ])
  await upsertLinks(c, 'benefit', id, rec.links || [])
}

async function upsertTool(c, rec) {
  const id = rec.id || idFor('tool', rec.title_de || rec.title_en || rec.title)
  await c.query(`
    INSERT INTO "Tool"(id, title_de, title_en, summary_de, summary_en, url, category, language, topic, "createdAt", "updatedAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8::text[],$9::text[], now(), now())
    ON CONFLICT (id) DO UPDATE SET
      title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,
      summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,
      url=EXCLUDED.url, category=EXCLUDED.category,
      language=EXCLUDED.language, topic=EXCLUDED.topic, "updatedAt"=now()
  `, [
    id, rec.title_de || '', rec.title_en || '',
    rec.summary_de || '', rec.summary_en || '',
    rec.url || null, rec.category || null,
    rec.language || ['de'], rec.topic || []
  ])
  await upsertLinks(c, 'tool', id, rec.links || [])
}

async function upsertAid(c, rec) {
  const id = rec.id || idFor('aid', rec.title_de || rec.title_en || rec.title)
  await c.query(`
    INSERT INTO "AidOffer"(id, title_de, title_en, summary_de, summary_en, organization, contact, region, language, topic, "createdAt", "updatedAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::text[], now(), now())
    ON CONFLICT (id) DO UPDATE SET
      title_de=EXCLUDED.title_de, title_en=EXCLUDED.title_en,
      summary_de=EXCLUDED.summary_de, summary_en=EXCLUDED.summary_en,
      organization=EXCLUDED.organization, contact=EXCLUDED.contact, region=EXCLUDED.region,
      language=EXCLUDED.language, topic=EXCLUDED.topic, "updatedAt"=now()
  `, [
    id, rec.title_de || '', rec.title_en || '',
    rec.summary_de || '', rec.summary_en || '',
    rec.organization || null, rec.contact || null, rec.region || null,
    rec.language || ['de'], rec.topic || []
  ])
  await upsertLinks(c, 'aid', id, rec.links || [])
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
  let n = 0
  for await (const line of rl) {
    const s = line.trim()
    if (!s) continue
    let rec
    try { rec = JSON.parse(s) } catch { console.warn('Skip bad JSON:', s); continue }
    if (!rec.kind) { console.warn('Skip missing kind:', s); continue }
    if (rec.kind === 'benefit')      await upsertBenefit(client, rec)
    else if (rec.kind === 'tool')    await upsertTool(client, rec)
    else if (rec.kind === 'aid')     await upsertAid(client, rec)
    else { console.warn('Unknown kind:', rec.kind); continue }
    n++
  }
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
      total += await ingestNdjsonFile(client, path.resolve(pFile))
    } else if (pDir) {
      const files = fs.readdirSync(pDir).filter(f => f.endsWith('.ndjson'))
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
