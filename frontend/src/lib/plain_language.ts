import type { Entry, TranslationsMap, TranslationRecord } from './api';

export type LanguageMode = 'standard' | 'einfach' | 'leicht';
export type AuditSeverity = 'info' | 'warning';
export type PlainLanguageAudit = {
  mode: Exclude<LanguageMode, 'standard'>;
  score: number;
  findings: Array<{
    severity: AuditSeverity;
    message: string;
  }>;
};

const GENERATOR_NAME = 'systemfehler-plain-language-v1';
const EINFACH_KEY = 'de-EINFACH-SUGGESTED';
const LEICHT_KEY = 'de-LEICHT-SUGGESTED';

const GLOSSARY: Array<{ term: RegExp; replacement: string; explain?: string }> = [
  { term: /\bbedarfsgemeinschaft\b/gi, replacement: 'Familie oder Menschen, die zusammen leben', explain: 'Das sind Menschen, die zusammen leben und gemeinsam Geld zum Leben brauchen.' },
  { term: /\bhilfebed(ü|u)rftig\b/gi, replacement: 'auf Hilfe angewiesen', explain: 'Das bedeutet: Das Geld reicht nicht zum Leben.' },
  { term: /\berwerbsf(ä|a)hig\b/gi, replacement: 'arbeitsfähig', explain: 'Das bedeutet: Sie können arbeiten.' },
  { term: /\bexistenzminimum\b/gi, replacement: 'das Geld, das man mindestens zum Leben braucht' },
  { term: /\blebensmittelpunkt\b/gi, replacement: 'der Ort, an dem Sie vor allem leben' },
  { term: /\blebensunterhalt\b/gi, replacement: 'das tägliche Leben' },
  { term: /\bjobcenter\b/gi, replacement: 'Jobcenter', explain: 'Das Jobcenter ist die Stelle für Bürgergeld.' },
  { term: /\bb(ü|u)rgergeld\b/gi, replacement: 'Bürger-Geld', explain: 'Das ist Geld für Menschen mit wenig oder keinem Einkommen.' },
  { term: /\barbeitslosengeld\b/gi, replacement: 'Arbeitslosen-Geld', explain: 'Das ist Geld für Menschen ohne Arbeit.' },
  { term: /\bkinderzuschlag\b/gi, replacement: 'Kinder-Zuschlag', explain: 'Das ist extra Geld für Familien mit wenig Einkommen.' },
  { term: /\bunterhaltsvorschuss\b/gi, replacement: 'Unterhalts-Vorschuss', explain: 'Das ist Geld für Kinder, wenn Unterhalt fehlt.' },
];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
}

function getPrimaryText(entry: Entry) {
  const summary = typeof entry.summary?.de === 'string' ? entry.summary.de : entry.summary_de || '';
  const content = typeof entry.content?.de === 'string' ? entry.content.de : entry.content_de || '';
  return normalizeWhitespace(summary || content || '');
}

function getPrimaryTitle(entry: Entry) {
  if (typeof entry.title === 'string' && entry.title.trim()) return entry.title.trim();
  if (typeof entry.title_de === 'string' && entry.title_de.trim()) return entry.title_de.trim();
  return '';
}

function splitSentences(text: string) {
  return normalizeWhitespace(text)
    .replace(/([:;])\s+/g, '$1|')
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
}

function simplifySentence(sentence: string, mode: Exclude<LanguageMode, 'standard'>) {
  let result = sentence;

  for (const rule of GLOSSARY) {
    result = result.replace(rule.term, rule.replacement);
  }

  result = result
    .replace(/\bSie oder Mitglieder Ihrer Familie\b/gi, 'Sie oder Ihre Familie')
    .replace(/\bSie oder Mitglieder Ihrer Bedarfsgemeinschaft\b/gi, 'Sie oder Ihre Familie')
    .replace(/\bkeine Krankheit oder Behinderung hindert Sie daran\b/gi, 'keine Krankheit oder Behinderung hält Sie davon ab')
    .replace(/\bVoraussetzungen\b/gi, 'Bedingungen')
    .replace(/\bbeantragen\b/gi, 'anfragen oder beantragen');

  if (mode === 'leicht') {
    result = result
      .replace(/\bund\b/gi, '.')
      .replace(/,\s*/g, '. ')
      .replace(/\s{2,}/g, ' ');
  }

  return normalizeWhitespace(result);
}

