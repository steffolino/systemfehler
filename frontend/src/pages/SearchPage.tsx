import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api, getEntrySourceMeta, getSourceRoleLabel, getSourceTierLabel, type Entry } from '../lib/api';
import type { AIChatMessage, AIHealthResponse, AIResultBundle } from '../lib/api';
import SearchInput from '../components/SearchInput';
import ResultsList from '../components/ResultsList';
import TurnstileWidget from '../components/TurnstileWidget';
import { GlossaryInfoButton, GlossaryTerm } from '@/components/glossary/GlossaryProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useI18n } from '@/lib/i18n';
import {
  buildGroundedReadableAnswer,
  getReadableAnswerText,
  type LanguageMode,
} from '@/lib/plain_language';
import localLifeEvents from '../../../data/_topics/life_events.json';
import suggestedQuestionsByLifeEvent from '../data/life_event_suggested_questions.json';

type TabKey = 'article' | 'ai';
type RetrievalMode = 'keyword' | 'hybrid' | 'external';
type LifeEventOption = {
  id: string;
  label_de: string;
  label_en?: string;
};
type LocalLifeEventsFile = {
  scenarios?: Array<{
    id?: string;
    label_de?: string;
    label_en?: string;
  }>;
};
type ChatThreadMessage = AIChatMessage & {
  id: string;
  evidenceCount?: number;
  weakEvidence?: boolean;
  isError?: boolean;
  relatedEntries?: Entry[];
  plainLanguage?: {
    einfach?: string | null;
    leicht?: string | null;
  };
};

const MAX_DEMO_ASSISTANT_RESPONSES = 3;

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(<strong key={`${match.index}-${match[1]}`} className="font-semibold">{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

function extractSourceLinks(text: string): { cleanText: string; sources: string[] } {
  const sourceSet = new Set<string>();
  const addSource = (url: string) => {
    const cleaned = String(url || '')
      .trim()
      .replace(/[.,;]+$/, '');
    if (cleaned) sourceSet.add(cleaned);
    return '';
  };
  const cleanText = String(text || '')
    .replace(/\[(?:Quelle|Source)\]\((https?:\/\/[^)\s]+)\)/gi, (_match, url: string) => addSource(url))
    .replace(/\[Quelle:\]\((https?:\/\/[^)\s]+)\)(?:\s+\[(?:https?:\/\/[^\]]+)\]\(\1\))?/gi, (_match, url: string) =>
      addSource(url)
    )
    .replace(/\[Quelle:\s*\]\((https?:\/\/[^)\s]+)\)/gi, (_match, url: string) => addSource(url))
    .replace(/\[Quelle:\s*(https?:\/\/[^\]\s]+)\]/gi, (_match, url: string) => {
      return addSource(url);
    })
    .replace(/\b(?:Quelle|Source):\s*(https?:\/\/\S+)/gi, (_match, url: string) => addSource(url))
    .replace(/\[(https?:\/\/[^\]\s]+)\]\(\1\)/gi, (_match, url: string) => addSource(url))
    .replace(/(^|\s)\[\](?=\s|$)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleanText, sources: Array.from(sourceSet) };
}

function SourceLinks({ sources }: { sources: string[] }) {
  const validSources = sources.filter((source) => {
    try {
      const url = new URL(source);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  });

  if (validSources.length === 0) return null;

  return (
    <div className="mt-2 space-y-1 text-xs leading-5">
      {validSources.map((source) => (
        <a
          key={source}
          href={source}
          target="_blank"
          rel="noreferrer"
          className="block break-all rounded-md border bg-background px-2 py-1 text-foreground underline underline-offset-2"
        >
          Quelle: {source}
        </a>
      ))}
    </div>
  );
}

function MarkdownLine({ text }: { text: string }) {
  const { cleanText, sources } = extractSourceLinks(text);

  return (
    <>
      {cleanText && <span>{renderInlineMarkdown(cleanText)}</span>}
      <SourceLinks sources={sources} />
    </>
  );
}

function MarkdownText({ text, className = '' }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = String(text || '').split(/\r?\n/);
  let bulletItems: string[] = [];

  function flushBullets(key: string) {
    if (bulletItems.length === 0) return;
    blocks.push(
      <ul key={key} className="my-2 list-disc space-y-1 pl-5">
        {bulletItems.map((item, index) => (
          <li key={`${key}-${index}`}>
            <MarkdownLine text={item} />
          </li>
        ))}
      </ul>
    );
    bulletItems = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      bulletItems.push(bullet[1]);
      return;
    }

    flushBullets(`bullets-${index}`);
    if (!trimmed) {
      blocks.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }
    blocks.push(
      <div key={`p-${index}`}>
        <MarkdownLine text={trimmed} />
      </div>
    );
  });

  flushBullets('bullets-end');

  return <div className={['space-y-1', className].filter(Boolean).join(' ')}>{blocks}</div>;
}

