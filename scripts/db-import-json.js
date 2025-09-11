// DB-First Importer: Importiert alle JSON-Daten ins neue Schema
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const DB_FILE = path.join(__dirname, '../.generated/local.sqlite');
const db = new sqlite3.Database(DB_FILE);

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function importOrganizations() {
  const contacts = readJson(path.join(__dirname, '../data/contacts/entries.json'));
  for (const c of contacts) {
    // Insert organization
    await run(
      `INSERT OR IGNORE INTO organization (id, name, kind_id, popularity_id) VALUES (?, ?, ?, ?)`,
      [c.domain, c.name || c.domain, 1, 1]
    );
    // Insert contact
    await run(
      `INSERT OR REPLACE INTO contact (id, organization_id, name, email, phone, address, opening_hours, source_url, domain, last_seen, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        c.domain,
        c.name,
        c.email,
        c.phone,
        c.address,
        c.opening_hours,
        c.source_url,
        c.domain,
        c.last_seen,
        JSON.stringify(c.tags || [])
      ]
    );
  }
}

async function importServices() {
  const benefits = readJson(path.join(__dirname, '../data/benefits/entries.json'));
  // Get canonical topic codes and their rowids
  const topicRows = await new Promise((resolve, reject) => {
    db.all('SELECT rowid, code FROM topic', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  const topicMap = Object.fromEntries(topicRows.map(r => [r.code, r.rowid]));
  for (const b of benefits) {
    // Insert service
    await run(
      `INSERT OR REPLACE INTO service (id, organization_id, kind_id, title, summary) VALUES (?, ?, ?, ?, ?)`,
      [
        b.id,
        b.source || 'org1',
        1,
        b.title,
        b.summary_de || b.summary_en || b.summary || ''
      ]
    );
    // Insert service_language
    if (Array.isArray(b.language)) {
      for (const lang of b.language) {
        await run(
          `INSERT OR IGNORE INTO service_language (service_id, language_id) VALUES (?, ?)`,
          [b.id, lang === 'de' ? 1 : 2]
        );
      }
    }
    // Insert service_topic using canonical topic IDs
    if (Array.isArray(b.topic)) {
      for (const t of b.topic) {
        const topicId = topicMap[t];
        if (topicId) {
          await run(
            `INSERT OR IGNORE INTO service_topic (service_id, topic_id) VALUES (?, ?)`,
            [b.id, topicId]
          );
        }
      }
    }
  }
}

async function importItems() {
  const tools = readJson(path.join(__dirname, '../data/tools/entries.json'));
  for (const t of tools) {
    await run(
      `INSERT OR REPLACE INTO knowledge_item (id, organization_id, kind_id, title, summary) VALUES (?, ?, ?, ?, ?)`,
      [
        t.id,
        t.category || 'org1',
        1,
        t.title_de || t.title_en || t.title,
        t.summary_de || t.summary_en || ''
      ]
    );
    // Insert item_language
    if (Array.isArray(t.language)) {
      for (const lang of t.language) {
        await run(
          `INSERT OR IGNORE INTO item_language (item_id, language_id) VALUES (?, ?)`,
          [t.id, lang === 'de' ? 1 : 2]
        );
      }
    }
    // Insert item_topic
    if (Array.isArray(t.topic)) {
      for (const topic of t.topic) {
        await run(
          `INSERT OR IGNORE INTO item_topic (item_id, topic_id) VALUES (?, ?)`,
          [t.id, topic === 'Wohnen' ? 1 : topic === 'Soziales' ? 2 : topic === 'Gesundheit' ? 3 : 1]
        );
      }
    }
  }
}

async function main() {
  await importOrganizations();
  await importServices();
  await importItems();
  db.close();
  console.log('DB import from JSON complete.');
}

main();
