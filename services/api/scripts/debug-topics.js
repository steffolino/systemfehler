import { open } from "sqlite";
import sqlite3 from "sqlite3";

const dbPath = "services/api/db/database.sqlite";

async function debugTopics() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  // Try to aggregate topics from all tables
  const sql = `
    SELECT DISTINCT value AS topic FROM (
  SELECT value FROM json_each(topic) WHERE EXISTS (SELECT 1 FROM benefit)
      UNION ALL
      SELECT value FROM json_each(topic) WHERE EXISTS (SELECT 1 FROM AidOffer)
      UNION ALL
      SELECT value FROM json_each(topic) WHERE EXISTS (SELECT 1 FROM Tool)
    ) LIMIT 20
  `;
  try {
    const rows = await db.all(sql);
    console.log("Topics:", rows.map(r => r.topic));
  } catch (err) {
    console.error("SQL error:", err.message);
  }
  await db.close();
}

debugTopics();