function stripSourceMarkupForReadableAnswer(text: string) {
  return String(text || '')
    .replace(/\[Quelle:\s*https?:\/\/[^\]\s]+\]/gi, '')
    .replace(/\[Quelle:\]\(https?:\/\/[^)\s]+\)/gi, '')
    .replace(/\[(https?:\/\/[^\]\s]+)\]\(\1\)/gi, '')
    .replace(/\b(?:Quelle|Source):\s*https?:\/\/\S+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

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

function userFacingAiError(error: unknown, t: (key: string) => string) {
  const message = error instanceof Error ? error.message : '';
  if (/turnstile timed out|challenge expired|request already in progress/i.test(message)) {
    return t('search.bot_protection_timeout');
  }
  if (/turnstile|bot protection|challenge failed/i.test(message)) {
    return t('search.bot_protection_failed');
  }
  return message || t('common.error_title');
}

export default function SearchPage() {
  const { t, locale } = useI18n();
  const translate = t as unknown as (key: string, vars?: Record<string, string | number>) => string;

  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const getTurnstileTokenRef = useRef<(() => Promise<string>) | null>(null);

  const [standardQuery, setStandardQuery] = useState('');
  const [debouncedStandardQuery, setDebouncedStandardQuery] = useState('');
  const [aiDraftQuery, setAiDraftQuery] = useState('');
  const [submittedAiQuery, setSubmittedAiQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatThreadMessage[]>([]);
  const [aiLanguageMode, setAiLanguageMode] = useState<LanguageMode>('standard');
  const [showHelpfulAnswer, setShowHelpfulAnswer] = useState(false);
  const [showMoreInformation, setShowMoreInformation] = useState(false);
  const [lifeEventPanel, setLifeEventPanel] = useState<'overview' | 'detail'>('overview');
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
  const configuredTurnstileSiteKey =
    (aiHealth?.turnstile?.siteKey || import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();
  const requiresTurnstile = !isLocalhost && (aiHealth?.turnstile?.configured ?? Boolean(configuredTurnstileSiteKey));
  const turnstileEnabled = requiresTurnstile && Boolean(configuredTurnstileSiteKey);
  const turnstileMisconfigured = requiresTurnstile && !turnstileEnabled;
  const assistantResponseCount = chatMessages.filter(
    (message) => message.role === 'assistant' && !message.isError
  ).length;
  const chatLimitReached = assistantResponseCount >= MAX_DEMO_ASSISTANT_RESPONSES;

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
    return;

    if (tab !== 'ai') return;

    if (!submittedAiQuery) {
      setAiLoading(false);
      setAiEvidenceLoading(false);
      setAiError(null);
      setAiResult(null);
      return;
    }

    // If Turnstile is required but not yet ready, show a loading state and
    // wait — this effect will re-run automatically once turnstileReady becomes true.
    if (turnstileEnabled && !turnstileReady) {
      setAiLoading(true);
      setAiEvidenceLoading(true);
      setAiError(null);
      setAiResult(buildPendingAiResult(submittedAiQuery, translate));
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
      if (!requiresTurnstile) {
        return request();
      }

      if (turnstileMisconfigured) {
        throw new Error(t('search.bot_protection_failed'));
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
  }, [lifeEventContext, requiresTurnstile, retrievalMode, strictOfficialOnly, submittedAiQuery, t, tab, translate, turnstileEnabled, turnstileMisconfigured, turnstileReady]);

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
    if (tab !== 'ai' || turnstileEnabled || requiresTurnstile) return;
    if (!lifeEventContext) return;
    const suggestions = Array.isArray((suggestedQuestionsByLifeEvent as Record<string, string[]>)[lifeEventContext])
      ? (suggestedQuestionsByLifeEvent as Record<string, string[]>)[lifeEventContext]
      : [];
    if (suggestions.length === 0) return;
    if (warmedSuggestionContexts.current.has(lifeEventContext)) return;

    api.warmAIResults(suggestions).finally(() => {
      warmedSuggestionContexts.current.add(lifeEventContext);
    });
  }, [lifeEventContext, requiresTurnstile, tab, turnstileEnabled]);

  async function submitAiQuery(nextQuery?: unknown) {
    const trimmed = (typeof nextQuery === 'string' ? nextQuery : aiDraftQuery).trim();
    const now = Date.now();

    if (!trimmed) {
      setSubmittedAiQuery('');
      setAiDraftQuery('');
      setAiResult(null);
      setAiError(null);
      setChatMessages([]);
      setAiLoading(false);
      setAiEvidenceLoading(false);
      return;
    }

    if (chatLimitReached) {
      setAiError(t('search.chat_limit_notice'));
      return;
    }

    if (now - lastAiSubmitAt < 3000) {
      setAiError(t('search.ask_wait'));
      return;
    }

    if (turnstileMisconfigured) {
      setAiError(t('search.bot_protection_failed'));
      return;
    }

    if (turnstileEnabled && !turnstileReady) {
      setAiError(t('search.bot_protection_loading'));
      return;
    }

    setLastAiSubmitAt(now);
    setSubmittedAiQuery(trimmed);
    setAiDraftQuery('');

    const userMessage: ChatThreadMessage = {
      id: `user-${now}`,
      role: 'user',
      content: trimmed,
    };
    const nextMessages = [...chatMessages.filter((message) => !message.isError), userMessage].slice(-8);
    setChatMessages(nextMessages);
    setAiLoading(true);
    setAiEvidenceLoading(true);
    setAiError(null);
    setAiResult(buildPendingAiResult(trimmed, translate));

    const fetchWithTurnstile = async <T,>(
      request: (turnstileToken?: string) => Promise<T>
    ): Promise<T> => {
      if (!requiresTurnstile) {
        return request();
      }

      const getToken = getTurnstileTokenRef.current;
      if (!getToken) {
        throw new Error(t('search.bot_protection_failed'));
      }

      const token = await getToken();
      return request(token);
    };

    try {
      const retrievalOptions = {
        retrievalMode,
        strictOfficial: strictOfficialOnly,
        lifeEvent: lifeEventContext || undefined,
      } as const;
      const chatResponse = await fetchWithTurnstile((turnstileToken) =>
        api.getAIChat(nextMessages, { turnstileToken, ...retrievalOptions })
      );
      const relatedEntries = parseEvidenceEntriesForPage(chatResponse.evidence || []);
      const answerText = chatResponse.answer || chatResponse.explanation || t('search.no_reliable_answer_title');

      setAiResult({
        rewrite: {
          rewritten_query: chatResponse.standalone_query || trimmed,
          model: chatResponse.model,
          provider: chatResponse.provider,
          latency_ms: chatResponse.latency_ms,
          fallback: chatResponse.fallback,
          explanation: chatResponse.standalone_query && chatResponse.standalone_query !== trimmed
            ? t('search.chat_standalone_note')
            : undefined,
        },
        synthesis: {
          answer: chatResponse.answer,
          explanation: chatResponse.explanation,
          sources: chatResponse.sources,
          provider: chatResponse.provider,
          model: chatResponse.model,
          latency_ms: chatResponse.latency_ms,
          fallback: chatResponse.fallback,
          evidence: chatResponse.evidence,
          evidence_lanes: chatResponse.evidence_lanes,
          answer_lanes: chatResponse.answer_lanes,
          assistive_contacts: chatResponse.assistive_contacts,
          weak_evidence: chatResponse.weak_evidence,
          usage: chatResponse.usage,
          retrieval: chatResponse.retrieval,
          plain_language: chatResponse.plain_language,
        },
        relatedEntries,
      });
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: answerText,
          evidenceCount: relatedEntries.length,
          weakEvidence: Boolean(chatResponse.weak_evidence),
          relatedEntries,
          plainLanguage: chatResponse.plain_language,
        },
      ]);
    } catch (err) {
      const message = userFacingAiError(err, translate);
      setAiError(message);
      setChatMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: message,
          weakEvidence: true,
          isError: true,
        },
      ]);
    } finally {
      setAiLoading(false);
      setAiEvidenceLoading(false);
    }
  }

  function applySuggestedQuestion(question: string) {
    setAiDraftQuery(question);
    void submitAiQuery(question);
  }

  useEffect(() => {
    if (tab !== 'ai') return;
    if (aiDraftQuery.trim()) return;
    if (!standardQuery.trim()) return;

    setAiDraftQuery(standardQuery.trim());
  }, [aiDraftQuery, standardQuery, tab]);

  const MAX_AI_RESULTS = 30;
  const activeResults = aiResult?.relatedEntries?.slice(0, MAX_AI_RESULTS) || [];

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

    if (backendPlainLanguage) return backendPlainLanguage;
    if (groundedAnswer) return groundedAnswer;
    if (!base) return '';

    return getReadableAnswerText(stripSourceMarkupForReadableAnswer(base), aiLanguageMode);
  }, [
    aiLanguageMode,
    aiResult?.relatedEntries,
    aiResult?.synthesis.answer,
    aiResult?.synthesis.explanation,
    aiResult?.synthesis.plain_language?.einfach,
    aiResult?.synthesis.plain_language?.leicht,
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

  const getChatMessageText = useCallback((message: ChatThreadMessage) => {
    if (message.role !== 'assistant' || message.isError || aiLanguageMode === 'standard') {
      return message.content;
    }

    const backendPlainLanguage =
      aiLanguageMode === 'einfach'
        ? message.plainLanguage?.einfach
        : aiLanguageMode === 'leicht'
          ? message.plainLanguage?.leicht
          : '';
    const groundedAnswer =
      (message.relatedEntries?.length || 0) > 0
        ? buildGroundedReadableAnswer(message.relatedEntries || [], aiLanguageMode)
        : '';
    if (backendPlainLanguage) return backendPlainLanguage;
    if (groundedAnswer) return groundedAnswer;

    return getReadableAnswerText(stripSourceMarkupForReadableAnswer(message.content), aiLanguageMode);
  }, [aiLanguageMode]);
  const hasNoStrongAiEvidence = Boolean(
    submittedAiQuery &&
    !aiLoading &&
    !aiEvidenceLoading &&
    aiResult?.synthesis.weak_evidence &&
    (aiResult?.relatedEntries?.length || 0) === 0
  );

  const evidenceSourceLabels = useMemo(() => {
    const labels = new Set<string>();

    for (const entry of aiResult?.relatedEntries || []) {
      const meta = getEntrySourceMeta(entry);
      labels.add(getSourceRoleLabel(meta.sourceRole, locale));
      const tierLabel = getSourceTierLabel(meta.sourceTier, locale);
      if (tierLabel) labels.add(tierLabel);
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
    const fromLocal = ((localLifeEvents as LocalLifeEventsFile).scenarios || []).map((item) => ({
      id: item.id || '',
      label_de: item.label_de || item.id || '',
      label_en: item.label_en || item.label_de || item.id || '',
    }));

    const seen = new Set<string>();
    return [...fromHealth, ...fromLocal]
      .filter((item) => typeof item?.id === 'string' && item.id.trim())
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
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

  const visibleLifeEventOptions = useMemo(() => lifeEventOptions.slice(0, 12), [lifeEventOptions]);
  const selectedLifeEventLabel = useMemo(() => {
    const option = lifeEventOptions.find((item) => item.id === lifeEventContext);
    if (!option) return '';
    return locale === 'en' ? option.label_en || option.label_de : option.label_de;
  }, [lifeEventContext, lifeEventOptions, locale]);

  useEffect(() => {
    if (!lifeEventContext) {
      setLifeEventPanel('overview');
    }
  }, [lifeEventContext]);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="surface-hero mb-6 p-5 md:p-6">
        <h1 className="text-3xl font-semibold tracking-tight">{t('search.hero_title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('search.hero_body')}</p>
      </div>

      <div className="space-y-5">
        <Card className="rounded-3xl border shadow-sm">
                <div className="border-b p-4 md:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Chat
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Jede Antwort wird neu mit passenden Belegen gesucht.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowMoreInformation((value) => !value)}
                      >
                        {showMoreInformation ? t('search.hide_details') : t('search.show_details')}
                      </Button>
                      {showMoreInformation && (
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
                      )}
                      {chatMessages.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setChatMessages([]);
                            setSubmittedAiQuery('');
                            setAiDraftQuery('');
                            setAiResult(null);
                            setAiError(null);
                            setAiLoading(false);
                            setAiEvidenceLoading(false);
                            setLifeEventPanel('overview');
                          }}
                        >
                          Neuer Chat
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 p-4 md:p-5">
                  {chatMessages.length === 0 && !aiLoading && (
                    <div className="overflow-hidden rounded-2xl border border-dashed bg-muted/10 text-sm">
                      <div
                        className={[
                          'flex w-[200%] transition-transform duration-300 ease-out',
                          lifeEventPanel === 'detail' ? '-translate-x-1/2' : 'translate-x-0',
                        ].join(' ')}
                      >
                        <div className="w-1/2 shrink-0 px-4 py-5">
                          <div className="space-y-4">
                            <div>
                              <div className="font-medium text-foreground">{t('search.prompt_ai')}</div>
                              <div className="mt-1 text-muted-foreground">
                                {t('search.life_event_context')}
                              </div>
                            </div>

                            {visibleLifeEventOptions.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {visibleLifeEventOptions.map((item) => {
                                  const label = locale === 'en' ? item.label_en || item.label_de : item.label_de;
                                  const selected = item.id === lifeEventContext;

                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => {
                                        setLifeEventContext(selected ? '' : item.id);
                                        setLifeEventPanel(selected ? 'overview' : 'detail');
                                      }}
                                      className={[
                                        'inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition',
                                        selected
                                          ? 'border-foreground bg-foreground text-background'
                                          : 'border-border bg-background text-foreground hover:bg-muted',
                                      ].join(' ')}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="w-1/2 shrink-0 px-4 py-5">
                          <div className="flex h-full flex-col">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                  {t('search.life_event_context')}
                                </div>
                                <div className="mt-1 text-base font-semibold text-foreground">
                                  {selectedLifeEventLabel || t('search.life_event_none')}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLifeEventPanel('overview')}
                              >
                                {t('entry.back')}
                              </Button>
                            </div>

                            <div className="mt-5 space-y-3">
                              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                {t('search.suggested_questions')}
                              </div>

                              {selectedSuggestedQuestions.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {selectedSuggestedQuestions.map((question) => (
                                    <Button
                                      key={question}
                                      variant="outline"
                                      className="h-auto whitespace-normal text-left"
                                      onClick={() => applySuggestedQuestion(question)}
                                      disabled={chatLimitReached || turnstileMisconfigured || (turnstileEnabled && !turnstileReady)}
                                    >
                                      {question}
                                    </Button>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-xl border border-dashed bg-card px-4 py-3 text-muted-foreground">
                                  {t('search.suggested_questions_desc')}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {chatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={[
                        'flex',
                        message.role === 'user' ? 'justify-end' : 'justify-start',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'max-w-[85%] rounded-2xl border px-4 py-3 text-sm leading-6',
                          message.role === 'user'
                            ? 'bg-foreground text-background'
                            : 'bg-muted/30 text-foreground',
                        ].join(' ')}
                      >
                        <MarkdownText text={getChatMessageText(message)} />
                        {message.role === 'assistant' && typeof message.evidenceCount === 'number' && (
                          <div className="mt-2 text-xs opacity-75">
                            {message.evidenceCount} Belege
                            {message.weakEvidence ? (
                              <>
                                {' '}
                                <GlossaryTerm termId="weak_evidence">
                                  {t('search.status_weak_evidence')}
                                </GlossaryTerm>
                              </>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-2xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        <Spinner />
                      {t('search.working')}
                      </div>
                    </div>
                  )}
                  {chatLimitReached && (
                    <div className="rounded-2xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                      {t('search.chat_limit_notice')}
                    </div>
                  )}
                </div>
                <form
                  className="border-t p-4 md:p-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitAiQuery();
                  }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start">
                    <div className="flex-1">
                      <SearchInput
                        value={aiDraftQuery}
                        onChange={setAiDraftQuery}
                        enableAutocomplete={false}
                        onSubmit={submitAiQuery}
                        placeholder={t('search.chat_followup_placeholder')}
                        disabled={chatLimitReached}
                      />
                    </div>
                    <div className="md:w-36">
                      <Button
                        className="h-11 w-full"
                        type="submit"
                        disabled={
                          aiLoading ||
                          !aiDraftQuery.trim() ||
                          chatLimitReached ||
                          turnstileMisconfigured ||
                          (turnstileEnabled && !turnstileReady)
                        }
                      >
                        {aiLoading ? t('search.working') : t('search.chat_reply')}
                      </Button>
                    </div>
                  </div>
                </form>
              </Card>

            {turnstileEnabled && (
              <div className="surface-panel p-4">
                <TurnstileWidget siteKey={configuredTurnstileSiteKey} onReady={handleTurnstileReady} />
                <div className="text-xs text-muted-foreground">
                  {t('search.bot_protection_note')}
                </div>
              </div>
            )}
            {turnstileMisconfigured && (
              <div className="rounded-xl border border-red-200 bg-red-50/50 px-4 py-3 text-xs text-red-700">
                {t('search.bot_protection_failed')}
              </div>
            )}

            {showMoreInformation && (
            <Card className="surface-panel">
              <div className="surface-hero rounded-b-none border-b p-5 md:p-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <GlossaryTerm termId="helpful_answer">
                        {t('search.ai_synthesis')}
                      </GlossaryTerm>
                    </div>
                    {submittedAiQuery && aiStatusSummary && (
                      <div className="mt-2 text-base font-semibold text-foreground">{aiStatusSummary}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHelpfulAnswer((value) => !value)}
                    >
                      {showHelpfulAnswer ? t('search.hide_details') : t('search.show_details')}
                    </Button>
                  </div>
                </div>

                {showHelpfulAnswer && (
                  <div className="mt-2 text-xs text-muted-foreground">{t('search.answer_mode_note')}</div>
                )}

                {showHelpfulAnswer && submittedAiQuery && aiLanguageMode !== 'standard' && plainLanguageSourceLabel && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {t('search.answer_source_note')}: {plainLanguageSourceLabel}
                  </div>
                )}
              </div>

              {showHelpfulAnswer && (
                <div className="p-5 md:p-6">
                {aiLoading ? (
                  <div className="flex min-h-55 flex-col items-center justify-center gap-3">
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
                    {hasNoStrongAiEvidence ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
                        <div className="text-base font-semibold text-amber-950">
                          {t('search.no_reliable_answer_title')}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-amber-950/85">
                          {t('search.no_reliable_answer_body')}
                        </div>
                        <div className="mt-3 text-sm leading-6 text-amber-950/85">
                          {t('search.no_reliable_answer_next')}
                        </div>
                      </div>
                    ) : submittedAiQuery && aiLanguageMode === 'standard' && (officialLaneAnswer || assistiveLaneAnswer || contactsLaneAnswer) ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border bg-background p-4">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <GlossaryTerm termId="official_baseline">
                              {t('search.answer_lane_official')}
                            </GlossaryTerm>
                          </div>
                          <MarkdownText
                            className="text-base leading-6 text-foreground"
                            text={officialLaneAnswer || t('search.answer_lane_official_empty')}
                          />
                        </div>
                        <div className="rounded-2xl border bg-card p-4">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <GlossaryTerm termId="assistive_support">
                              {t('search.answer_lane_assistive')}
                            </GlossaryTerm>
                          </div>
                          <MarkdownText
                            className="text-base leading-6 text-foreground"
                            text={assistiveLaneAnswer || t('search.answer_lane_assistive_empty')}
                          />
                        </div>
                        <div className="rounded-2xl border bg-card p-4">
                          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <GlossaryTerm termId="direct_contacts">
                              {t('search.answer_lane_contacts')}
                            </GlossaryTerm>
                          </div>
                          <MarkdownText
                            className="text-base leading-6 text-foreground"
                            text={contactsLaneAnswer || t('search.answer_lane_contacts_empty')}
                          />
                          <div className="mt-4">
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              <GlossaryTerm termId="direct_contacts">
                                {t('search.assistive_contacts')}
                              </GlossaryTerm>
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
                      <MarkdownText
                        className="text-base leading-6 text-foreground"
                        text={
                          submittedAiQuery
                            ? displayedAiAnswer || t('search.ready_answer')
                            : aiDraftQuery.trim()
                              ? t('search.ready_answer')
                              : t('search.prompt_ai')
                        }
                      />
                    )}

                    {submittedAiQuery && aiResult?.synthesis.weak_evidence && !hasNoStrongAiEvidence && (
                      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                        <GlossaryTerm termId="weak_evidence">
                          {t('search.status_weak_evidence')}
                        </GlossaryTerm>
                      </div>
                    )}

                    {submittedAiQuery && evidenceSourceLabels.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {evidenceSourceLabels.map((label) => (
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
              )}
            </Card>
            )}

            {showMoreInformation && (
            <div className="space-y-4 pt-2">
              <Card className="surface-panel">
                <div className="space-y-5 p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('search.mode')}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {tab === 'ai' ? t('search.mode_ai_desc') : t('search.mode_article_desc')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border bg-background p-1">
                      <div className="inline-flex items-center gap-1">
                        <Button variant={tab === 'article' ? 'default' : 'ghost'} onClick={() => setTab('article')}>
                          {t('search.mode_article')}
                        </Button>
                        <GlossaryInfoButton label={t('search.mode_article')} termId="article_search" />
                      </div>
                      <div className="inline-flex items-center gap-1">
                        <Button variant={tab === 'ai' ? 'default' : 'ghost'} onClick={() => setTab('ai')}>
                          {t('search.mode_ai')}
                        </Button>
                        <GlossaryInfoButton label={t('search.mode_ai')} termId="ai_guided_search" />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t('search.status_retrieval_mode')}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1">
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
                          <GlossaryInfoButton label={t('search.retrieval_keyword')} termId="direct_search" />
                        </span>
                        <span className="inline-flex items-center gap-1">
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
                          <GlossaryInfoButton label={t('search.retrieval_hybrid')} termId="hybrid_search" />
                        </span>
                        <span className="inline-flex items-center gap-1">
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
                          <GlossaryInfoButton label={t('search.retrieval_official_only')} termId="official_only_sources" />
                        </span>
                      </div>
                    </div>

                  </div>

                  {tab === 'article' && (
                    <div className="space-y-3 border-t pt-5">
                      <SearchInput
                        value={standardQuery}
                        onChange={setStandardQuery}
                        enableAutocomplete
                        placeholder={t('search.article_placeholder')}
                      />
                      <div className="text-xs text-muted-foreground">{t('search.article_helper')}</div>
                      <Card className="rounded-2xl border bg-background shadow-none">
                        <div className="min-h-80 p-4">
                          {standardLoading ? (
                            <div className="flex h-80 flex-col items-center justify-center gap-3">
                              <Spinner />
                              <div className="text-sm text-muted-foreground">{t('common.loading_results')}</div>
                            </div>
                          ) : standardError ? (
                            <div className="flex h-80 items-center justify-center p-6 text-center">
                              <div>
                                <div className="font-medium text-red-600">{t('common.error_title')}</div>
                                <div className="mt-1 text-sm text-muted-foreground">{standardError}</div>
                              </div>
                            </div>
                          ) : standardResults.length === 0 ? (
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
                            <ResultsList results={standardResults} />
                          )}
                        </div>
                      </Card>
                    </div>
                  )}
                </div>
              </Card>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="surface-panel">
                  <div className="p-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <GlossaryTerm termId="evidence_entries">
                        {t('search.evidence_entries')}
                      </GlossaryTerm>
                    </div>
                    <div className="mt-2">
                      {aiEvidenceLoading ? (
                        <div className="flex min-h-45 flex-col items-center justify-center gap-3">
                          <Spinner />
                          <div className="text-sm text-muted-foreground">{t('common.loading_results')}</div>
                        </div>
                      ) : activeResults.length === 0 ? (
                        <div className="rounded-xl border border-dashed bg-card p-6 text-center">
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
                  <Card className="surface-panel">
                    <div className="p-5">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <GlossaryTerm termId="search_focus">
                          {t('search.ai_focus')}
                        </GlossaryTerm>
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
                            <GlossaryTerm termId="matched_topic_profiles">
                              {t('search.matched_topics')}
                            </GlossaryTerm>
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

                  <Card className="surface-panel">
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <GlossaryTerm termId="technical_details">
                              {t('search.technical_details')}
                            </GlossaryTerm>
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
                            <div>
                              <GlossaryTerm termId="answer_service">
                                {t('search.status_sidecar')}
                              </GlossaryTerm>
                              : {aiHealth?.status || t('common.unknown')}
                            </div>
                            <div>
                              <GlossaryTerm termId="provider">
                                {t('search.status_provider')}
                              </GlossaryTerm>
                              : {aiHealth?.provider.provider || 'none'}
                            </div>
                            <div>
                              {t('search.status_configured')}: {statusText(aiHealth?.provider.configured, translate)}
                            </div>
                            <div>
                              {t('search.status_provider_state')}: {aiHealth?.provider.status || t('common.unknown')}
                            </div>
                            <div>
                              <GlossaryTerm termId="bot_protection">
                                {t('search.status_bot_protection')}
                              </GlossaryTerm>
                              :{' '}
                              {statusText((turnstileEnabled && turnstileReady) || turnstileMisconfigured, translate)}
                            </div>
                            <div>
                              <GlossaryTerm termId="retrieval_mode">
                                {t('search.status_retrieval_mode')}
                              </GlossaryTerm>
                              : {aiResult?.synthesis.retrieval?.retrieval_mode || aiHealth?.retrieval?.activeMode || t('common.unknown')}
                            </div>
                            <div>
                              <GlossaryTerm termId="official_filter">
                                {t('search.status_retrieval_filter')}
                              </GlossaryTerm>
                              : {statusText(strictOfficialOnly, translate)}
                            </div>
                            <div>
                              <GlossaryTerm termId="life_event_context">
                                {t('search.status_life_event')}
                              </GlossaryTerm>
                              : {aiResult?.synthesis.retrieval?.selected_life_event || lifeEventContext || t('common.unknown')}
                            </div>
                            <div>
                              <GlossaryTerm termId="external_retrieval">
                                {t('search.status_retrieval_external')}
                              </GlossaryTerm>
                              : {aiResult?.synthesis.retrieval?.external_status || (aiHealth?.retrieval?.externalConfigured ? t('search.status_ready') : t('search.status_loading'))}
                            </div>
                            <div>
                              <GlossaryTerm termId="editorial_review">
                                Redaktionelle Prüfung
                              </GlossaryTerm>
                              :{' '}
                              {statusText(Boolean(aiResult?.synthesis.retrieval?.editorial_review_required), translate)}
                            </div>
                            {(aiResult?.synthesis.retrieval?.editorial_review_reasons || []).length > 0 && (
                              <div>
                                <GlossaryTerm termId="review_notes">
                                  Review-Hinweise
                                </GlossaryTerm>
                                : {(aiResult?.synthesis.retrieval?.editorial_review_reasons || []).join(', ')}
                              </div>
                            )}
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

                </div>
                </div>
            </div>
            )}
      </div>
    </div>
  );
}

