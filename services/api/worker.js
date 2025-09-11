import { Hono } from "hono";
import { cors } from "hono/cors";

// -------- Hilfsfunktionen --------

async function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const result = await stmt.all(...params);
  return Array.isArray(result?.results) ? result.results : [];
}

async function run(db, sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

function normalizeTopics(value) {
  if (!value) return [];
  const v = String(value).trim();
  try {
    if (v.startsWith("[")) {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) {
        return arr.map((x) => String(x).trim()).filter(Boolean);
      }
    }
  } catch {}
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

async function listTopicsD1(db, limit = 12) {

  const res = await db.prepare("SELECT topic FROM benefit WHERE topic IS NOT NULL").all();
  const rows = res?.results ?? [];

  const counts = new Map();
  for (const r of rows) {
    if (r?.topic) {
      for (const t of normalizeTopics(r.topic)) {
        const key = t.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic, count]) => ({ topic, count }));
}

// -------- Hono Worker-App --------

const app = new Hono();

app.use("/*", cors());

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// Topics endpoint
app.get("/api/search/topics", async (c) => {
  const url = new URL(c.req.url);
  const limit = Number(url.searchParams.get("limit") ?? "12");
  try {
    const data = await listTopicsD1(c.env.DB, limit);
    return c.json(data);
  } catch (err) {
    console.error("topics error:", err);
    return c.json({ error: "Internal Server Error", details: String(err?.message) }, 500);
  }
});

// SEARCH ENDPOINT
app.get("/api/search", async (c) => {
  const url = new URL(c.req.url);
  const q = url.searchParams.get("q") || "";
  const entity = url.searchParams.get("entity");
  const limit = Number(url.searchParams.get("limit") || "20");
  const allowedEntities = ["benefit"];
  let results = [];
  try {
    for (const ent of (entity ? [entity] : allowedEntities)) {
  const sql = `SELECT * FROM benefit LIMIT 10`;
  const rows = await queryAll(c.env.DB, sql);
      if (Array.isArray(rows)) {
        rows.forEach((row) => {
          results.push({
            entity: ent,
            ...row
          });
        });
      }
    }
    return c.json({ results, count: results.length });
  } catch (err) {
    console.error("[search] error:", err);
    return c.json({ error: "Internal Server Error", details: String(err?.message) }, 500);
  }
});

// Benefits CRUD
app.get("/api/benefits", async (c) => {
  try {
    const rows = await queryAll(c.env.DB, "SELECT * FROM benefit");
    console.log("[benefits] rows:", rows);
    return c.json(rows);
  } catch (err) {
    console.error("[benefits] error:", err);
    return c.json({ error: "Internal Server Error", details: String(err?.message) }, 500);
  }
});

app.get("/api/benefits/:id", async (c) => {
  const { id } = c.req.param();
  const rows = await queryAll(c.env.DB, "SELECT * FROM benefit WHERE id = ?", [id]);
  if (!rows.length) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

app.post("/api/benefits", async (c) => {
  const body = await c.req.json();
  const keys = Object.keys(body);
  const values = Object.values(body);
  if (!keys.length) return c.json({ error: "No data" }, 400);
  const placeholders = keys.map(() => "?").join(", ");
  await run(
    c.env.DB,
  `INSERT INTO benefit (${keys.join(", ")}) VALUES (${placeholders})`,
    values
  );
  return c.json({ success: true });
});

app.put("/api/benefits/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const keys = Object.keys(body);
  const values = Object.values(body);
  if (!keys.length) return c.json({ error: "No fields provided" }, 400);
  const assignments = keys.map((k) => `${k} = ?`).join(", ");
  await run(c.env.DB, `UPDATE benefit SET ${assignments} WHERE id = ?`, [...values, id]);
  return c.json({ success: true });
});

app.delete("/api/benefits/:id", async (c) => {
  const { id } = c.req.param();
  await run(c.env.DB, "DELETE FROM benefit WHERE id = ?", [id]);
  return c.json({ success: true });
});

export default app;
