import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type Locale = 'de' | 'en';

const messages = {
  de: {
    'app.search_validate': 'Suche und pruefe Eintraege',
    'app.admin_workspace': 'Admin-Arbeitsbereich',
    'app.source_transparency': 'Quellentransparenz',
    'app.viewing_entry': 'Eintragsdetails',
    'nav.sources': 'Quellen',
    'nav.admin': 'Admin',
    'nav.search': 'Suche',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'auth.admin_access': 'Admin-Zugang',
    'auth.authenticated': 'Angemeldet',
    'search.title': 'Suche',
    'search.subtitle': 'Durchsuche die Datenbank und pruefe regulare oder KI-gestuetzte Ergebnisse.',
    'search.source_link': 'Quellenverzeichnis',
    'search.mode': 'Suchmodus',
    'search.mode_ai': 'KI-Suche',
    'search.mode_article': 'Artikel-Suche',
    'search.mode_ai_desc': 'KI-Modus nutzt absichtliche Fragen, Retrieval und schnelle strukturierte Antworten.',
    'search.mode_article_desc': 'Artikel-Suche ist fuer schnelles Browsen, Listen und klassische Treffer optimiert.',
    'search.ai_helper': 'Autocomplete ist hier deaktiviert, damit das Modell nur auf deine eingereichte Frage reagiert.',
    'search.article_helper': 'Treffer aktualisieren waehrend des Tippens und bevorzugen klassische Eintrags-Treffer.',
    'search.ask_ai': 'KI fragen',
    'search.working': 'Arbeite...',
    'search.ai_placeholder': 'Stelle eine vollstaendige Frage...',
    'search.article_placeholder': 'Eintraege durchsuchen...',
    'search.showing_ai': 'KI-Belege fuer "{query}"',
    'search.showing_article': 'Treffer fuer "{query}"',
    'search.show_all': 'Alle verfuegbaren Eintraege',
    'search.prompt_ai': 'Stelle eine Frage und sende sie fuer die KI-Suche ab',
    'search.evidence_entries': 'Beleg-Eintraege',
    'search.enter_query': 'Frage eingeben, um die KI zu nutzen',
    'search.no_evidence': 'Keine starken Belege gefunden',
    'search.suggested_questions': 'Vorgeschlagene Fragen',
    'search.ai_status': 'KI-Status',
    'search.ai_rewrite': 'KI-Umschreibung',
    'search.ai_synthesis': 'KI-Antwort',
    'entry.back': 'Zur Suche',
    'entry.original_source': 'Originalquelle',
    'entry.detail_view': 'Detailansicht des Eintrags.',
    'entry.source_quality': 'Quelle und Datenqualitaet',
    'entry.transparency_note': 'Transparenzhinweis: Diese Angaben stammen aus Provenienz und Qualitaetswerten des Eintrags.',
    'sources.title': 'Quellen',
    'sources.subtitle': 'Transparente Uebersicht der Organisationen und Institutionen hinter den aktuellen Eintraegen.',
    'sources.filter': 'Quellen filtern...',
    'sources.open': 'Quelle oeffnen',
  },
  en: {
    'app.search_validate': 'Search and validate entries',
    'app.admin_workspace': 'Admin workspace',
    'app.source_transparency': 'Source transparency',
    'app.viewing_entry': 'Viewing entry details',
    'nav.sources': 'Sources',
    'nav.admin': 'Admin',
    'nav.search': 'Search',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'auth.admin_access': 'Admin access',
    'auth.authenticated': 'Authenticated',
    'search.title': 'Search',
    'search.subtitle': 'Search the database and inspect article-based or AI-generated results.',
    'search.source_link': 'source directory',
    'search.mode': 'Search mode',
    'search.mode_ai': 'AI Search',
    'search.mode_article': 'Article Search',
    'search.mode_ai_desc': 'AI mode uses deliberate questions, retrieval, and fast structured answers.',
    'search.mode_article_desc': 'Article search is optimized for fast browsing, lists, and classic entry matching.',
    'search.ai_helper': 'Autocomplete is disabled here so the model only runs on your submitted question.',
    'search.article_helper': 'Results update while you type and favor classic entry matches.',
    'search.ask_ai': 'Ask AI',
    'search.working': 'Working...',
    'search.ai_placeholder': 'Ask a full question...',
    'search.article_placeholder': 'Search entries...',
    'search.showing_ai': 'Showing AI evidence for "{query}"',
    'search.showing_article': 'Showing matches for "{query}"',
    'search.show_all': 'Showing all available entries',
    'search.prompt_ai': 'Enter a full question and submit it to AI search',
    'search.evidence_entries': 'Evidence entries',
    'search.enter_query': 'Enter a query to use AI search',
    'search.no_evidence': 'No strong evidence found',
    'search.suggested_questions': 'Suggested questions',
    'search.ai_status': 'AI Status',
    'search.ai_rewrite': 'AI Rewrite',
    'search.ai_synthesis': 'AI Synthesis',
    'entry.back': 'Back to search',
    'entry.original_source': 'Original source',
    'entry.detail_view': 'Detailed entry view.',
    'entry.source_quality': 'Source and data quality',
    'entry.transparency_note': 'Transparency note: these signals come from recorded provenance and computed entry quality scores.',
    'sources.title': 'Sources',
    'sources.subtitle': 'Transparent overview of the organizations and institutions behind the current entries.',
    'sources.filter': 'Filter sources...',
    'sources.open': 'Open source',
  },
} as const;

type MessageKey = keyof typeof messages.de;

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
} | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'de';
    const stored = window.localStorage.getItem('systemfehler.locale');
    return stored === 'en' ? 'en' : 'de';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('systemfehler.locale', locale);
    }
  }, [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: MessageKey, vars?: Record<string, string | number>) => {
        let template: string = messages[locale][key] || messages.de[key] || key;
        Object.entries(vars || {}).forEach(([name, value]) => {
          template = template.replace(`{${name}}`, String(value));
        });
        return template;
      },
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return value;
}
