import express from "express";
import { queryAll } from "../db/utils.js";

export function searchRouter(db) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const { q, entity, ...filters } = req.query;
      const allowedEntities = ["benefit", "contact", "organization", "service"];
      let results = [];
      for (const ent of (entity ? [entity] : allowedEntities)) {
        const columns = (await queryAll(db, `PRAGMA table_info(${ent})`, [])).map(c => c.name);
        let where = [];
        let params = [];
        const limit = parseInt(filters.limit) || 20;
        delete filters.limit;
        if (q) {
          const textCols = columns.filter(col => ["title", "name", "summary", "topic"].includes(col));
          if (textCols.length) {
            where.push(`(${textCols.map(col => `${col} LIKE ?`).join(" OR ")})`);
            params.push(...textCols.map(() => `%${q}%`));
          }
        }
        for (const [key, val] of Object.entries(filters)) {
          if (columns.includes(key) && val) {
            where.push(`${key} = ?`);
            params.push(val);
          }
        }
        const sql = `SELECT * FROM ${ent} ${where.length ? "WHERE " + where.join(" AND ") : ""} LIMIT ?`;
        params.push(limit);
        const rows = await queryAll(db, sql, params);
        if (Array.isArray(rows)) {
          rows.forEach((row) => {
            let topic = [];
            ["title", "name", "summary", "domain"].forEach(col => {
              if (row[col]) topic.push(...String(row[col]).split(/[,;\s]+/).filter(Boolean));
            });
            if (row.topic) topic.push(...String(row.topic).split(/[,;\s]+/).filter(Boolean));
            results.push({
              entity: ent,
              id: row.id,
              title: typeof row.title !== 'undefined' ? row.title : (typeof row.name !== 'undefined' ? row.name : undefined),
              summary: row.summary,
              name: row.name,
              source_url: row.source_url,
              domain: row.domain,
              updatedAt: row.updatedAt,
              kind: ent,
              topic: Array.from(new Set(topic.map(t => t.toLowerCase()))),
              ...row
            });
          });
        }
      }
      results.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || "") || a.entity.localeCompare(b.entity));
      res.json({ results, count: results.length });
    } catch (err) {
      res.json({ results: [], count: 0, error: err.message });
    }
  });

  return router;
}
