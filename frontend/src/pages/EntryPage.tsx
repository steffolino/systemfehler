import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import type { Entry, Provenance } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function getLocalizedText(
  value: unknown,
  fallback?: unknown,
  locale: 'de' | 'en' = 'de'
): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record[locale] === 'string') return record[locale] as string;
    if (typeof record.en === 'string') return record.en as string;
    if (typeof record.de === 'string') return record.de as string;
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
  if (value == null || value === '') return '–';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return String(value);
}

function InfoList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-2 text-sm text-foreground break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex rounded-full border px-3 py-1 text-xs font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

export default function EntryPage() {
  const { id } = useParams<{ id?: string }>();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setEntry(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .getEntry(id)
      .then((res) => {
        if (cancelled) return;
        setEntry(res.entry ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load entry');
        setEntry(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const viewModel = useMemo(() => {
    if (!entry) return null;

    const title = getLocalizedText(entry.title, entry.title_de, 'de') || 'Kein Titel';
    const content =
      getLocalizedText(entry.content, entry.content_de, 'de') ||
      'Keine Beschreibung verfügbar.';

    const url = entry.url || '';
    const domain = entry.domain || '–';
    const status = entry.status || '–';

    const topics = getArrayValue(entry.topics);
    const tags = getArrayValue(entry.tags);
    const targetGroups = getArrayValue(entry.targetGroups, entry.target_groups);

    const provenance: Provenance | null = entry.provenance ?? null;
    const qualityScores = entry.qualityScores || entry.quality_scores || {};

    const iqs = qualityScores.iqs ?? entry.iqs ?? null;
    const ais = qualityScores.ais ?? entry.ais ?? null;

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
      iqs,
      ais,
      entry,
    };
  }, [entry]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-5xl items-center justify-center p-6">
        <div className="text-center">
          <div className="text-base font-medium">Eintrag wird geladen…</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Details, Metadaten und Provenienz werden abgerufen.
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Fehler beim Laden</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (!viewModel) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Eintrag nicht gefunden</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Für diese ID konnte kein Eintrag geladen werden.
          </p>
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
    iqs,
    ais,
  } = viewModel;

  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
            Domain: {domain}
          </span>
          <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
            Status: {status}
          </span>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            {id && (
              <div className="mt-2 font-mono text-xs text-muted-foreground">
                ID: {id}
              </div>
            )}
          </div>

          {url && (
            <div className="shrink-0">
              <Button asChild variant="outline">
                <a href={url} target="_blank" rel="noopener noreferrer">
                  Zur Originalquelle
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card className="p-5 md:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Inhalt
            </h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-7 text-foreground">
              {content}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Themen
            </h2>
            <div className="mt-4">
              <ChipList items={topics} emptyLabel="Keine Themen vorhanden." />
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </h2>
            <div className="mt-4">
              <ChipList items={tags} emptyLabel="Keine Tags vorhanden." />
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Zielgruppen
            </h2>
            <div className="mt-4">
              <ChipList items={targetGroups} emptyLabel="Keine Zielgruppen vorhanden." />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Qualitätswerte
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  IQS
                </div>
                <div className="mt-2 text-lg font-semibold">{scoreValue(iqs)}</div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  AIS
                </div>
                <div className="mt-2 text-lg font-semibold">{scoreValue(ais)}</div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Metadaten
            </h2>

            <div className="mt-4">
              <InfoList
                items={[
                  { label: 'Domain', value: domain },
                  { label: 'Status', value: status },
                  { label: 'Quelle', value: provenance?.source || '–' },
                  {
                    label: 'Crawler / Methode',
                    value: provenance?.generator || provenance?.method || '–',
                  },
                ]}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Provenienz
            </h2>

            <div className="mt-4">
              <InfoList
                items={[
                  { label: 'Crawl-ID', value: provenance?.crawlId || '–' },
                  { label: 'Checksum', value: provenance?.checksum || '–' },
                  {
                    label: 'Gecrawlt am',
                    value: provenance?.crawledAt
                      ? new Date(provenance.crawledAt).toLocaleString()
                      : '–',
                  },
                ]}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
