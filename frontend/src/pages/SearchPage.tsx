/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, type Entry } from '../lib/api';
import type { AIHealthResponse, AIResultBundle } from '../lib/api';
import SearchInput from '../components/SearchInput';
import ResultsList from '../components/ResultsList';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';

type TabKey = 'article' | 'ai';

const AI_SUGGESTED_QUESTIONS = [
  'Ich bin arbeitslos geworden. Was nun?',
  'Wie beantrage ich Buergergeld beim Jobcenter?',
  'Welche Online-Dienste der Arbeitsagentur sollte ich zuerst nutzen?',
  'Wie erreiche ich schnell die richtige Stelle bei der Bundesagentur fuer Arbeit?',
];

function parseEvidenceEntriesForPage(evidence: Array<{ content: string }>): Entry[] {
  const relatedEntriesMap = new Map<string, Entry>();

  for (const item of evidence) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(item.content);
    } catch {
      continue;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;

    const entry = parsed as Partial<Entry>;
    if (typeof entry.id !== 'string' || typeof entry.url !== 'string' || typeof entry.status !== 'string') {
      continue;
    }

    if (!relatedEntriesMap.has(entry.id)) {
      relatedEntriesMap.set(entry.id, entry as Entry);
    }
  }

  return Array.from(relatedEntriesMap.values());
}

function buildPendingAiResult(
  query: string,
  t: (key: string, vars?: Record<string, string | number>) => string
): AIResultBundle {
  return {
    rewrite: {
      rewritten_query: query,
      model: 'pending',
      provider: 'none',
      latency_ms: 0,
      fallback: true,
      explanation: t('search.ready_rewrite'),
    },
    synthesis: {
      answer: null,
      explanation: t('search.ready_answer'),
      sources: [],
      provider: 'pending',
      model: 'pending',
      latency_ms: 0,
      fallback: true,
      evidence: [],
      weak_evidence: true,
    },
    relatedEntries: [],
  };
}

function statusText(value: boolean | undefined, t: (key: string) => string) {
  return value ? t('common.yes') : t('common.no');
}

