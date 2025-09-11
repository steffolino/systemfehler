import fs from "fs";

const sqlite3 = (await import("sqlite3")).default;
const { open } = await import("sqlite");

async function main() {
  const db = await open({
    filename: ".generated/local.sqlite",
    driver: sqlite3.Database,
  });
  // Ensure AidOffer table exists
  await db.exec(`CREATE TABLE IF NOT EXISTS AidOffer (
    id TEXT PRIMARY KEY,
    title TEXT,
    summary TEXT,
    organization TEXT,
    region TEXT,
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
    data = JSON.parse(fs.readFileSync("data/aid/entries.json", "utf-8"));
  } catch {}
  let imported = 0, skipped = 0;
  for (const rec of data) {
    try {
      await db.run(
        `INSERT OR REPLACE INTO AidOffer (id, title, summary, organization, region, topic, source_url, domain, last_seen, tags, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rec.id,
          rec.title,
          rec.summary,
          rec.organization,
          rec.region,
          JSON.stringify(rec.topic || []),
          rec.source_url,
          rec.domain,
          rec.last_seen,
          JSON.stringify(rec.tags || []),
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );
      imported++;
    } catch (e) {
      skipped++;
    }
  }
  await db.close();
  console.log(`Seeded aid offers. Imported: ${imported}, Skipped: ${skipped}`);
}

main();