function buildDefinitionLines(text: string, mode: Exclude<LanguageMode, 'standard'>) {
  const lines: string[] = [];

  for (const rule of GLOSSARY) {
    if (!rule.explain || !rule.term.test(text)) continue;
    const termLabel = rule.replacement;
    if (mode === 'leicht') {
      lines.push(`${termLabel} bedeutet:`);
      lines.push(rule.explain);
    } else {
      lines.push(`${termLabel} bedeutet: ${rule.explain}`);
    }
  }

  return Array.from(new Set(lines));
}

function shortenLines(lines: string[], maxLines: number) {
  return lines
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, maxLines);
}

function buildEinfachFromText(title: string, text: string) {
  const sentences = splitSentences(text).slice(0, 6).map((sentence) => simplifySentence(sentence, 'einfach'));
  const definitions = buildDefinitionLines(text, 'einfach').slice(0, 3);
  const lines = [title ? `${title}` : '', ...sentences, ...definitions];
  return shortenLines(lines, 8).join('\n\n');
}

function buildLeichtFromText(title: string, text: string) {
  const rawSentences = splitSentences(text).slice(0, 5);
  const simpleLines: string[] = [];

  for (const sentence of rawSentences) {
    const simplified = simplifySentence(sentence, 'leicht')
      .split('.')
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean);
    simpleLines.push(...simplified);
  }

  const definitions = buildDefinitionLines(text, 'leicht').slice(0, 6);
  const lines = [title ? `${title}` : '', ...simpleLines, ...definitions];
  return shortenLines(lines, 14).join('\n');
}

function buildEinfachText(entry: Entry) {
  const title = getPrimaryTitle(entry);
  const text = getPrimaryText(entry);
  return buildEinfachFromText(title, text);
}

function buildLeichtText(entry: Entry) {
  const title = getPrimaryTitle(entry);
  const text = getPrimaryText(entry);
  return buildLeichtFromText(title, text);
}

function makeTranslationRecord(entry: Entry, title: string, body: string, mode: 'einfach' | 'leicht'): TranslationRecord {
  const now = new Date().toISOString();
  const summary = body.split('\n').slice(0, mode === 'leicht' ? 4 : 2).join(' ').trim();
  return {
    title,
    summary,
    body,
    provenance: {
      source: entry.provenance?.source || entry.url,
      crawledAt: entry.provenance?.crawledAt || now,
      method: 'rule',
      generator: GENERATOR_NAME,
    },
    method: 'rule',
    generator: GENERATOR_NAME,
    timestamp: now,
    reviewed: false,
  };
}

export function buildSuggestedPlainLanguageTranslations(entry: Entry): TranslationsMap {
  const translations: TranslationsMap = { ...(entry.translations || {}) };
  const title = getPrimaryTitle(entry) || 'Eintrag';

  if (!translations[EINFACH_KEY]?.body) {
    translations[EINFACH_KEY] = makeTranslationRecord(entry, title, buildEinfachText(entry), 'einfach');
  }

  if (!translations[LEICHT_KEY]?.body) {
    translations[LEICHT_KEY] = makeTranslationRecord(entry, title, buildLeichtText(entry), 'leicht');
  }

  return translations;
}

export function getModeLabel(mode: LanguageMode) {
  switch (mode) {
    case 'einfach':
      return 'Einfach';
    case 'leicht':
      return 'Leicht';
    default:
      return 'Standard';
  }
}

export function getReadableEntryText(entry: Entry, mode: LanguageMode) {
  const translations = buildSuggestedPlainLanguageTranslations(entry);
  if (mode === 'leicht') {
    const reviewed = translations['de-LEICHT']?.body;
    return reviewed || translations[LEICHT_KEY]?.body || '';
  }
  if (mode === 'einfach') {
    return translations[EINFACH_KEY]?.body || '';
  }
  return getPrimaryText(entry);
}

