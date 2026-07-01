import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Info, Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { loadGlossaryTerm, loadGlossaryTerms, type GlossaryTerm, type GlossaryTermId } from '@/lib/glossary';
import { cn } from '@/lib/utils';

type GlossaryContextValue = {
  openTerm: (termId: GlossaryTermId) => void;
};

const GlossaryContext = createContext<GlossaryContextValue | null>(null);

export function GlossaryProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [activeTermId, setActiveTermId] = useState<GlossaryTermId | null>(null);
  const [term, setTerm] = useState<GlossaryTerm | null>(null);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsLoading, setTermsLoading] = useState(false);
  const glossaryLocale = locale === 'en' ? 'en' : 'de';
  const isOpen = Boolean(activeTermId);

  const openTerm = useCallback((termId: GlossaryTermId) => {
    setActiveTermId(termId);
  }, []);

  const closeTerm = useCallback(() => {
    setActiveTermId(null);
  }, []);

  useEffect(() => {
    if (!activeTermId) {
      setTerm(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadGlossaryTerm(activeTermId)
      .then((nextTerm) => {
        if (!cancelled) setTerm(nextTerm);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTermId]);

  useEffect(() => {
    if (!isOpen || terms.length > 0) return;

    let cancelled = false;
    setTermsLoading(true);

    loadGlossaryTerms()
      .then((nextTerms) => {
        if (!cancelled) {
          setTerms(nextTerms);
        }
      })
      .finally(() => {
        if (!cancelled) setTermsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, terms.length]);

  const value = useMemo(() => ({ openTerm }), [openTerm]);
  const searchText = searchQuery.trim().toLocaleLowerCase(glossaryLocale);
  const searchResults = useMemo(() => {
    if (!searchText) return [];

    return [...terms]
      .filter((item) =>
        [item.title[glossaryLocale], item.short[glossaryLocale], item.body[glossaryLocale]]
          .join(' ')
          .toLocaleLowerCase(glossaryLocale)
          .includes(searchText)
      )
      .sort((a, b) => a.title[glossaryLocale].localeCompare(b.title[glossaryLocale], glossaryLocale))
      .slice(0, 6);
  }, [glossaryLocale, searchText, terms]);

  return (
    <GlossaryContext.Provider value={value}>
      {children}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-foreground/20 transition-opacity',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        aria-hidden="true"
        onClick={closeTerm}
      />
      <aside
        aria-label={glossaryLocale === 'de' ? 'Glossar' : 'Glossary'}
        aria-hidden={!isOpen}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col border-l bg-background shadow-2xl transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b p-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {glossaryLocale === 'de' ? 'Glossar' : 'Glossary'}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {glossaryLocale === 'de' ? 'Begriff kurz erklärt' : 'Term explained briefly'}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={closeTerm} aria-label={glossaryLocale === 'de' ? 'Glossar schließen' : 'Close glossary'}>
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {glossaryLocale === 'de' ? 'Glossar durchsuchen' : 'Search glossary'}
              </span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30"
                  placeholder={glossaryLocale === 'de' ? 'Begriff suchen...' : 'Search term...'}
                />
              </span>
            </label>
            {searchText && (
              <div className="mt-2 rounded-lg border bg-muted/10 p-2">
                {termsLoading ? (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    {glossaryLocale === 'de' ? 'Suche läuft...' : 'Searching...'}
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-1">
                    {searchResults.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={cn(
                          'block w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          item.id === activeTermId ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
                        )}
                        onClick={() => setActiveTermId(item.id)}
                      >
                        {item.title[glossaryLocale]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    {glossaryLocale === 'de' ? 'Keine Begriffe gefunden.' : 'No terms found.'}
                  </div>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground">
              {glossaryLocale === 'de' ? 'Glossar wird geladen...' : 'Loading glossary...'}
            </div>
          ) : term ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{term.title[glossaryLocale]}</h2>
                <p className="mt-3 text-base leading-7 text-foreground">{term.short[glossaryLocale]}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                {term.body[glossaryLocale]}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              {glossaryLocale === 'de' ? 'Dieser Begriff ist noch nicht im Glossar.' : 'This term is not in the glossary yet.'}
            </div>
          )}
        </div>
      </aside>
    </GlossaryContext.Provider>
  );
}

export function GlossaryTerm({
  termId,
  children,
  className,
  onOpen,
}: {
  termId: GlossaryTermId;
  children: ReactNode;
  className?: string;
  onOpen?: (termId: GlossaryTermId) => void;
}) {
  const glossary = useContext(GlossaryContext);
  const { locale } = useI18n();
  const open = onOpen || glossary?.openTerm;

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span>{children}</span>
      <button
        type="button"
        className="inline-flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => open?.(termId)}
        aria-label={locale === 'en' ? `Explain ${String(children)}` : `${String(children)} erklären`}
      >
        <Info className="size-3" />
      </button>
    </span>
  );
}

export function GlossaryInfoButton({
  termId,
  label,
  className,
  onOpen,
}: {
  termId: GlossaryTermId;
  label: string;
  className?: string;
  onOpen?: (termId: GlossaryTermId) => void;
}) {
  const glossary = useContext(GlossaryContext);
  const { locale } = useI18n();
  const open = onOpen || glossary?.openTerm;

  return (
    <button
      type="button"
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      onClick={() => open?.(termId)}
      aria-label={locale === 'en' ? `Explain ${label}` : `${label} erklären`}
      title={locale === 'en' ? `Explain ${label}` : `${label} erklären`}
    >
      <Info className="size-3" />
    </button>
  );
}

export function useGlossary() {
  const value = useContext(GlossaryContext);
  if (!value) {
    throw new Error('useGlossary must be used inside GlossaryProvider');
  }
  return value;
}
