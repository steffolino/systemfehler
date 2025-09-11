export type Service = {
  id: string;
  organization_id: string;
  kind_id?: number;
  title?: string;
  summary?: string;
  language?: string[];
  topic?: string[];
  status?: string;
  updatedAt?: string;
};
