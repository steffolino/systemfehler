-- deps
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- helper: extract domain from URL
CREATE OR REPLACE FUNCTION domain_from_url(u text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$
  SELECT NULLIF(LOWER(substring(u FROM '^(?:https?://)?([^/:?#]+)')), '');
$$;

-- popularity (optional, separate from Prisma models)
CREATE TABLE IF NOT EXISTS entry_popularity (
  kind text NOT NULL,
  id   text NOT NULL,
  popularity real NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, id)
);

-- pick ONE preferred related-link domain per row (official_info first)
-- Benefit domains
CREATE MATERIALIZED VIEW IF NOT EXISTS entries_mv AS
WITH benefit_domain AS (
  SELECT b.id,
         (SELECT domain_from_url(rl.url)
            FROM "RelatedLink" rl
           WHERE rl."benefitId" = b.id
             AND COALESCE(rl.status, '') <> 'ignored'
           ORDER BY (COALESCE(rl.relation,'') = 'official_info') DESC, rl.id
           LIMIT 1) AS domain
  FROM "Benefit" b
),
tool_domain AS (
  SELECT t.id,
         COALESCE(domain_from_url(t.url),
           (SELECT domain_from_url(rl.url)
              FROM "RelatedLink" rl
             WHERE rl."toolId" = t.id
               AND COALESCE(rl.status,'') <> 'ignored'
             ORDER BY (COALESCE(rl.relation,'') = 'official_info') DESC, rl.id
             LIMIT 1)) AS domain
  FROM "Tool" t
),
aid_domain AS (
  SELECT a.id,
         (SELECT domain_from_url(rl.url)
            FROM "RelatedLink" rl
           WHERE rl."aidOfferId" = a.id
             AND COALESCE(rl.status,'') <> 'ignored'
           ORDER BY (COALESCE(rl.relation,'') = 'official_info') DESC, rl.id
           LIMIT 1) AS domain
  FROM "AidOffer" a
)
SELECT
  'benefit'::text AS kind,
  b.id,
  b.topic      AS topic,
  b.language   AS language,
  b.title_de, b.title_en,
  b.summary_de, b.summary_en,
  bd.domain    AS source_domain,
  b."updatedAt"::timestamptz AS updated_at,
  -- FTS vectors inside the MV so we can index them
  to_tsvector('german',
    unaccent(COALESCE(b.title_de,'') || ' ' || COALESCE(b.summary_de,''))
  ) AS tsv_de,
  to_tsvector('english',
    unaccent(COALESCE(b.title_en,'') || ' ' || COALESCE(b.summary_en,''))
  ) AS tsv_en
FROM "Benefit" b
LEFT JOIN benefit_domain bd ON bd.id = b.id

UNION ALL

SELECT
  'tool'::text AS kind,
  t.id,
  t.topic, t.language,
  t.title_de, t.title_en,
  t.summary_de, t.summary_en,
  td.domain    AS source_domain,
  t."updatedAt"::timestamptz AS updated_at,
  to_tsvector('german',
    unaccent(COALESCE(t.title_de,'') || ' ' || COALESCE(t.summary_de,''))
  ) AS tsv_de,
  to_tsvector('english',
    unaccent(COALESCE(t.title_en,'') || ' ' || COALESCE(t.summary_en,''))
  ) AS tsv_en
FROM "Tool" t
LEFT JOIN tool_domain td ON td.id = t.id

UNION ALL

SELECT
  'aid'::text AS kind,
  a.id,
  a.topic, a.language,
  a.title_de, a.title_en,
  a.summary_de, a.summary_en,
  ad.domain    AS source_domain,
  a."updatedAt"::timestamptz AS updated_at,
  to_tsvector('german',
    unaccent(COALESCE(a.title_de,'') || ' ' || COALESCE(a.summary_de,''))
  ) AS tsv_de,
  to_tsvector('english',
    unaccent(COALESCE(a.title_en,'') || ' ' || COALESCE(a.summary_en,''))
  ) AS tsv_en
FROM "AidOffer" a
LEFT JOIN aid_domain ad ON ad.id = a.id;

-- Indexes on the MV
DO $$ BEGIN
  CREATE INDEX entries_mv_tsv_de_gin ON entries_mv USING GIN (tsv_de);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX entries_mv_tsv_en_gin ON entries_mv USING GIN (tsv_en);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX entries_mv_title_de_trgm ON entries_mv USING GIN (title_de gin_trgm_ops);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- Search view that joins popularity (read-only)
CREATE OR REPLACE VIEW entries_search AS
SELECT
  mv.*,
  COALESCE(p.popularity, 0) AS popularity
FROM entries_mv mv
LEFT JOIN entry_popularity p
  ON p.kind = mv.kind AND p.id = mv.id;
