import { useEffect, useMemo, useState } from 'react';
import { api, type Entry } from '../lib/api';
import SearchInput from '../components/SearchInput';
import ResultsList from '../components/ResultsList';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type TabKey = 'standard' | 'ai';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState<TabKey>('standard');

  const [standardResults, setStandardResults] = useState<Entry[]>([]);
  const [aiResults, setAiResults] = useState<Entry[]>([]);

  const [standardLoading, setStandardLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [standardError, setStandardError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    setAuthLoading(true);

    api
      .getMe?.()
      .then((user) => {
        if (cancelled) return;
        setIsAuthenticated(Boolean(user));
      })
      .catch(() => {
        if (cancelled) return;
        setIsAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setStandardLoading(true);
    setStandardError(null);

    api
      .getEntries(debouncedQuery ? { search: debouncedQuery } : {})
      .then((res) => {
        if (cancelled) return;
        setStandardResults(res.entries);
      })
      .catch((err) => {
        if (cancelled) return;
        setStandardError(err instanceof Error ? err.message : 'Failed to load results');
      })
      .finally(() => {
        if (!cancelled) setStandardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (!isAuthenticated || tab !== 'ai') return;

    let cancelled = false;

    setAiLoading(true);
    setAiError(null);

    api
      .getAIResults()
      .then((results) => {
        if (cancelled) return;
        setAiResults(results);
      })
      .catch((err) => {
        if (cancelled) return;
        setAiError(err instanceof Error ? err.message : 'Failed to load AI results');
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, tab]);

  useEffect(() => {
    if (!isAuthenticated && tab === 'ai') {
      setTab('standard');
    }
  }, [isAuthenticated, tab]);

  const activeResults = tab === 'standard' ? standardResults : aiResults;
  const activeLoading = tab === 'standard' ? standardLoading : aiLoading;
  const activeError = tab === 'standard' ? standardError : aiError;

  const resultLabel = useMemo(() => {
    if (activeLoading) return 'Loading results…';
    if (activeError) return 'Could not load results';
    return `${activeResults.length} result${activeResults.length === 1 ? '' : 's'}`;
  }, [activeLoading, activeError, activeResults.length]);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search the database and inspect standard or AI-generated results.
        </p>
      </div>

      <Card className="p-4 md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <SearchInput value={query} onChange={setQuery} />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={tab === 'standard' ? 'default' : 'outline'}
                onClick={() => setTab('standard')}
              >
                Standard
              </Button>

              {!authLoading && isAuthenticated && (
                <Button
                  variant={tab === 'ai' ? 'default' : 'outline'}
                  onClick={() => setTab('ai')}
                >
                  AI
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {debouncedQuery
                ? `Showing matches for “${debouncedQuery}”`
                : 'Showing all available entries'}
            </div>

            <div className="text-sm text-muted-foreground">{resultLabel}</div>
          </div>

          <div className="min-h-[320px] rounded-xl border bg-background">
            {activeLoading ? (
              <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                Loading results…
              </div>
            ) : activeError ? (
              <div className="flex h-[320px] items-center justify-center p-6 text-center">
                <div>
                  <div className="font-medium text-red-600">Something went wrong</div>
                  <div className="mt-1 text-sm text-muted-foreground">{activeError}</div>
                </div>
              </div>
            ) : activeResults.length === 0 ? (
              <div className="flex h-[320px] items-center justify-center p-6 text-center">
                <div>
                  <div className="font-medium">
                    {debouncedQuery ? 'No results found' : 'No entries available'}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {debouncedQuery
                      ? 'Try a different keyword or a shorter query.'
                      : 'There is currently no data to display.'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-2 md:p-3">
                <ResultsList results={activeResults} />
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
