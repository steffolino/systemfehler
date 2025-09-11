-- Lookup/Enum seeds
INSERT INTO org_kind (id, name) VALUES (1, 'Verein'), (2, 'Stiftung'), (3, 'Behörde');
INSERT INTO service_kind (id, name) VALUES (1, 'Beratung'), (2, 'Unterstützung');
INSERT INTO item_kind (id, name) VALUES (1, 'Dokument'), (2, 'Artikel');
INSERT INTO topic (id, name) VALUES (1, 'Wohnen'), (2, 'Soziales'), (3, 'Gesundheit');
INSERT INTO language (id, code, name) VALUES (1, 'de', 'Deutsch'), (2, 'en', 'Englisch');
INSERT INTO target_group (id, name) VALUES (1, 'Familien'), (2, 'Senioren');
INSERT INTO popularity (id, score) VALUES (1, 100), (2, 50);
