/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { api, getEntrySourceMeta } from '../lib/api';
import type { Entry, Provenance } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { useAppAuth } from '@/lib/auth';
import {
  getModeLabel,
  getReadableEntryText,
  getReadableEntryTranslations,
  type LanguageMode,
} from '@/lib/plain_language';

const ROLES_CLAIM = 'https://systemfehler/roles';

function getLocalizedText(value: unknown, fallback?: unknown, locale: 'de' | 'en' = 'de'): string {
  if (typeof value === 'string') return value;

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record[locale] === 'string') return record[locale] as string;
    if (typeof record.de === 'string') return record.de as string;
    if (typeof record.en === 'string') return record.en as string;
  }

  if (typeof fallback === 'string') return fallback;
  return '';
}

function getArrayValue(value: unknown, fallback?: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (Array.isArray(fallback)) return fallback.filter((item): item is string => typeof item === 'string');
  return [];
}

function scoreValue(value: unknown): string {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function badgeLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function isKnownBadgeValue(value: string | null | undefined) {
  return Boolean(value) && value !== 'unknown' && value !== '-';
}

function InfoList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-2 break-words text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium">
          {item}
        </span>
      ))}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default function EntryPage() {
  const { id } = useParams<{ id?: string }>();
  const { user } = useAppAuth();
  const { locale, t } = useI18n();
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US';

  const roles: string[] = useMemo(() => {
    const raw = user?.[ROLES_CLAIM as keyof typeof user];
    return Array.isArray(raw) ? raw.filter((role): role is string => typeof role === 'string') : [];
  }, [user]);

  const isAdmin = roles.includes('admin');

  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [languageMode, setLanguageMode] = useState<LanguageMode>('standard');

  useEffect(() => {
    if (!id) {
      setEntry(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getEntry(id)
      .then((res) => {
        if (!cancelled) setEntry(res.entry ?? null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('entry.error_title'));
          setEntry(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const viewModel = useMemo(() => {
    if (!entry) return null;

    const title = getLocalizedText(entry.title, entry.title_de, locale) || 'Kein Titel';
    const standardContent = getLocalizedText(entry.content, entry.content_de, locale) || t('entry.no_description');
    const url = entry.url || '';
    const domain = entry.domain || '-';
    const status = entry.status || '-';
    const topics = getArrayValue(entry.topics);
    const tags = getArrayValue(entry.tags);
    const targetGroups = getArrayValue(entry.targetGroups, entry.target_groups);
    const provenance: Provenance | null = entry.provenance ?? null;
    const sourceMeta = getEntrySourceMeta(entry);
    const qualityScores = entry.qualityScores || entry.quality_scores || {};
    const iqs = qualityScores.iqs ?? entry.iqs ?? null;
    const ais = qualityScores.ais ?? entry.ais ?? null;
    const readableTranslations = getReadableEntryTranslations(entry);
    const generatedReadableContent = getReadableEntryText(entry, languageMode).trim();
    const content =
      languageMode === 'standard' ? standardContent : generatedReadableContent || standardContent;
    const usingGeneratedMode =
      languageMode !== 'standard' &&
      Boolean(generatedReadableContent) &&
      !readableTranslations['de-LEICHT']?.reviewed;

    return {
      title,
      content,
      url,
      domain,
      status,
      topics,
      tags,
      targetGroups,
      provenance,
      sourceMeta,
      iqs,
      ais,
      usingGeneratedMode,
    };
  }, [entry, languageMode, locale, t]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-4xl items-center justify-center p-6">
        <div className="text-center">
          <div className="text-base font-medium">{t('entry.loading_title')}</div>
          <div className="mt-1 text-sm text-muted-foreground">{t('entry.loading_body')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">{t('entry.error_title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link to="/">{t('entry.back')}</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!viewModel) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">{t('entry.not_found_title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('entry.not_found_body')}</p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link to="/">{t('entry.back')}</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const {
    title,
    content,
    url,
    domain,
    status,
    topics,
    tags,
    targetGroups,
    provenance,
    sourceMeta,
    iqs,
    ais,
    usingGeneratedMode,
  } = viewModel;
  const publicTopics = topics.filter((topic) => ['financial_support', 'employment'].includes(topic));

  return (
    <div className={`mx-auto w-full p-4 md:p-6 ${isAdmin ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <div className="mb-6 rounded-3xl border bg-gradient-to-br from-muted/40 via-background to-background p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/">{t('entry.back')}</Link>
            </Button>

            {url && (
              <Button asChild variant="outline" size="sm">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {t('entry.original_source')}
                </a>
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
              {t('entry.field_domain')}: {domain}
            </span>
            <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
              {t('entry.field_status')}: {status}
            </span>
            <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
              {t('entry.field_source')}: {sourceMeta.source}
            </span>
            {!isAdmin && isKnownBadgeValue(sourceMeta.jurisdiction) && (
              <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
                {t('entry.field_jurisdiction')}: {sourceMeta.jurisdiction}
              </span>
            )}
            {isAdmin && id && (
              <span className="inline-flex rounded-full border px-3 py-1 font-mono text-xs font-medium">
                ID: {id}
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {isAdmin ? t('app.admin_workspace') : t('entry.detail_view')}
            </p>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <SectionCard title={t('entry.admin_content')}>
              <div className="whitespace-pre-line text-sm leading-7 text-foreground">{content}</div>
            </SectionCard>

            <SectionCard title={t('entry.admin_topics')}>
              <ChipList items={topics} emptyLabel={t('entry.empty_topics')} />
            </SectionCard>

            <SectionCard title={t('entry.admin_targets')}>
              <ChipList items={targetGroups} emptyLabel={t('entry.empty_target_groups')} />
            </SectionCard>

            <SectionCard title={t('entry.admin_tags')}>
              <ChipList items={tags} emptyLabel={t('entry.empty_tags')} />
            </SectionCard>
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('entry.admin_scores')}</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">IQS</div>
                  <div className="mt-2 text-lg font-semibold">{scoreValue(iqs)}</div>
                </div>
                <div className="rounded-xl border p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AIS</div>
                  <div className="mt-2 text-lg font-semibold">{scoreValue(ais)}</div>
                </div>
              </div>
            </Card>

            <SectionCard title={t('entry.admin_metadata')}>
              <InfoList
                items={[
                  { label: t('entry.field_domain'), value: domain },
                  { label: t('entry.field_status'), value: status },
                  { label: t('entry.field_source'), value: provenance?.source || '-' },
                  { label: t('entry.field_crawler'), value: provenance?.generator || provenance?.method || '-' },
                ]}
              />
            </SectionCard>

            <SectionCard title={t('entry.admin_provenance')}>
              <InfoList
                items={[
                  { label: t('entry.field_crawl_id'), value: provenance?.crawlId || '-' },
                  { label: t('entry.field_checksum'), value: provenance?.checksum || '-' },
                  {
                    label: t('entry.field_crawled_at'),
                    value: provenance?.crawledAt ? new Date(provenance.crawledAt).toLocaleString(dateLocale) : '-',
                  },
                  {
                    label: 'Veröffentlicht',
                    value: provenance?.publishedAt
                      ? new Date(provenance.publishedAt).toLocaleString()
                      : '–',
                  },
                  {
                    label: 'Aktualisiert',
                    value: provenance?.modifiedAt
                      ? new Date(provenance.modifiedAt).toLocaleString()
                      : '–',
                  },
                  {
                    label: 'Inhaltstyp',
                    value: provenance?.contentType || '–',
                  },
                ]}
              />
            </SectionCard>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard title={t('entry.public_summary')}>
            <p className="mb-4 text-sm text-muted-foreground">{t('entry.public_summary_body')}</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {(['standard', 'einfach', 'leicht'] as LanguageMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setLanguageMode(mode)}
                  className={[
                    'inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    languageMode === mode
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-background text-foreground hover:bg-muted',
                  ].join(' ')}
                >
                  {t(`entry.mode_${mode}` as const)}
                </button>
              ))}
            </div>
            {languageMode !== 'standard' && (
              <div className="mb-4 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">
                  {t('entry.reading_mode_active', { mode: getModeLabel(languageMode) })}
                </div>
                <div className="mt-1">
                  {usingGeneratedMode ? t('entry.generated_language_note') : t('entry.reviewed_language_note')}
                </div>
              </div>
            )}
            <div className="whitespace-pre-line text-sm leading-7 text-foreground">{content}</div>
          </SectionCard>

          <SectionCard title={t('entry.relevant_topics')}>
            <ChipList items={publicTopics} emptyLabel={t('entry.empty_topics')} />
          </SectionCard>

          <SectionCard title={t('entry.target_groups')}>
            <ChipList items={targetGroups} emptyLabel={t('entry.empty_target_groups')} />
          </SectionCard>

          <SectionCard title={t('entry.source_quality')}>
            <p className="mb-4 text-sm text-muted-foreground">{t('entry.public_source_note')}</p>
            <InfoList
              items={[
                { label: t('entry.field_source'), value: sourceMeta.source },
                ...(isKnownBadgeValue(sourceMeta.institutionType)
                  ? [{ label: t('entry.field_source_type'), value: badgeLabel(sourceMeta.institutionType) }]
                  : []),
                ...(isKnownBadgeValue(sourceMeta.sourceTier)
                  ? [{ label: t('entry.field_source_tier'), value: badgeLabel(sourceMeta.sourceTier) }]
                  : []),
                ...(isKnownBadgeValue(sourceMeta.jurisdiction)
                  ? [{ label: t('entry.field_jurisdiction'), value: sourceMeta.jurisdiction }]
                  : []),
                { label: 'IQS', value: scoreValue(iqs) },
                { label: 'AIS', value: scoreValue(ais) },
              ]}
            />
            <div className="mt-4 text-sm text-muted-foreground">{t('entry.transparency_note')}</div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
