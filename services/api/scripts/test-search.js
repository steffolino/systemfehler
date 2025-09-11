import { open } from "sqlite";
import sqlite3 from "sqlite3";

const dbPath = "services/api/db/database.sqlite";
const tables = ["AidOffer", "benefit", "Contact", "Tool"];

async function testSearchQuery(q = "kind") {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  for (const table of tables) {
    const sql = `SELECT id, title, name, summary, source_url, domain, updatedAt FROM ${table} WHERE (title LIKE ? OR name LIKE ? OR summary LIKE ?) LIMIT 10`;
    try {
      const rows = await db.all(sql, [`%${q}%`, `%${q}%`, `%${q}%`]);
      console.log(`${table}: ${rows.length} Treffer`);
      if (rows.length) {
        console.log(rows.map(r => r.id));
      }
    } catch (err) {
      console.error(`${table}:`, err.message);
    }
  }
  await db.close();
}

testSearchQuery();
