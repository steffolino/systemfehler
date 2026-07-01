import type { GlossaryTerm, GlossaryTermId } from '@/data/glossary';

export type { GlossaryLocale, GlossaryTerm, GlossaryTermId } from '@/data/glossary';

export async function loadGlossaryTerm(termId: GlossaryTermId): Promise<GlossaryTerm | null> {
  const { glossaryTerms } = await import('@/data/glossary');
  return glossaryTerms[termId] || null;
}

export async function loadGlossaryTerms(): Promise<GlossaryTerm[]> {
  const { glossaryTerms } = await import('@/data/glossary');
  return Object.values(glossaryTerms);
}
