#!/usr/bin/env zx
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const MIG_DIR = 'migrations';
const OUT_DIR = '.generated';
const DB_FILE = path.join(OUT_DIR, 'local.sqlite');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);
if (fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);

const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run('PRAGMA foreign_keys=ON;');
  const files = fs.readdirSync(MIG_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a,b)=> a.localeCompare(b, 'en', {numeric:true}));
  for (const f of files) {
    const sql = fs.readFileSync(path.join(MIG_DIR, f), 'utf-8');
    db.exec(sql, (err) => {
      if (err) {
        console.error('Error applying', f, err.message);
      } else {
        console.log('applied', f);
      }
    });
  }
});
db.close(() => {
  console.log('local sqlite ready at', DB_FILE);
});
