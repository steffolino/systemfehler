// services/api/index.js

import path from "path";
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import express from "express";
import cors from "cors";
import { entityRouter } from "./routes/entityRouter.js";
import { searchRouter } from "./routes/search.js";
import { metaEntitiesRouter } from "./routes/metaEntities.js";

const app = express();
app.use(cors());
app.use(express.json());


(async () => {
  // Use require for sqlite3 to ensure the driver is defined
  let sqlite3;
  try {
    sqlite3 = (await import('sqlite3')).default;
  } catch (e) {
    sqlite3 = require('sqlite3');
  }
  const { open } = await import('sqlite');
  const db = await open({
    filename: path.resolve(__dirname, '../../.generated/local.sqlite'),
    driver: sqlite3.Database,
  });

  app.use("/api/organizations", entityRouter("organization", db));
  app.use("/api/benefits", entityRouter("benefit", db));
  app.use("/api/contacts", entityRouter("contact", db));
  app.use("/api/services", entityRouter("service", db));
  app.use("/api/items", entityRouter("knowledge_item", db));
  app.use("/api/search", searchRouter(db));
  app.use("/api/meta/entities", metaEntitiesRouter(db));
  // Lookup tables
  app.use("/api/org-kind", entityRouter("org_kind", db));
  app.use("/api/service-kind", entityRouter("service_kind", db));
  app.use("/api/item-kind", entityRouter("item_kind", db));
  app.use("/api/topic", entityRouter("topic", db));
  app.use("/api/language", entityRouter("language", db));
  app.use("/api/target-group", entityRouter("target_group", db));
  // Junctions
  app.use("/api/organization-topic", entityRouter("organization_topic", db));
  app.use("/api/organization-language", entityRouter("organization_language", db));
  app.use("/api/organization-target-group", entityRouter("organization_target_group", db));
  app.use("/api/service-topic", entityRouter("service_topic", db));
  app.use("/api/service-language", entityRouter("service_language", db));
  app.use("/api/service-target-group", entityRouter("service_target_group", db));
  app.use("/api/item-topic", entityRouter("item_topic", db));
  app.use("/api/item-language", entityRouter("item_language", db));
  app.use("/api/item-target-group", entityRouter("item_target_group", db));
  app.use("/api/popularity", entityRouter("popularity", db));
  app.use("/api/related-link", entityRouter("related_link", db));

  // Add this route before app.listen
  app.get("/api/search/topics", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      // Get all topics with counts per entity type using junction tables
      const sql = `SELECT t.code, t.label,
        (SELECT COUNT(*) FROM benefit WHERE benefit.topic LIKE '%' || t.code || '%') as benefit_count,
  (SELECT COUNT(*) FROM service_topic WHERE service_topic.topic_id = t.rowid) as service_count,
  (SELECT COUNT(*) FROM organization_topic WHERE organization_topic.topic_id = t.rowid) as organization_count,
        (SELECT COUNT(*) FROM contact WHERE contact.tags LIKE '%' || t.code || '%') as contact_count
        FROM topic t ORDER BY t.label ASC LIMIT ?`;
      const rows = await db.all(sql, [limit]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch topics", details: err.message });
    }
  });

  app.listen(3001, () => {
    console.log("API listening on http://localhost:3001");
  });
})();
