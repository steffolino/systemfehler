-- Example entity seeds
INSERT INTO organization (id, name, kind_id, popularity_id) VALUES ('org1', 'AWO Leipzig', 1, 1);
INSERT INTO contact (id, organization_id, name, email, phone, address, opening_hours, source_url, domain, last_seen, tags) VALUES ('contact1', 'org1', 'AWO Kontakt', 'info@awo.org', '0341-123456', 'Leipzig', 'Mo-Fr 9-17', 'https://awo-leipzig.de', 'awo-leipzig.de', '2025-09-02', '[]');
INSERT INTO service (id, organization_id, kind_id, title, summary) VALUES ('service1', 'org1', 1, 'Sozialberatung', 'Beratung zu sozialen Fragen');
INSERT INTO knowledge_item (id, organization_id, kind_id, title, summary) VALUES ('item1', 'org1', 1, 'Merkblatt Wohngeld', 'Informationen zum Wohngeld');
INSERT INTO organization_topic (organization_id, topic_id) VALUES ('org1', 1);
INSERT INTO organization_language (organization_id, language_id) VALUES ('org1', 1);
INSERT INTO organization_target_group (organization_id, target_group_id) VALUES ('org1', 1);
INSERT INTO service_topic (service_id, topic_id) VALUES ('service1', 2);
INSERT INTO service_language (service_id, language_id) VALUES ('service1', 1);
INSERT INTO service_target_group (service_id, target_group_id) VALUES ('service1', 2);
INSERT INTO item_topic (item_id, topic_id) VALUES ('item1', 3);
INSERT INTO item_language (item_id, language_id) VALUES ('item1', 2);
INSERT INTO item_target_group (item_id, target_group_id) VALUES ('item1', 1);
INSERT INTO related_link (entity_id, url, description) VALUES ('org1', 'https://awo-leipzig.de/info', 'Weitere Infos');
