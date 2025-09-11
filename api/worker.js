import { Hono } from "hono";
import { cors } from "hono/cors";

// Hilfsfunktionen für D1
async function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  const result = await stmt.all(...params);
  return Array.isArray(result?.results) ? result.results : [];
}

async function run(db, sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

// Topics-Normalisierung
function normalizeTopics(value) {
  if (!value) return [];
  const v = String(value).trim();
  try {
    if (v.startsWith("[")) {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return arr.map((x) => String(x).trim()).filter(Boolean);
    }
  } catch {}
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

// Topics-Endpoint
async function listTopicsD1(db, limit = 12) {
  const res = await db.batch([
    db.prepare("SELECT topic FROM Benefit WHERE topic IS NOT NULL"),
    db.prepare("SELECT topic FROM Tool WHERE topic IS NOT NULL"),
    db.prepare("SELECT topic FROM AidOffer WHERE topic IS NOT NULL"),
  ]);

  const rows = [
    ...(res?.[0]?.results ?? []),
    ...(res?.[1]?.results ?? []),
    ...(res?.[2]?.results ?? []),
  ];

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

// Worker-App
const app = new Hono();
app.use("/*", cors());

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// Topics
app.get("/api/search/topics", async (c) => {
  const url = new URL(c.req.url);
  const limit = Number(url.searchParams.get("limit") ?? "12");
  const data = await listTopicsD1(c.env.DB, limit);
  return c.json(data);
});

// Benefits CRUD
app.get("/api/benefits", async (c) => {
  const rows = await queryAll(c.env.DB, "SELECT * FROM Benefit");
  return c.json(rows);
});

app.get("/api/benefits/:id", async (c) => {
  const { id } = c.req.param();
  const rows = await queryAll(c.env.DB, "SELECT * FROM Benefit WHERE id = ?", [id]);
  if (!rows.length) return c.json({ error: "Not found" }, 404);
  return c.json(rows[0]);
});

app.post("/api/benefits", async (c) => {
  const body = await c.req.json();
  const keys = Object.keys(body);
  const values = Object.values(body);
  if (!keys.length) return c.json({ error: "No data" }, 400);
  const placeholders = keys.map(() => "?").join(", ");
  await run(c.env.DB, `INSERT INTO Benefit (${keys.join(", ")}) VALUES (${placeholders})`, values);
  return c.json({ success: true });
});

app.put("/api/benefits/:id", async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const keys = Object.keys(body);
  const values = Object.values(body);
  if (!keys.length) return c.json({ error: "No fields provided" }, 400);
  const assignments = keys.map((k) => `${k} = ?`).join(", ");
  await run(c.env.DB, `UPDATE Benefit SET ${assignments} WHERE id = ?`, [...values, id]);
  return c.json({ success: true });
});

app.delete("/api/benefits/:id", async (c) => {
  const { id } = c.req.param();
  await run(c.env.DB, "DELETE FROM Benefit WHERE id = ?", [id]);
  return c.json({ success: true });
});

export default app;
