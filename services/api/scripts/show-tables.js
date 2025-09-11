import { open } from "sqlite";
import sqlite3 from "sqlite3";

const dbPath = "services/api/db/database.sqlite";

async function showTables() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  const tables = await db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`);
  console.log("Tabellen in der Datenbank:");
  for (const t of tables) {
    console.log("-", t.name);
  }
  await db.close();
}

showTables();
