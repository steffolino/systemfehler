import express from "express";
import { queryAll } from "../db/utils.js";

export function metaEntitiesRouter(db) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
  const entities = ["Contact", "benefit", "AidOffer", "Tool"];
      const { entity, ...filters } = req.query;
      const result = [];

      for (const ent of entities) {
        const where = [];
        const params = [];

        for (const [key, val] of Object.entries(filters)) {
          if (val && val.startsWith("[") && val.endsWith("]")) {
            where.push(`EXISTS (SELECT 1 FROM json_each(${key}) WHERE value = ?)`); // JSON array filter
            params.push(val.slice(1, -1));
          } else if (val) {
            where.push(`${key} = ?`);
            params.push(val);
          }
        }

        const sql = `SELECT COUNT(*) as count FROM ${ent} ${
          where.length ? "WHERE " + where.join(" AND ") : ""
        }`;

        const rows = await queryAll(db, sql, params);
        const count = rows && rows.length > 0 ? Number(rows[0].count) || 0 : 0;

        result.push({ entity: ent, count });
      }

      res.json(result);
    } catch (err) {
      console.error("metaEntitiesRouter error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
