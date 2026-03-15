/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { api, type Entry } from '../lib/api';
import type { AIHealthResponse, AIResultBundle } from '../lib/api';
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
  const [aiResult, setAiResult] = useState<AIResultBundle | null>(null);
  const [aiHealth, setAiHealth] = useState<AIHealthResponse | null>(null);

  const [standardLoading, setStandardLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const [standardError, setStandardError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const { isAuthenticated, isLoading: authLoading } = useAuth0();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [query]);

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
      .getAIResults(debouncedQuery)
      .then((result) => {
        if (cancelled) return;
        setAiResult(result);
      })
      .catch((err) => {
        if (cancelled) return;
        setAiError(err instanceof Error ? err.message : 'Failed to load AI results');
        setAiResult(null);
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isAuthenticated, tab]);

  useEffect(() => {
    if (!isAuthenticated || tab !== 'ai') return;

    let cancelled = false;

    api.getAIHealth().then((health) => {
      if (!cancelled) {
        setAiHealth(health);
      }
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

  const activeResults = tab === 'standard' ? standardResults : aiResult?.relatedEntries || [];
  const activeLoading = tab === 'standard' ? standardLoading : aiLoading;
  const activeError = tab === 'standard' ? standardError : aiError;

  const resultLabel = useMemo(() => {
    if (activeLoading) return 'Loading results…';
    if (activeError) return 'Could not load results';
    if (tab === 'ai') {
      return `${activeResults.length} evidence entr${activeResults.length === 1 ? 'y' : 'ies'}`;
    }
    return `${activeResults.length} result${activeResults.length === 1 ? '' : 's'}`;
  }, [activeLoading, activeError, activeResults.length, tab]);

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

          <div className="min-h-80 rounded-xl border bg-background">
            {activeLoading ? (
              <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                Loading results…
              </div>
            ) : activeError ? (
              <div className="flex h-80 items-center justify-center p-6 text-center">
                <div>
                  <div className="font-medium text-red-600">Something went wrong</div>
                  <div className="mt-1 text-sm text-muted-foreground">{activeError}</div>
                </div>
              </div>
            ) : tab === 'ai' ? (
              <div className="space-y-4 p-4 md:p-5">
                <Card className="p-5">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    AI Status
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    Sidecar: {aiHealth?.status || 'unknown'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Provider: {aiHealth?.provider.provider || 'none'}</span>
                    <span>Configured: {aiHealth?.provider.configured ? 'yes' : 'no'}</span>
                    <span>Provider status: {aiHealth?.provider.status || 'unknown'}</span>
                  </div>
                  {aiHealth?.provider.models && aiHealth.provider.models.length > 0 && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      Models: {aiHealth.provider.models.join(', ')}
                    </div>
                  )}
                  {aiHealth?.provider.error && (
                    <div className="mt-3 text-sm text-red-600">
                      {aiHealth.provider.error}
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    AI Rewrite
                  </div>
                  <div className="mt-2 text-sm text-foreground">
                    {aiResult?.rewrite.rewritten_query || 'No rewritten query available.'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Provider: {aiResult?.rewrite.provider || 'none'}</span>
                    <span>Model: {aiResult?.rewrite.model || 'disabled'}</span>
                    {aiResult?.rewrite.fallback && <span>Fallback active</span>}
                  </div>
                  {aiResult?.rewrite.explanation && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      {aiResult.rewrite.explanation}
                    </div>
                  )}
                </Card>

                <Card className="p-5">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    AI Synthesis
                  </div>
                  <div className="mt-2 whitespace-pre-line text-sm leading-7 text-foreground">
                    {aiResult?.synthesis.answer || aiResult?.synthesis.explanation || 'No AI answer available.'}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Provider: {aiResult?.synthesis.provider || 'none'}</span>
                    <span>Model: {aiResult?.synthesis.model || 'disabled'}</span>
                    {aiResult?.synthesis.fallback && <span>Fallback active</span>}
                    {aiResult?.synthesis.weak_evidence && <span>Weak evidence</span>}
                  </div>
                </Card>

                {activeResults.length === 0 ? (
                  <div className="rounded-xl border p-6 text-center">
                    <div className="font-medium">
                      {debouncedQuery ? 'No evidence entries found' : 'Enter a query to use the AI assistant'}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      The AI tab depends on retrieved entries from the database.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 text-sm font-medium">Evidence entries</div>
                    <ResultsList results={activeResults} />
                  </div>
                )}
              </div>
            ) : activeResults.length === 0 ? (
              <div className="flex h-80 items-center justify-center p-6 text-center">
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
