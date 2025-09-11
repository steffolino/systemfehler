import fs from "fs";
import path from "path";
const sqlite3 = (await import("sqlite3")).default;
const { open } = await import("sqlite");

const dbPath = ".generated/local.sqlite";
const dataPath = path.resolve(process.cwd(), "data/tools/entries.json");

// Ensure db directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

class BaseResult {
  constructor(obj) {
    Object.assign(this, obj);
    this.createdAt = this.createdAt || new Date().toISOString();
    this.updatedAt = this.updatedAt || new Date().toISOString();
  }
}

class ToolResult extends BaseResult {
  constructor(obj) {
    super(obj);
  }
}

async function main() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  // Drop old Tool table if exists
  await db.exec("DROP TABLE IF EXISTS Tool;");
  // Create new Tool table
  await db.exec(`CREATE TABLE IF NOT EXISTS Tool (
    id TEXT PRIMARY KEY,
    title_de TEXT,
    title_en TEXT,
    url TEXT,
    summary_de TEXT,
    summary_en TEXT,
    category TEXT,
    topic TEXT,
    language TEXT,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
  );`);

  let data = [];
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch (err) {
    console.error("tools entries.json not found or invalid", err);
    return;
  }

  let imported = 0, skipped = 0;
  for (const rec of data) {
    try {
      const tool = new ToolResult(rec);
      await db.run(
        `INSERT OR REPLACE INTO Tool (id, title_de, title_en, url, summary_de, summary_en, category, topic, language, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tool.id,
          tool.title_de,
          tool.title_en,
          tool.url,
          tool.summary_de,
          tool.summary_en,
          tool.category,
          JSON.stringify(Array.isArray(tool.topic) ? tool.topic : [tool.topic]),
          JSON.stringify(Array.isArray(tool.language) ? tool.language : [tool.language]),
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
  console.log(`Seeded tools. Imported: ${imported}, Skipped: ${skipped}`);
}

main();
