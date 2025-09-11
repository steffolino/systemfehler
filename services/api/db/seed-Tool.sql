BEGIN TRANSACTION;
INSERT OR REPLACE INTO Tool (id,title,summary,topic,source_url,domain,last_seen,tags) VALUES ('heizkosten-check','Heizkosten-Check',NULL,'["energy"]',NULL,NULL,NULL,NULL);
COMMIT;