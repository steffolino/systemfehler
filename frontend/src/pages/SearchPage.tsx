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
  const [standardQuery, setStandardQuery] = useState('');
  const [debouncedStandardQuery, setDebouncedStandardQuery] = useState('');
  const [aiDraftQuery, setAiDraftQuery] = useState('');
  const [submittedAiQuery, setSubmittedAiQuery] = useState('');
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
      setDebouncedStandardQuery(standardQuery.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [standardQuery]);

  useEffect(() => {
    let cancelled = false;

    setStandardLoading(true);
    setStandardError(null);

    api
      .getEntries(debouncedStandardQuery ? { search: debouncedStandardQuery } : {})
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
  }, [debouncedStandardQuery]);

  useEffect(() => {
    if (!isAuthenticated || tab !== 'ai') return;
    if (!submittedAiQuery) {
      setAiLoading(false);
      setAiError(null);
      setAiResult(null);
      return;
    }

    let cancelled = false;

    setAiLoading(true);
    setAiError(null);

    api
      .getAIResults(submittedAiQuery)
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
  }, [submittedAiQuery, isAuthenticated, tab]);

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

  function submitAiQuery() {
    const trimmed = aiDraftQuery.trim();
    setSubmittedAiQuery(trimmed);
    if (!trimmed) {
      setAiResult(null);
      setAiError(null);
    }
  }

  useEffect(() => {
    if (tab !== 'ai') return;
    if (aiDraftQuery.trim()) return;
    if (!standardQuery.trim()) return;
    setAiDraftQuery(standardQuery.trim());
  }, [aiDraftQuery, standardQuery, tab]);

  const activeResults = tab === 'standard' ? standardResults : aiResult?.relatedEntries || [];
  const activeLoading = tab === 'standard' ? standardLoading : aiLoading;
  const activeError = tab === 'standard' ? standardError : aiError;
  const activeQuery = tab === 'standard' ? debouncedStandardQuery : submittedAiQuery;

  const resultLabel = useMemo(() => {
    if (activeLoading) return 'Loading results...';
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
          <div className="flex flex-col gap-3 border-b pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Search Mode
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {tab === 'ai'
                    ? 'AI mode uses deliberate submit-only prompts and retrieval-backed answers.'
                    : 'Standard mode is optimized for fast browsing and autocomplete.'}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border p-1">
                <Button
                  variant={tab === 'standard' ? 'default' : 'ghost'}
                  onClick={() => setTab('standard')}
                >
                  Standard
                </Button>

                {!authLoading && isAuthenticated && (
                  <Button
                    variant={tab === 'ai' ? 'default' : 'ghost'}
                    onClick={() => setTab('ai')}
                  >
                    AI
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <div className="flex-1">
                <SearchInput
                  value={tab === 'standard' ? standardQuery : aiDraftQuery}
                  onChange={tab === 'standard' ? setStandardQuery : setAiDraftQuery}
                  enableAutocomplete={tab === 'standard'}
                  onSubmit={tab === 'ai' ? submitAiQuery : undefined}
                  placeholder={tab === 'ai' ? 'Ask the AI assistant in full sentences...' : 'Search entries...'}
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  {tab === 'ai'
                    ? 'Autocomplete is disabled here so the model only runs on your submitted question.'
                    : 'Results update while you type and suggestions appear automatically.'}
                </div>
              </div>

              {tab === 'ai' && (
                <div className="md:w-44">
                  <Button className="w-full" onClick={submitAiQuery} disabled={aiLoading || !aiDraftQuery.trim()}>
                    {aiLoading ? 'Asking...' : 'Ask AI'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {activeQuery
                ? tab === 'ai'
                  ? `Showing AI evidence for "${activeQuery}"`
                  : `Showing matches for "${activeQuery}"`
                : tab === 'ai'
                  ? 'Enter a full question and submit it to the AI assistant'
                  : 'Showing all available entries'}
            </div>

            <div className="text-sm text-muted-foreground">{resultLabel}</div>
          </div>

          <div className="min-h-80 rounded-xl border bg-background">
            {activeLoading ? (
              <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                Loading results...
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
                    {submittedAiQuery
                      ? aiResult?.rewrite.rewritten_query || 'No rewritten query available.'
                      : aiDraftQuery.trim()
                        ? 'Draft query ready. Submit to generate a rewritten retrieval query.'
                        : 'Enter a question to prepare an AI request.'}
                  </div>
                  {submittedAiQuery && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Provider: {aiResult?.rewrite.provider || 'unknown'}</span>
                      <span>Model: {aiResult?.rewrite.model || 'unknown'}</span>
                      {aiResult?.rewrite.fallback && <span>Fallback active</span>}
                    </div>
                  )}
                  {submittedAiQuery && aiResult?.rewrite.explanation && (
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
                    {submittedAiQuery
                      ? aiResult?.synthesis.answer || aiResult?.synthesis.explanation || 'No AI answer available.'
                      : aiDraftQuery.trim()
                        ? 'Ready to synthesize after you submit the current question.'
                        : 'Enter a full question and submit it to the AI assistant.'}
                  </div>
                  {submittedAiQuery && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Provider: {aiResult?.synthesis.provider || 'unknown'}</span>
                      <span>Model: {aiResult?.synthesis.model || 'unknown'}</span>
                      {aiResult?.synthesis.fallback && <span>Fallback active</span>}
                      {aiResult?.synthesis.weak_evidence && <span>Weak evidence</span>}
                    </div>
                  )}
                </Card>

                {activeResults.length === 0 ? (
                  <div className="rounded-xl border p-6 text-center">
                    <div className="font-medium">
                      {submittedAiQuery ? 'No evidence entries found' : 'Enter a query to use the AI assistant'}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {submittedAiQuery
                        ? 'The AI tab depends on retrieved entries from the database.'
                        : 'AI mode only runs after you explicitly submit a query.'}
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
                    {debouncedStandardQuery ? 'No results found' : 'No entries available'}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {debouncedStandardQuery
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
