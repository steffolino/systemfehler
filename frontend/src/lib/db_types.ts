/* AUTO-GENERATED FROM backend/database/schema.sql - DO NOT EDIT BY HAND */

export interface DbMultilingualText {
  de?: string | null;
  en?: string | null;
  easy_de?: string | null;
  [key: string]: string | null | undefined;
}

export interface DbProvenance {
  source: string;
  crawlId?: string;
  crawlerVersion?: string;
  checksum?: string;
  crawledAt: string;
  method?: string;
  generator?: string;
  sourceTier?: string;
  institutionType?: string;
  jurisdiction?: string;
  publishedAt?: string;
  modifiedAt?: string;
  contentType?: string;
  [key: string]: string | undefined;
}

export interface DbTranslationRecord {
  title: string;
  summary?: string;
  body?: string;
  provenance: DbProvenance;
  method?: 'llm' | 'rule' | 'human' | 'mt';
  generator?: string;
  timestamp: string;
  reviewed?: boolean;
  variant?: 'einfach' | 'leicht';
  reviewStatus?: 'suggested' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

export type DbTranslationsMap = Record<string, DbTranslationRecord>;

export interface DbQualityScores {
  iqs?: number;
  ais?: number;
  computedAt?: string;
  [key: string]: number | string | undefined;
}

export type domain_type = 'benefits' | 'aid' | 'tools' | 'organizations' | 'contacts';

export type entry_status = 'active' | 'discontinued' | 'archived' | 'under_revision';

export type moderation_action = 'create' | 'update' | 'delete';

export type moderation_status = 'pending' | 'approved' | 'rejected';

export interface entries {
  id?: string;
  domain?: domain_type;
  title_de?: string;
  title_en?: string;
  title_easy_de?: string;
  summary_de?: string;
  summary_en?: string;
  summary_easy_de?: string;
  content_de?: string;
  content_en?: string;
  content_easy_de?: string;
  url?: string;
  topics?: string[];
  tags?: string[];
  target_groups?: string[];
  valid_from?: string;
  valid_until?: string;
  deadline?: string;
  status?: entry_status;
  first_seen?: string;
  last_seen?: string;
  source_unavailable?: boolean;
  provenance?: DbProvenance | null;
  translations?: DbTranslationsMap | null;
  quality_scores?: DbQualityScores | null;
  created_at?: string;
  updated_at?: string;
}

export interface benefits {
  entry_id?: string;
  benefit_amount_de?: string;
  benefit_amount_en?: string;
  benefit_amount_easy_de?: string;
  duration?: string;
  eligibility_criteria_de?: string;
  eligibility_criteria_en?: string;
  eligibility_criteria_easy_de?: string;
  application_steps?: unknown[];
  required_documents?: unknown[];
  form_link?: string;
  contact_info?: Record<string, unknown> | null;
}

export interface aid {
  entry_id?: string;
  aid_type?: string;
  provider?: string;
  amount_de?: string;
  amount_en?: string;
  amount_easy_de?: string;
  eligibility_de?: string;
  eligibility_en?: string;
  eligibility_easy_de?: string;
  application_process?: unknown[];
  required_documents?: unknown[];
  form_link?: string;
  contact_info?: Record<string, unknown> | null;
}

export interface tools {
  entry_id?: string;
  tool_type?: string;
  tool_url?: string;
  instructions_de?: string;
  instructions_en?: string;
  instructions_easy_de?: string;
  features?: unknown[];
  requirements?: string;
}

export interface organizations {
  entry_id?: string;
  organization_type?: string;
  description_de?: string;
  description_en?: string;
  description_easy_de?: string;
  services_offered?: unknown[];
  locations?: unknown[];
  contact_info?: Record<string, unknown> | null;
  operating_hours?: string;
  accessibility_info?: string;
}

export interface contacts {
  entry_id?: string;
  contact_type?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  description_de?: string;
  description_en?: string;
  description_easy_de?: string;
  available_hours?: string;
  languages_supported?: string[];
}

export interface moderationQueue {
  id?: string;
  entry_id?: string;
  domain?: domain_type;
  action?: moderation_action;
  status?: moderation_status;
  candidate_data?: Record<string, unknown> | null;
  existing_data?: Record<string, unknown> | null;
  diff?: Record<string, unknown> | null;
  provenance?: DbProvenance | null;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at?: string;
}

export interface auditLog {
  id?: string;
  timestamp?: string;
  action?: string;
  user_id?: string;
  entry_id?: string;
  details?: Record<string, unknown> | null;
}

