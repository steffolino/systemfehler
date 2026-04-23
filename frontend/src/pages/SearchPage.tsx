import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, getEntrySourceMeta, getSourceRoleLabel, type Entry } from '../lib/api';
import type { AIHealthResponse, AIResultBundle } from '../lib/api';
import SearchInput from '../components/SearchInput';
import ResultsList from '../components/ResultsList';
import TurnstileWidget from '../components/TurnstileWidget';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/lib/i18n';
import {
  buildGroundedReadableAnswer,
  getReadableAnswerText,
  type LanguageMode,
} from '@/lib/plain_language';
import suggestedQuestionsByLifeEvent from '../data/life_event_suggested_questions.json';

type TabKey = 'article' | 'ai';
type RetrievalMode = 'keyword' | 'hybrid' | 'external';
type LifeEventOption = {
  id: string;
  label_de: string;
  label_en?: string;
};

function parseEvidenceEntriesForPage(evidence: Array<{ content: string }>): Entry[] {
  if (typeof window !== 'undefined' && window.console) {
    console.log('Guided evidence array size:', evidence.length);
  }

  const SAFE_MAX_EVIDENCE = 100;
  if (evidence.length > SAFE_MAX_EVIDENCE) {
    if (typeof window !== 'undefined' && window.console) {
      console.error('Guided evidence array too large, aborting processing. Evidence size:', evidence.length);
    }
    return [];
  }

  const relatedEntriesMap = new Map<string, Entry>();
  let count = 0;
  const MAX_EVIDENCE = 30;

  for (const item of evidence) {
    if (count >= MAX_EVIDENCE) break;

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
      count++;
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
  const { t, locale } = useI18n();
  const translate = t as unknown as (key: string, vars?: Record<string, string | number>) => string;

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const turnstileEnabled = Boolean(turnstileSiteKey) && !isLocalhost;

  const getTurnstileTokenRef = useRef<(() => Promise<string>) | null>(null);

  const [standardQuery, setStandardQuery] = useState('');
  const [debouncedStandardQuery, setDebouncedStandardQuery] = useState('');
  const [aiDraftQuery, setAiDraftQuery] = useState('');
  const [submittedAiQuery, setSubmittedAiQuery] = useState('');
  const [aiLanguageMode, setAiLanguageMode] = useState<LanguageMode>('einfach');
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>('hybrid');
  const [strictOfficialOnly, setStrictOfficialOnly] = useState(false);
  const [lifeEventContext, setLifeEventContext] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('ai');
  const [lastAiSubmitAt, setLastAiSubmitAt] = useState(0);

  const [standardResults, setStandardResults] = useState<Entry[]>([]);
  const [aiResult, setAiResult] = useState<AIResultBundle | null>(null);
  const [aiHealth, setAiHealth] = useState<AIHealthResponse | null>(null);

  const [standardLoading, setStandardLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEvidenceLoading, setAiEvidenceLoading] = useState(false);

  const [standardError, setStandardError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const warmedSuggestionContexts = useRef<Set<string>>(new Set());

  const handleTurnstileReady = useCallback((executor: (() => Promise<string>) | null) => {
    getTurnstileTokenRef.current = executor;
    setTurnstileReady(Boolean(executor));
  }, []);

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
      setAiError(null);
      setAiResult(null);
      return;
    }

    let cancelled = false;
    const pendingResult = buildPendingAiResult(submittedAiQuery, translate);

    setAiLoading(true);
    setAiEvidenceLoading(true);
    setAiError(null);
    setAiResult(pendingResult);

    const fetchWithTurnstile = async <T,>(
      request: (turnstileToken?: string) => Promise<T>
    ): Promise<T> => {
      if (!turnstileEnabled) {
        return request();
      }

      const getToken = getTurnstileTokenRef.current;
      if (!getToken) {
        throw new Error(t('search.bot_protection_failed'));
      }

      const token = await getToken();
      return request(token);
    };

    void (async () => {
      const retrievalOptions = {
        retrievalMode,
        strictOfficial: strictOfficialOnly,
        lifeEvent: lifeEventContext || undefined,
      } as const;
      let rewrite = pendingResult.rewrite;
      let evidence: Array<{ content: string, source: string, confidence: number }> = [];
      let weakEvidence = true;

      try {
        rewrite = await fetchWithTurnstile((turnstileToken) =>
          api.getAIRewrite(submittedAiQuery, { turnstileToken })
        );
      } catch {
        rewrite = pendingResult.rewrite;
      }

      try {
        const retrieveResult = await fetchWithTurnstile((turnstileToken) =>
          api.getAIRetrieve(submittedAiQuery, { turnstileToken, ...retrievalOptions })
        );
        evidence = retrieveResult.evidence;
        weakEvidence = Boolean(retrieveResult.weak_evidence);
      } catch {
        evidence = [];
        weakEvidence = true;
      }

      if (cancelled) return;

      const relatedEntries = parseEvidenceEntriesForPage(evidence);

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
        const synthesis = await fetchWithTurnstile((turnstileToken) =>
          api.getAISynthesis(submittedAiQuery, { turnstileToken, ...retrievalOptions })
        );

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
          setAiLoading(false);
        }
      }
    })().catch((err) => {
      if (cancelled) return;

      setAiError(err instanceof Error ? err.message : t('common.error_title'));
      setAiResult(null);
      setAiEvidenceLoading(false);
      setAiLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [lifeEventContext, retrievalMode, strictOfficialOnly, submittedAiQuery, t, tab, translate, turnstileEnabled]);

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
    if (tab !== 'ai' || turnstileEnabled) return;
    if (!lifeEventContext) return;
    const suggestions = Array.isArray((suggestedQuestionsByLifeEvent as Record<string, string[]>)[lifeEventContext])
      ? (suggestedQuestionsByLifeEvent as Record<string, string[]>)[lifeEventContext]
      : [];
    if (suggestions.length === 0) return;
    if (warmedSuggestionContexts.current.has(lifeEventContext)) return;

    api.warmAIResults(suggestions).finally(() => {
      warmedSuggestionContexts.current.add(lifeEventContext);
    });
  }, [lifeEventContext, tab, turnstileEnabled]);

  function submitAiQuery() {
    const trimmed = aiDraftQuery.trim();
    const now = Date.now();

    if (now - lastAiSubmitAt < 3000) {
      setAiError(t('search.ask_wait'));
      return;
    }

    if (turnstileEnabled && !turnstileReady) {
      setAiError(t('search.bot_protection_loading'));
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

  const MAX_AI_RESULTS = 30;
  const activeResults =
    tab === 'article' ? standardResults : (aiResult?.relatedEntries?.slice(0, MAX_AI_RESULTS) || []);
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

  const displayedAiAnswer = useMemo(() => {
    const base = aiResult?.synthesis.answer || aiResult?.synthesis.explanation || '';

    const backendPlainLanguage =
      aiLanguageMode === 'einfach'
        ? aiResult?.synthesis.plain_language?.einfach
        : aiLanguageMode === 'leicht'
          ? aiResult?.synthesis.plain_language?.leicht
          : '';

    const groundedAnswer =
      aiLanguageMode !== 'standard' && (aiResult?.relatedEntries?.length || 0) > 0
        ? buildGroundedReadableAnswer(aiResult?.relatedEntries || [], aiLanguageMode)
        : '';

    const candidate = backendPlainLanguage || groundedAnswer || base;
    if (!candidate) return '';

    return getReadableAnswerText(candidate, aiLanguageMode, t('search.ai_synthesis'));
  }, [
    aiLanguageMode,
    aiResult?.relatedEntries,
    aiResult?.synthesis.answer,
    aiResult?.synthesis.explanation,
    aiResult?.synthesis.plain_language?.einfach,
    aiResult?.synthesis.plain_language?.leicht,
    t,
  ]);

  const plainLanguageSource =
    aiLanguageMode === 'einfach'
      ? aiResult?.synthesis.plain_language?.sources?.einfach
      : aiLanguageMode === 'leicht'
        ? aiResult?.synthesis.plain_language?.sources?.leicht
        : '';

  const plainLanguageSourceLabel =
    plainLanguageSource === 'reviewed'
      ? t('search.answer_source_reviewed')
      : plainLanguageSource === 'suggested'
        ? t('search.answer_source_suggested')
        : plainLanguageSource === 'fallback'
          ? t('search.answer_source_fallback')
          : '';

  const officialLaneAnswer = aiResult?.synthesis.answer_lanes?.official?.answer?.trim() || '';
  const assistiveLaneAnswer = aiResult?.synthesis.answer_lanes?.assistive?.answer?.trim() || '';
  const contactsLaneAnswer = aiResult?.synthesis.answer_lanes?.contacts?.answer?.trim() || '';
  const assistiveContacts = aiResult?.synthesis.assistive_contacts || [];

  const evidenceRoleLabels = useMemo(() => {
    const labels = new Set<string>();

    for (const entry of aiResult?.relatedEntries || []) {
      labels.add(getSourceRoleLabel(getEntrySourceMeta(entry).sourceRole, locale));
    }

    return Array.from(labels);
  }, [aiResult?.relatedEntries, locale]);

  const aiStatusSummary = useMemo(() => {
    if (!submittedAiQuery && !aiHealth) return '';
    if (aiLoading) return t('search.status_generating_simple');
    if (aiError) return t('search.status_problem');
    if ((aiResult?.relatedEntries?.length || 0) > 0) return t('search.status_grounded');
    if (submittedAiQuery) return t('search.status_searching');

    return aiHealth?.provider.configured ? t('search.status_ready_simple') : '';
  }, [aiError, aiHealth, aiLoading, aiResult?.relatedEntries?.length, submittedAiQuery, t]);

  const lifeEventOptions = useMemo<LifeEventOption[]>(() => {
    const fromHealth = aiHealth?.retrieval?.lifeEvents || [];
    if (fromHealth.length === 0) return [];
    return fromHealth
      .filter((item) => typeof item?.id === 'string' && item.id.trim())
      .map((item) => ({
        id: item.id,
        label_de: item.label_de || item.id,
        label_en: item.label_en || item.label_de || item.id,
      }));
  }, [aiHealth?.retrieval?.lifeEvents]);

  const selectedSuggestedQuestions = useMemo<string[]>(() => {
    if (!lifeEventContext) return [];
    const map = suggestedQuestionsByLifeEvent as Record<string, string[]>;
    const suggestions = map[lifeEventContext];
    return Array.isArray(suggestions) ? suggestions.slice(0, 5) : [];
  }, [lifeEventContext]);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-6 rounded-3xl border bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-5 shadow-sm md:p-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t('search.hero_title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('search.hero_body')}</p>
        <div className="mt-3 text-sm text-muted-foreground">
          <Link to="/sources" className="font-medium text-foreground underline underline-offset-4">
            {t('search.source_link')}
          </Link>
        </div>
      </div>

      <div className="space-y-5">
        <Card className="rounded-3xl border shadow-sm">
          <div className="p-4 md:p-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('search.mode')}
                  </div>
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
                  {tab === 'ai' && (
                    <div className="mt-3 space-y-2">
                      <div className="max-w-md">
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {t('search.life_event_context')}
                        </div>
                        <select
                          value={lifeEventContext}
                          onChange={(event) => setLifeEventContext(event.target.value)}
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        >
                          <option value="">{t('search.life_event_none')}</option>
                          {lifeEventOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                              {locale === 'en' ? item.label_en || item.label_de : item.label_de}
                            </option>
                          ))}
                        </select>
                      </div>
                      {lifeEventContext && selectedSuggestedQuestions.length > 0 && (
                        <div className="rounded-2xl border bg-muted/20 p-3">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t('search.suggested_questions')}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedSuggestedQuestions.map((question) => (
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
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setRetrievalMode('keyword')}
                        className={[
                          'inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition',
                          retrievalMode === 'keyword'
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-background text-foreground hover:bg-muted',
                        ].join(' ')}
                      >
                        {t('search.retrieval_keyword')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRetrievalMode('hybrid')}
                        className={[
                          'inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition',
                          retrievalMode === 'hybrid'
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-background text-foreground hover:bg-muted',
                        ].join(' ')}
                      >
                        {t('search.retrieval_hybrid')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStrictOfficialOnly((value) => !value)}
                        className={[
                          'inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition',
                          strictOfficialOnly
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-background text-foreground hover:bg-muted',
                        ].join(' ')}
                      >
                        {t('search.retrieval_official_only')}
                      </button>
                      </div>
                    </div>
                  )}
                </div>

                {tab === 'ai' && (
                  <div className="md:w-44">
                    <Button
                      className="h-11 w-full"
                      onClick={submitAiQuery}
                      disabled={aiLoading || !aiDraftQuery.trim() || (turnstileEnabled && !turnstileReady)}
                    >
                      {aiLoading ? t('search.working') : t('search.ask_ai')}
                    </Button>
                  </div>
                )}
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
            </div>
          </div>
        </Card>

        {tab === 'ai' ? (
          <>
            <Card className="rounded-3xl border shadow-md">
              <div className="border-b bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,1))] p-5 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('search.ai_synthesis')}
                    </div>
                    {submittedAiQuery && aiStatusSummary && (
                      <div className="mt-2 text-base font-semibold text-foreground">{aiStatusSummary}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(['standard', 'einfach'] as LanguageMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setAiLanguageMode(mode)}
                        className={[
                          'inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition',
                          aiLanguageMode === mode
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-background text-foreground hover:bg-muted',
                        ].join(' ')}
                      >
                        {t(`entry.mode_${mode}` as const)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-2 text-xs text-muted-foreground">{t('search.answer_mode_note')}</div>

                {submittedAiQuery && aiLanguageMode !== 'standard' && plainLanguageSourceLabel && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t('search.answer_source_note')}: {plainLanguageSourceLabel}
                  </div>
                )}
              </div>

              <div className="p-5 md:p-6">
                {aiLoading ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-3">
                    <Spinner />
                    <div className="text-sm text-muted-foreground">{t('common.loading_results')}</div>
                  </div>
                ) : aiError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 text-center">
                    <div className="font-medium text-red-600">{t('common.error_title')}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{aiError}</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submittedAiQuery && aiLanguageMode === 'standard' && (officialLaneAnswer || assistiveLaneAnswer || contactsLaneAnswer) ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border bg-background p-4">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t('search.answer_lane_official')}
                          </div>
                          <div className="whitespace-pre-line text-base leading-6 text-foreground">
                            {officialLaneAnswer || t('search.answer_lane_official_empty')}
                          </div>
                        </div>
                        <div className="rounded-2xl border bg-muted/20 p-4">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t('search.answer_lane_assistive')}
                          </div>
                          <div className="whitespace-pre-line text-base leading-6 text-foreground">
                            {assistiveLaneAnswer || t('search.answer_lane_assistive_empty')}
                          </div>
                        </div>
                        <div className="rounded-2xl border bg-muted/20 p-4">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t('search.answer_lane_contacts')}
                          </div>
                          <div className="whitespace-pre-line text-base leading-6 text-foreground">
                            {contactsLaneAnswer || t('search.answer_lane_contacts_empty')}
                          </div>
                          <div className="mt-4">
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {t('search.assistive_contacts')}
                            </div>
                            {assistiveContacts.length > 0 ? (
                              <div className="space-y-2">
                                {assistiveContacts.map((contact, index) => (
                                  <div key={`${contact.url}-${index}`} className="rounded-lg border bg-background p-3">
                                    <a
                                      href={contact.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-medium text-foreground underline underline-offset-4"
                                    >
                                      {contact.name}
                                    </a>
                                    <div className="mt-1 text-xs text-muted-foreground break-all">{contact.url}</div>
                                    {(contact.phone || contact.email) && (
                                      <div className="mt-1 text-sm text-foreground">
                                        {contact.phone ? `${contact.phone}` : ''}
                                        {contact.phone && contact.email ? ' · ' : ''}
                                        {contact.email ? `${contact.email}` : ''}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">{t('search.assistive_no_contacts')}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-line text-base leading-6 text-foreground">
                        {submittedAiQuery
                          ? displayedAiAnswer || t('search.ready_answer')
                          : aiDraftQuery.trim()
                            ? t('search.ready_answer')
                            : t('search.prompt_ai')}
                      </div>
                    )}

                    {submittedAiQuery && aiResult?.synthesis.weak_evidence && (
                      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                        {t('search.status_weak_evidence')}
                      </div>
                    )}

                    {submittedAiQuery && evidenceRoleLabels.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {evidenceRoleLabels.map((label) => (
                          <span
                            key={label}
                            className="inline-flex rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-4 pt-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Weitere Informationen
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="rounded-3xl border bg-muted/15 shadow-sm">
                  <div className="p-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('search.evidence_entries')}
                    </div>
                    <div className="mt-2">
                      {aiEvidenceLoading ? (
                        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3">
                          <Spinner />
                          <div className="text-sm text-muted-foreground">{t('common.loading_results')}</div>
                        </div>
                      ) : activeResults.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-background/70 p-6 text-center">
                          <div className="font-medium">
                            {submittedAiQuery ? t('search.no_evidence') : t('search.enter_query')}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {submittedAiQuery ? t('search.ai_depends_on_entries') : t('search.submit_only_note')}
                          </div>
                        </div>
                      ) : (
                        <ResultsList results={activeResults} />
                      )}
                    </div>
                  </div>
                </Card>

                <div className="space-y-4">
                  <Card className="rounded-3xl border bg-muted/15 shadow-sm">
                    <div className="p-5">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('search.ai_focus')}
                      </div>
                      <div className="mt-2 text-sm text-foreground">
                        {submittedAiQuery
                          ? aiResult?.rewrite.rewritten_query || t('search.enter_query')
                          : aiDraftQuery.trim()
                            ? t('search.ready_rewrite')
                            : t('search.enter_query')}
                      </div>

                      {submittedAiQuery && aiResult?.rewrite.explanation && (
                        <div className="mt-3 text-sm text-muted-foreground">{aiResult.rewrite.explanation}</div>
                      )}

                      {submittedAiQuery && (aiResult?.rewrite.matched_topics?.length || 0) > 0 && (
                        <div className="mt-3">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t('search.matched_topics')}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {aiResult?.rewrite.matched_topics?.map((topic) => (
                              <span
                                key={topic}
                                className="inline-flex rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground"
                              >
                                {topic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card className="rounded-3xl border bg-muted/15 shadow-sm">
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t('search.technical_details')}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {t('search.technical_details_desc')}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowTechnicalDetails((value) => !value)}
                        >
                          {showTechnicalDetails ? t('search.hide_details') : t('search.show_details')}
                        </Button>
                      </div>

                      {showTechnicalDetails && (
                        <>
                          <div className="mt-4 space-y-2 text-sm">
                            <div>{t('search.status_sidecar')}: {aiHealth?.status || t('common.unknown')}</div>
                            <div>{t('search.status_provider')}: {aiHealth?.provider.provider || 'none'}</div>
                            <div>
                              {t('search.status_configured')}: {statusText(aiHealth?.provider.configured, translate)}
                            </div>
                            <div>
                              {t('search.status_provider_state')}: {aiHealth?.provider.status || t('common.unknown')}
                            </div>
                            <div>
                              {t('search.status_bot_protection')}:{' '}
                              {statusText(turnstileEnabled && turnstileReady, translate)}
                            </div>
                            <div>{t('search.status_retrieval_mode')}: {aiResult?.synthesis.retrieval?.retrieval_mode || aiHealth?.retrieval?.activeMode || t('common.unknown')}</div>
                            <div>{t('search.status_retrieval_filter')}: {statusText(strictOfficialOnly, translate)}</div>
                            <div>{t('search.status_life_event')}: {aiResult?.synthesis.retrieval?.selected_life_event || lifeEventContext || t('common.unknown')}</div>
                            <div>{t('search.status_retrieval_external')}: {aiResult?.synthesis.retrieval?.external_status || (aiHealth?.retrieval?.externalConfigured ? t('search.status_ready') : t('search.status_loading'))}</div>
                          </div>

                          {aiHealth?.provider.models && aiHealth.provider.models.length > 0 && (
                            <div className="mt-3 text-sm text-muted-foreground">
                              {t('search.status_models')}: {aiHealth.provider.models.join(', ')}
                            </div>
                          )}

                          {aiHealth?.provider.error && (
                            <div className="mt-3 text-sm text-red-600">{aiHealth.provider.error}</div>
                          )}
                        </>
                      )}
                    </div>
                  </Card>

                  {turnstileEnabled && (
                    <>
                      <TurnstileWidget siteKey={turnstileSiteKey} onReady={handleTurnstileReady} />
                      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                        {t('search.bot_protection_note')}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <Card className="rounded-3xl border shadow-sm">
            <div className="min-h-80 bg-background p-4 md:p-5">
              {activeLoading ? (
                <div className="flex h-80 flex-col items-center justify-center gap-3">
                  <Spinner />
                  <div className="text-sm text-muted-foreground">{t('common.loading_results')}</div>
                </div>
              ) : activeError ? (
                <div className="flex h-80 items-center justify-center p-6 text-center">
                  <div>
                    <div className="font-medium text-red-600">{t('common.error_title')}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{activeError}</div>
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
                <ResultsList results={activeResults} />
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

