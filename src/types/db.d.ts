// Auto-generated from migrations/*.sql

export interface org_kind {
  id: number;
  name: string;
}

export interface service_kind {
  id: number;
  name: string;
}

export interface item_kind {
  id: number;
  name: string;
}

export interface topic {
  id: number;
  name: string;
}

export interface language {
  id: number;
  code: string;
  name: string;
}

export interface target_group {
  id: number;
  name: string;
}

export interface organization {
  id: string;
  name: string;
  kind_id: number;
  popularity_id: number;
  createdAt: string;
  updatedAt: string;
}

export interface contact {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  opening_hours: string;
  source_url: string;
  domain: string;
  last_seen: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
}

export interface service {
  id: string;
  organization_id: string;
  kind_id: number;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface knowledge_item {
  id: string;
  organization_id: string;
  kind_id: number;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface organization_topic {
  organization_id: string;
  topic_id: number;
  PRIMARY: any;
  topic_id): any;
}

export interface organization_language {
  organization_id: string;
  language_id: number;
  PRIMARY: any;
  language_id): any;
}

export interface organization_target_group {
  organization_id: string;
  target_group_id: number;
  PRIMARY: any;
  target_group_id): any;
}

export interface service_topic {
  service_id: string;
  topic_id: number;
  PRIMARY: any;
  topic_id): any;
}

export interface service_language {
  service_id: string;
  language_id: number;
  PRIMARY: any;
  language_id): any;
}

export interface service_target_group {
  service_id: string;
  target_group_id: number;
  PRIMARY: any;
  target_group_id): any;
}

export interface item_topic {
  item_id: string;
  topic_id: number;
  PRIMARY: any;
  topic_id): any;
}

export interface item_language {
  item_id: string;
  language_id: number;
  PRIMARY: any;
  language_id): any;
}

export interface item_target_group {
  item_id: string;
  target_group_id: number;
  PRIMARY: any;
  target_group_id): any;
}

export interface popularity {
  id: number;
  score: number;
}

export interface related_link {
  id: number;
  entity_id: string;
  url: string;
  description: string;
}

export interface translation_variant {
  code: string;
  --: any;
  'simple': any;
  'leicht': any;
  'summary': any;
  --: any;
}

export interface llm_model {
  code: string;
  --: any;
  --: any;
  'azure': any;
  'anthropic': any;
  ...: any;
  --: any;
  --: number;
  --: any;
}

export interface prompt_template {
  id: string;
  purpose: string;
  --: any;
  'simple': any;
  'leicht': any;
  'summary': any;
  --: string;
  --: any;
  Guidelines: any;
  ...): any;
  updatedAt: string;
}

export interface llm_generation {
  id: string;
  entity_id: string;
  field_name: string;
  --: any;
  --: any;
  'en': any;
  ...: any;
  --: any;
  'en': any;
  ...: any;
  source_hash: string;
  --: any;
  z.B.: any;
  model_code: string;
  prompt_id: string;
  tokens_in: number;
  tokens_out: number;
  cost_cents: number;
  quality_score: number;
  --: any;
  updatedAt: string;
  UNIQUE: any;
  field_name: any;
  target_language: any;
  variant_code: any;
  source_hash): any;
}

export interface DB {
  org_kind: org_kind;
  service_kind: service_kind;
  item_kind: item_kind;
  topic: topic;
  language: language;
  target_group: target_group;
  organization: organization;
  contact: contact;
  service: service;
  knowledge_item: knowledge_item;
  organization_topic: organization_topic;
  organization_language: organization_language;
  organization_target_group: organization_target_group;
  service_topic: service_topic;
  service_language: service_language;
  service_target_group: service_target_group;
  item_topic: item_topic;
  item_language: item_language;
  item_target_group: item_target_group;
  popularity: popularity;
  related_link: related_link;
  translation_variant: translation_variant;
  llm_model: llm_model;
  prompt_template: prompt_template;
  llm_generation: llm_generation;
}
