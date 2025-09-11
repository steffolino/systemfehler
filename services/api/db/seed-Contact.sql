BEGIN TRANSACTION;
INSERT OR REPLACE INTO Contact (id,name,domain,source_url,last_seen,tags) VALUES ('https://www.awo.org/kontakt','Kontakt','www.awo.org','https://www.awo.org/kontakt',NULL,'[]');
INSERT OR REPLACE INTO Contact (id,name,domain,source_url,last_seen,tags) VALUES ('https://www.tafel.de/kontakt/','Das Team der Geschäftsstelle der Tafel Deutschland','www.tafel.de','https://www.tafel.de/kontakt/',NULL,'[]');
INSERT OR REPLACE INTO Contact (id,name,domain,source_url,last_seen,tags) VALUES ('https://www.malteser.de/kontakt.html','Kontakt','www.malteser.de','https://www.malteser.de/kontakt.html',NULL,'[]');
INSERT OR REPLACE INTO Contact (id,name,domain,source_url,last_seen,tags) VALUES ('https://www.samariterstiftung.de/kontakt/','Samariterstiftung: Kontakt','www.samariterstiftung.de','https://www.samariterstiftung.de/kontakt/',NULL,'[]');
INSERT OR REPLACE INTO Contact (id,name,domain,source_url,last_seen,tags) VALUES ('https://www.leipzig.de/kontakt','Kontakt - Stadt Leipzig','www.leipzig.de','https://www.leipzig.de/kontakt',NULL,'[]');
INSERT OR REPLACE INTO Contact (id,name,domain,source_url,last_seen,tags) VALUES ('https://www.volkssolidaritaet-leipzig.de/kontakt/','Kontakt','www.volkssolidaritaet-leipzig.de','https://www.volkssolidaritaet-leipzig.de/kontakt/',NULL,'[]');
INSERT OR REPLACE INTO Contact (id,name,domain,source_url,last_seen,tags) VALUES ('https://www.drk-leipzig.de/kontakt.html','Kontaktformular - Kreisverband Leipzig-Stadt e.V.','www.drk-leipzig.de','https://www.drk-leipzig.de/kontakt.html',NULL,'[]');
COMMIT;