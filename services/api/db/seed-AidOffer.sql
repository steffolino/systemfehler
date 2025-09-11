BEGIN TRANSACTION;
INSERT OR REPLACE INTO AidOffer (id,title,summary,topic,source_url,domain,last_seen,tags) VALUES ('wohnungslos-hilfe-leipzig','Hilfe für Wohnungslose',NULL,'["emergency","housing"]',NULL,NULL,NULL,NULL);
COMMIT;