export function getReadableEntrySummary(entry: Entry, mode: LanguageMode) {
  const translations = buildSuggestedPlainLanguageTranslations(entry);
  if (mode === 'leicht') {
    return translations['de-LEICHT']?.summary || translations[LEICHT_KEY]?.summary || '';
  }
  if (mode === 'einfach') {
    return translations[EINFACH_KEY]?.summary || '';
  }
  return typeof entry.summary?.de === 'string' ? entry.summary.de : entry.summary_de || '';
}

export function getReadableEntryTranslations(entry: Entry) {
  return buildSuggestedPlainLanguageTranslations(entry);
}

export function getReadableAnswerText(text: string, mode: LanguageMode, title = '') {
  const normalized = normalizeWhitespace(text);
  if (!normalized || mode === 'standard') return normalized;
  if (mode === 'einfach') {
    return buildEinfachFromText(title, normalized);
  }
  return buildLeichtFromText(title, normalized);
}

function sentenceCount(text: string) {
  return splitSentences(text).length;
}

function averageSentenceLength(text: string) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return 0;
  const words = sentences.reduce((count, sentence) => count + sentence.split(/\s+/).filter(Boolean).length, 0);
  return words / sentences.length;
}

function unexplainedJargon(text: string) {
  return GLOSSARY.filter((rule) => rule.explain && rule.term.test(text)).filter((rule) => {
    const label = rule.replacement;
    return !text.includes(`${label} bedeutet`) && !text.includes(rule.explain || '');
  });
}

export function auditPlainLanguage(text: string, mode: Exclude<LanguageMode, 'standard'>): PlainLanguageAudit {
  const normalized = normalizeWhitespace(text);
  const findings: PlainLanguageAudit['findings'] = [];
  let score = 100;
  const avgLength = averageSentenceLength(normalized);
  const sentences = sentenceCount(normalized);

  if (!normalized) {
    return {
      mode,
      score: 0,
      findings: [{ severity: 'warning', message: 'Kein Text vorhanden.' }],
    };
  }

  if (mode === 'einfach') {
    if (avgLength > 16) {
      score -= 18;
      findings.push({ severity: 'warning', message: 'Die Sätze sind noch recht lang für Einfache Sprache.' });
    }
    if (sentences > 8) {
      score -= 8;
      findings.push({ severity: 'info', message: 'Der Text ist recht lang. Eine kürzere Kurzfassung wäre leichter.' });
    }
    if (/[;:]/.test(normalized)) {
      score -= 6;
      findings.push({ severity: 'info', message: 'Weniger Doppelpunkt- und Semikolon-Konstruktionen wären einfacher.' });
    }
  }

  if (mode === 'leicht') {
    if (avgLength > 10) {
      score -= 24;
      findings.push({ severity: 'warning', message: 'Die Sätze sind für Leichte Sprache noch zu lang.' });
    }
    if (normalized.includes(', ')) {
      score -= 10;
      findings.push({ severity: 'warning', message: 'Kommas deuten oft auf mehrere Gedanken in einem Satz hin.' });
    }
    if (!normalized.includes('bedeutet')) {
      score -= 10;
      findings.push({ severity: 'info', message: 'Wichtige schwierige Wörter sollten erklärt werden.' });
    }
  }

  const jargon = unexplainedJargon(normalized);
  if (jargon.length > 0) {
    score -= Math.min(20, jargon.length * 5);
    findings.push({
      severity: 'warning',
      message: `Einige schwierige Begriffe sind noch nicht erklärt: ${jargon.map((item) => item.replacement).join(', ')}.`,
    });
  }

  if (findings.length === 0) {
    findings.push({ severity: 'info', message: 'Der Text wirkt für diese Sprachstufe bereits gut nutzbar.' });
  }

  return {
    mode,
    score: Math.max(0, Math.min(100, score)),
    findings,
  };
}
