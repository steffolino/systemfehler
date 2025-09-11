import { open } from "sqlite";
import sqlite3 from "sqlite3";

const dbPath = "services/api/db/database.sqlite";
const tables = ["AidOffer", "benefit", "Contact", "CrawlResult", "Tool"];

async function showTableRows() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  for (const table of tables) {
    const count = await db.get(`SELECT COUNT(*) as cnt FROM ${table}`);
    console.log(`${table}: ${count.cnt} rows`);
  }
  await db.close();
}

showTableRows();
