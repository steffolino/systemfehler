import express from "express";
import { queryAll, run } from "../db/utils.js";

export function entityRouter(entityName, db) {
  const router = express.Router();

  // GET /api/{entity}
  router.get("/", async (req, res) => {
    const { q, page = 1, limit = 20, ...filters } = req.query;
    let where = [];
    let params = [];
    let idx = 1;
    for (const [key, val] of Object.entries(filters)) {
      if (Array.isArray(val)) {
        where.push(`${key} IN (${val.map(() => "?").join(",")})`);
        params.push(...val);
      } else if (val && val.startsWith("[") && val.endsWith("]")) {
        // JSON array contains
        where.push(`EXISTS (SELECT 1 FROM json_each(${key}) WHERE value = ?)`);
        params.push(val.slice(1, -1));
      } else if (val) {
        where.push(`${key} = ?`);
        params.push(val);
      }
    }
    if (q) {
      where.push("(title LIKE ? OR name LIKE ? OR summary LIKE ?)");
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const sql = `SELECT * FROM ${entityName} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY updatedAt DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), (Number(page) - 1) * Number(limit));
    const rows = await queryAll(db, sql, params);
    res.json(rows);
  });

  // GET /api/{entity}/meta/fields
  router.get("/meta/fields", async (req, res) => {
    const rows = await queryAll(db, `PRAGMA table_info(${entityName})`);
    res.json(
      Array.isArray(rows)
        ? rows.map((r) => ({
            name: r.name,
            type: r.type,
            is_json_array: r.type === "TEXT" && r.name.match(/topic|tags/),
          }))
        : []
    );
  });

  // GET /api/{entity}/meta/facets
  router.get("/meta/facets", async (req, res) => {
    const fields = ["topic", "tags"];
    let facets = {};
    for (const field of fields) {
      const sql = `SELECT value, COUNT(*) as count FROM ${entityName}, json_each(${field}) GROUP BY value ORDER BY count DESC LIMIT 20`;
      try {
        const rows = await queryAll(db, sql);
        facets[field] = Array.isArray(rows) ? rows : [];
      } catch {}
    }
    res.json(facets);
  });

  // GET /api/{entity}/:id
  router.get("/:id", async (req, res) => {
    const rows = await queryAll(db, `SELECT * FROM ${entityName} WHERE id = ?`, [req.params.id]);
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.crawl_id) {
      const crawlRows = await queryAll(db, `SELECT * FROM CrawlResult WHERE id = ?`, [row.crawl_id]);
      row.crawl = Array.isArray(crawlRows) ? crawlRows[0] : undefined;
    }
    res.json(row);
  });

  // PUT update
  router.put("/:id", async (req, res) => {
    try {
      const body = req.body;
      const keys = Object.keys(body);
      const values = Object.values(body);

      if (keys.length === 0) {
        return res.status(400).json({ error: "No fields provided" });
      }

      const assignments = keys.map((k) => `${k} = ?`).join(", ");
      const sql = `UPDATE ${entityName} SET ${assignments} WHERE id = ?`;
      const result = await run(db, sql, [...values, req.params.id]);

      res.json({ success: true, result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  router.delete("/:id", async (req, res) => {
    try {
      const sql = `DELETE FROM ${entityName} WHERE id = ?`;
      const result = await run(db, sql, [req.params.id]);
      res.json({ success: true, result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}