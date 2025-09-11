BEGIN TRANSACTION;
INSERT OR REPLACE INTO Benefit (id,title,summary,topic,source_url,domain,last_seen,tags) VALUES ('wohngeld-leipzig','Wohngeld in Leipzig',NULL,'["housing"]',NULL,NULL,NULL,NULL);
COMMIT;