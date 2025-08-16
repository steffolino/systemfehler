import express from 'express'
import fs from 'fs'
import path from 'path'
import cors from 'cors'
import { fileURLToPath } from 'url'
import pkg from 'pg'

const { Pool } = pkg
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/systemfehler' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
app.use(cors())

// Resolve paths relative to *this* file, not the shell CWD
const root = __dirname                        // services/api
const dataDir = path.join(root, 'data')
const repoRoot = path.resolve(root, '../..')  // repo root
const metaDir = path.join(repoRoot, 'data', 'meta')

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

app.get('/api/tools', (_req, res) => {
  res.json(readJSON(path.join(metaDir, 'tools.json')))
})

app.get('/api/slogans', (_req, res) => {
  res.json(readJSON(path.join(metaDir, 'slogans.json')))
})

app.get('/api/benefits', (_req, res) => {
  const p = path.join(dataDir, 'benefits.json') // written by crawler
  if (!fs.existsSync(p)) return res.json([])
  res.json(readJSON(p))
})

app.post('/admin/refresh-search', async (req,res) => {
  try {
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY entries_mv;')
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ ok:false, error: String(e) })
  }
})


// optional convenience: /api/benefits/:id
app.get('/api/benefits/:id', (req, res) => {
  const p = path.join(dataDir, 'benefits.json')
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'not found' })
  const all = readJSON(p)
  const i = Number.parseInt(String(req.params.id), 10)
  if (Number.isNaN(i) || i < 0 || i >= all.length) return res.status(404).json({ error: 'not found' })
  res.json(all[i])
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
