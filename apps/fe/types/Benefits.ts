// apps/fe/types/Benefit.ts
export type Benefit = {
  id: string;                // stable slug
  url: string;
  source: string;            // domain short name
  topic?: string | null;
  language: string[];        // ['de']
  title?: string | null;
  h1?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
  content?: string | null;
  status: 'ok' | 'not_found' | 'error';
  last_crawled_at: string;   // ISO
};
