// services/api/scripts/d1-seed-from-json.js
import { readFileSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : def;
}

const table = arg("table");
const cols = arg("cols");
const file = arg("file");
const cfg  = arg("config", "services/api/wrangler.toml");
const useRemote = process.argv.includes("--remote");

if (!table || !cols || !file) {
  console.error("Missing args. Required: --table, --cols, --file");
  process.exit(1);
}
const columns = cols.split(",").map((s) => s.trim()).filter(Boolean);

// --- Robust loader: JSON array OR JSONL; strip BOM/ANSI/garbage ---
function loadItems(p) {
  let raw = readFileSync(p, "utf8");

  // Strip BOM
  raw = raw.replace(/^\uFEFF/, "");
  // Strip ANSI escape sequences
  raw = raw.replace(/\x1b\[[0-9;]*m/g, "");
  // Strip junk before first [ or { (e.g., stray chars like "e[")
  raw = raw.replace(/^[^\[\{]+(?=[\[\{])/, "").trim();

  // First try regular JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.items)) return parsed.items;
  } catch (_) {
    // fallthrough to JSONL
  }

  // Try JSON Lines: one {..} per line
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const arr = [];
  for (const line of lines) {
    try {
      if (!line) continue;
      // allow trailing commas
      const cleaned = line.replace(/,(\s*[}\]])/g, "$1");
      const obj = JSON.parse(cleaned);
      if (obj && typeof obj === "object") arr.push(obj);
    } catch (_) {
      // ignore bad lines
    }
  }
  if (arr.length) return arr;

  throw new Error("Could not parse JSON/JSONL in " + p);
}

const items = loadItems(file);
if (!items.length) {
  console.error(`No items found in ${file}`);
  process.exit(1);
}

function toSqlLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (Array.isArray(v) || typeof v === "object") v = JSON.stringify(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

const sqlLines = [];
sqlLines.push("BEGIN TRANSACTION;");
for (const rec of items) {
  const vals = columns.map((c) => toSqlLiteral(rec[c]));
  sqlLines.push(`INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES (${vals.join(",")});`);
}
sqlLines.push("COMMIT;");

const outFile = path.join("services", "api", "db", `seed-${table}.sql`);
writeFileSync(outFile, sqlLines.join("\n"), "utf8");
console.log(`Wrote ${outFile} with ${items.length} rows.`);

const args = ["d1", "execute", "systemfehler-db", "--file", outFile, "--config", cfg];
if (!useRemote) args.splice(3, 0, "--local");

const { status } = spawnSync("wrangler", args, { stdio: "inherit", shell: true });
process.exit(status ?? 0);