export default function SearchPage() {
  const { t } = useI18n();
  const translate = t as unknown as (key: string, vars?: Record<string, string | number>) => string;
  const [standardQuery, setStandardQuery] = useState('');
  const [debouncedStandardQuery, setDebouncedStandardQuery] = useState('');
  const [aiDraftQuery, setAiDraftQuery] = useState('');
  const [submittedAiQuery, setSubmittedAiQuery] = useState('');
  const [tab, setTab] = useState<TabKey>('ai');
  const [lastAiSubmitAt, setLastAiSubmitAt] = useState(0);

  const [standardResults, setStandardResults] = useState<Entry[]>([]);
  const [aiResult, setAiResult] = useState<AIResultBundle | null>(null);
  const [aiHealth, setAiHealth] = useState<AIHealthResponse | null>(null);

  const [standardLoading, setStandardLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEvidenceLoading, setAiEvidenceLoading] = useState(false);
  const [aiSynthesisLoading, setAiSynthesisLoading] = useState(false);

  const [standardError, setStandardError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestionsWarmed, setAiSuggestionsWarmed] = useState(false);

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
        if (!cancelled) setStandardResults(res.entries);
      })
      .catch((err) => {
        if (!cancelled) setStandardError(err instanceof Error ? err.message : t('common.error_title'));
      })
      .finally(() => {
        if (!cancelled) setStandardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedStandardQuery, t]);

  useEffect(() => {
    if (tab !== 'ai') return;
    if (!submittedAiQuery) {
      setAiLoading(false);
      setAiEvidenceLoading(false);
      setAiSynthesisLoading(false);
      setAiError(null);
      setAiResult(null);
      return;
    }

    let cancelled = false;
    const pendingResult = buildPendingAiResult(submittedAiQuery, translate);

    setAiLoading(true);
    setAiEvidenceLoading(true);
    setAiSynthesisLoading(true);
    setAiError(null);
    setAiResult(pendingResult);

    Promise.allSettled([api.getAIRewrite(submittedAiQuery), api.getAIRetrieve(submittedAiQuery)])
      .then(async ([rewriteResult, retrieveResult]) => {
        if (cancelled) return;

        const rewrite = rewriteResult.status === 'fulfilled' ? rewriteResult.value : pendingResult.rewrite;
        const evidence = retrieveResult.status === 'fulfilled' ? retrieveResult.value.evidence : [];
        const relatedEntries = parseEvidenceEntriesForPage(evidence);
        const weakEvidence = retrieveResult.status === 'fulfilled' ? Boolean(retrieveResult.value.weak_evidence) : true;

        setAiResult({
          rewrite,
          synthesis: {
            ...pendingResult.synthesis,
            evidence,
            weak_evidence: weakEvidence,
            explanation: relatedEntries.length > 0 ? t('search.evidence_loading') : t('search.no_evidence_yet'),
          },
          relatedEntries,
        });
        setAiEvidenceLoading(false);

        try {
          const synthesis = await api.getAISynthesis(submittedAiQuery);
          if (cancelled) return;
          setAiResult((current) => ({
            rewrite: current?.rewrite || rewrite,
            synthesis,
            relatedEntries: current?.relatedEntries || relatedEntries,
          }));
        } catch (err) {
          if (cancelled) return;
          setAiResult((current) => ({
            rewrite: current?.rewrite || rewrite,
            synthesis: {
              ...(current?.synthesis || pendingResult.synthesis),
              answer: null,
              explanation: err instanceof Error ? err.message : t('common.error_title'),
              provider: 'unknown',
              model: 'timeout',
              fallback: true,
            },
            relatedEntries: current?.relatedEntries || relatedEntries,
          }));
        } finally {
          if (!cancelled) {
            setAiSynthesisLoading(false);
            setAiLoading(false);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setAiError(err instanceof Error ? err.message : t('common.error_title'));
        setAiResult(null);
        setAiEvidenceLoading(false);
        setAiSynthesisLoading(false);
        setAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [submittedAiQuery, tab, translate]);

  useEffect(() => {
    if (tab !== 'ai') return;
    let cancelled = false;
    api.getAIHealth().then((health) => {
      if (!cancelled) setAiHealth(health);
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  useEffect(() => {
    if (tab !== 'ai' || aiSuggestionsWarmed) return;
    api.warmAIResults(AI_SUGGESTED_QUESTIONS).finally(() => {
      setAiSuggestionsWarmed(true);
    });
  }, [aiSuggestionsWarmed, tab]);

  function submitAiQuery() {
    const trimmed = aiDraftQuery.trim();
    const now = Date.now();
    if (now - lastAiSubmitAt < 3000) {
      setAiError(t('search.ask_wait'));
      return;
    }
    setLastAiSubmitAt(now);
    setSubmittedAiQuery(trimmed);
    if (!trimmed) {
      setAiResult(null);
      setAiError(null);
    }
  }

  function useSuggestedQuestion(question: string) {
    setAiDraftQuery(question);
    setSubmittedAiQuery(question);
  }

  useEffect(() => {
    if (tab !== 'ai') return;
    if (aiDraftQuery.trim()) return;
    if (!standardQuery.trim()) return;
    setAiDraftQuery(standardQuery.trim());
  }, [aiDraftQuery, standardQuery, tab]);

  const activeResults = tab === 'article' ? standardResults : aiResult?.relatedEntries || [];
  const activeLoading = tab === 'article' ? standardLoading : aiEvidenceLoading;
  const activeError = tab === 'article' ? standardError : aiError;
  const activeQuery = tab === 'article' ? debouncedStandardQuery : submittedAiQuery;

  const resultLabel = useMemo(() => {
    if (activeLoading) return t('common.loading_results');
    if (activeError) return t('common.error_title');
    return tab === 'ai'
      ? t('search.evidence_count', { count: activeResults.length })
      : t('search.result_count', { count: activeResults.length });
  }, [activeError, activeLoading, activeResults.length, t, tab]);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-6 rounded-3xl border bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),transparent_35%),linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] p-5 shadow-sm md:p-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t('search.hero_title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('search.hero_body')}</p>
        <div className="mt-3 text-sm text-muted-foreground">
          <Link to="/sources" className="font-medium text-foreground underline underline-offset-4">
            {t('search.source_link')}
          </Link>
        </div>
      </div>

      <Card className="p-4 md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 border-b pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('search.mode')}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {tab === 'ai' ? t('search.mode_ai_desc') : t('search.mode_article_desc')}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border p-1">
                <Button variant={tab === 'article' ? 'default' : 'ghost'} onClick={() => setTab('article')}>
                  {t('search.mode_article')}
                </Button>
                <Button variant={tab === 'ai' ? 'default' : 'ghost'} onClick={() => setTab('ai')}>
                  {t('search.mode_ai')}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-start">
              <div className="flex-1">
                <SearchInput
                  value={tab === 'article' ? standardQuery : aiDraftQuery}
                  onChange={tab === 'article' ? setStandardQuery : setAiDraftQuery}
                  enableAutocomplete={tab === 'article'}
                  onSubmit={tab === 'ai' ? submitAiQuery : undefined}
                  placeholder={tab === 'ai' ? t('search.ai_placeholder') : t('search.article_placeholder')}
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  {tab === 'ai' ? t('search.ai_helper') : t('search.article_helper')}
                </div>
              </div>

              {tab === 'ai' && (
                <div className="md:w-44">
                  <Button className="w-full" onClick={submitAiQuery} disabled={aiLoading || !aiDraftQuery.trim()}>
                    {aiLoading ? t('search.working') : t('search.ask_ai')}
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              {activeQuery
                ? tab === 'ai'
                  ? t('search.showing_ai', { query: activeQuery })
                  : t('search.showing_article', { query: activeQuery })
                : tab === 'ai'
                  ? t('search.prompt_ai')
                  : t('search.show_all')}
            </div>

            <div className="text-sm text-muted-foreground">{resultLabel}</div>
          </div>

          <div className="min-h-80 rounded-xl border bg-background">
            {activeLoading ? (
              <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                {t('common.loading_results')}
              </div>
            ) : activeError ? (
              <div className="flex h-80 items-center justify-center p-6 text-center">
                <div>
                  <div className="font-medium text-red-600">{t('common.error_title')}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{activeError}</div>
                </div>
              </div>
            ) : tab === 'ai' ? (
              <div className="space-y-4 p-4 md:p-5">
                <Card className="p-5">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('search.suggested_questions')}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{t('search.suggested_questions_desc')}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {AI_SUGGESTED_QUESTIONS.map((question) => (
                      <Button
                        key={question}
                        variant="outline"
                        className="h-auto whitespace-normal text-left"
                        onClick={() => useSuggestedQuestion(question)}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">{t('search.warm_hint')}</div>
                </Card>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-4">
                    <Card className="p-5">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('search.ai_rewrite')}
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {submittedAiQuery
                          ? aiResult?.rewrite.rewritten_query || t('search.enter_query')
                          : aiDraftQuery.trim()
                            ? t('search.ready_rewrite')
                            : t('search.enter_query')}
                      </div>
                      {submittedAiQuery && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{t('search.status_provider')}: {aiResult?.rewrite.provider || t('common.unknown')}</span>
                          <span>{t('search.status_models')}: {aiResult?.rewrite.model || t('common.unknown')}</span>
                          {aiResult?.rewrite.fallback && <span>{t('search.status_fallback')}</span>}
                          {aiEvidenceLoading && <span>{t('search.status_loading')}</span>}
                        </div>
                      )}
                      {submittedAiQuery && aiResult?.rewrite.explanation && (
                        <div className="mt-3 text-sm text-muted-foreground">{aiResult.rewrite.explanation}</div>
                      )}
                    </Card>

                    <Card className="p-5">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('search.ai_synthesis')}
                      </div>
                      <div className="mt-2 whitespace-pre-line text-sm leading-7 text-foreground">
                        {submittedAiQuery
                          ? aiResult?.synthesis.answer || aiResult?.synthesis.explanation || t('search.ready_answer')
                          : aiDraftQuery.trim()
                            ? t('search.ready_answer')
                            : t('search.prompt_ai')}
                      </div>
                      {submittedAiQuery && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{t('search.status_provider')}: {aiResult?.synthesis.provider || t('common.unknown')}</span>
                          <span>{t('search.status_models')}: {aiResult?.synthesis.model || t('common.unknown')}</span>
                          {aiResult?.synthesis.fallback && <span>{t('search.status_fallback')}</span>}
                          {aiResult?.synthesis.weak_evidence && <span>{t('search.status_weak_evidence')}</span>}
                          {aiSynthesisLoading && <span>{t('search.status_generating')}</span>}
                        </div>
                      )}
                    </Card>

                    {activeResults.length === 0 ? (
                      <div className="rounded-xl border p-6 text-center">
                        <div className="font-medium">{submittedAiQuery ? t('search.no_evidence') : t('search.enter_query')}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {submittedAiQuery ? t('search.ai_depends_on_entries') : t('search.submit_only_note')}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mb-2 text-sm font-medium">{t('search.evidence_entries')}</div>
                        <ResultsList results={activeResults} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <Card className="p-5">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('search.ai_status')}
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        <div>{t('search.status_sidecar')}: {aiHealth?.status || t('common.unknown')}</div>
                        <div>{t('search.status_provider')}: {aiHealth?.provider.provider || 'none'}</div>
                        <div>{t('search.status_configured')}: {statusText(aiHealth?.provider.configured, translate)}</div>
                        <div>{t('search.status_provider_state')}: {aiHealth?.provider.status || t('common.unknown')}</div>
                      </div>
                      {aiHealth?.provider.models && aiHealth.provider.models.length > 0 && (
                        <div className="mt-3 text-sm text-muted-foreground">
                          {t('search.status_models')}: {aiHealth.provider.models.join(', ')}
                        </div>
                      )}
                      {aiHealth?.provider.error && <div className="mt-3 text-sm text-red-600">{aiHealth.provider.error}</div>}
                    </Card>
                  </div>
                </div>
              </div>
            ) : activeResults.length === 0 ? (
              <div className="flex h-80 items-center justify-center p-6 text-center">
                <div>
                  <div className="font-medium">
                    {debouncedStandardQuery ? t('common.no_results') : t('common.no_data')}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {debouncedStandardQuery ? t('common.try_other_query') : t('search.subtitle')}
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
