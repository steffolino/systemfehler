import fs from "fs";
import path from "path";

const sqlite3 = (await import("sqlite3")).default;
const { open } = await import("sqlite");

// Ensure db directory exists
const dbPath = ".generated/local.sqlite";
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

async function main() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Ensure tables exist (minimal migration)
  // Keine Migration mehr nötig, Tabelle contact ist im Schema vorhanden

  // Robust: Suche zuerst im data-Verzeichnis relativ zum Projekt-Root, dann im Skriptverzeichnis, dann als Parameter
  let dataPath = path.resolve(process.cwd(), "data/contacts/entries.json");
  if (!fs.existsSync(dataPath)) {
    dataPath = path.resolve(__dirname, "../../../data/contacts/entries.json");
  }
  if (!fs.existsSync(dataPath) && process.argv[2]) {
    dataPath = process.argv[2];
  }
  if (!fs.existsSync(dataPath)) {
    throw new Error(`entries.json nicht gefunden: ${dataPath}`);
  }
  console.log('Using contacts data:', dataPath);
  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  let imported = 0, skipped = 0;
  for (const rec of data) {
    try {
      await db.run(
        `INSERT OR REPLACE INTO contact (id, organization_id, name, email, phone, address, opening_hours, source_url, domain, last_seen, tags, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          rec.id,
          rec.organization_id || null,
          rec.name,
          rec.email,
          rec.phone,
          rec.address,
          rec.opening_hours,
          rec.source_url,
          rec.domain,
          rec.last_seen,
          JSON.stringify(rec.tags || [])
        ]
      );
      imported++;
    } catch (e) {
      skipped++;
    }
  }
  await db.close();
  console.log(`Seeded contacts. Imported: ${imported}, Skipped: ${skipped}`);
}

main();
