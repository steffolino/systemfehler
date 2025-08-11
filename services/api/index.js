import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());

const root = path.resolve(process.cwd());              // services/api
const dataDir = path.join(root, 'data');
const repoRoot = path.resolve(root, '../..');          // repo root
const metaDir = path.join(repoRoot, 'data', 'meta');   // data/meta

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

app.get('/api/tools', (_req, res) => {
  const p = path.join(metaDir, 'tools.json');          // FIXED PATH
  res.json(readJSON(p));
});

app.get('/api/slogans', (_req, res) => {
  const p = path.join(metaDir, 'slogans.json');        // FIXED PATH
  res.json(readJSON(p));
});

app.get('/api/benefits', (_req, res) => {
  const p = path.join(dataDir, 'benefits.json');       // written by crawler
  if (!fs.existsSync(p)) return res.json([]);
  res.json(readJSON(p));
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
