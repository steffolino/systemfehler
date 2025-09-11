import fs from "fs";

const sqlite3 = (await import("sqlite3")).default;
const { open } = await import("sqlite");

async function main() {
  const db = await open({
    filename: ".generated/local.sqlite",
    driver: sqlite3.Database,
  });
  // Ensure Benefit table exists
  await db.exec(`CREATE TABLE IF NOT EXISTS benefit (
    id TEXT PRIMARY KEY,
    title TEXT,
    summary TEXT,
    topic TEXT,
    source_url TEXT,
    domain TEXT,
    last_seen TEXT,
    tags TEXT,
    crawl_id INTEGER,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (crawl_id) REFERENCES CrawlResult(id)
  );`);
  let data = [];
  try {
    data = JSON.parse(fs.readFileSync("data/benefits/entries.json", "utf-8"));
  } catch {}
  let imported = 0, skipped = 0;
  for (const rec of data) {
    try {
      let topic = Array.isArray(rec.topic) ? rec.topic : (typeof rec.topic === 'string' ? JSON.parse(rec.topic) : []);
      let tags = Array.isArray(rec.tags) ? rec.tags : (typeof rec.tags === 'string' ? JSON.parse(rec.tags) : []);
      let summary = rec.summary ?? rec.summary_de ?? rec.summary_en ?? null;
      let source_url = rec.source_url ?? rec.source ?? null;
      await db.run(
        `INSERT OR REPLACE INTO benefit (id, title, summary, topic, source_url, domain, last_seen, tags, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rec.id,
          rec.title,
          summary,
          JSON.stringify(Array.isArray(topic) ? topic : [topic]),
          source_url,
          rec.domain,
          rec.last_seen,
          JSON.stringify(Array.isArray(tags) ? tags : [tags]),
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
      imported++;
    } catch (e) {
      skipped++;
    }
  }
  await db.close();
  console.log(`Seeded benefits. Imported: ${imported}, Skipped: ${skipped}`);
}

main();
