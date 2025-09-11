export type Item = {
  id: string;
  kind: string;
  title?: string;
  summary?: string;
  content?: string;
  topic?: string[];
  language?: string[];
  tags?: string[];
  updatedAt?: string;
};
