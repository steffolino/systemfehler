export type Lang = 'de' | 'de_simple' | 'en';

export function resolveLang(input?: Lang): Lang {
  if (input === 'de' || input === 'de_simple' || input === 'en') return input;
  return 'de';
}

export function pickText(entity: any, lang: Lang): string | undefined {
  // Try requested lang, then fallback chain
  const langs: Lang[] = [lang, 'de', 'de_simple', 'en'];
  for (const l of langs) {
    if (entity?.title?.[l]) return entity.title[l];
    if (entity?.summary?.[l]) return entity.summary[l];
  }
  // fallback to any available
  return entity?.title || entity?.summary;
}
