import { validate } from './schema';

const apiBase = process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001';

export async function getJson<T>(path: string, schemaRef?: string): Promise<T> {
  const res = await fetch(`${apiBase}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (schemaRef) return validate<T>(schemaRef, data);
  return data as T;
}
