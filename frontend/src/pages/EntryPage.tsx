/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import { api, getEntrySourceMeta } from '../lib/api';
import type { Entry, Provenance } from '../lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const ROLES_CLAIM = 'https://systemfehler/roles';

function getLocalizedText(
  value: unknown,
  fallback?: unknown,
  locale: 'de' | 'en' = 'de'
): string {
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
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (Array.isArray(fallback)) {
    return fallback.filter((item): item is string => typeof item === 'string');
  }

  return [];
}

function scoreValue(value: unknown): string {
  if (value == null || value === '') return '–';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function badgeLabel(value: string) {
  return value.replace(/_/g, ' ');
}

function InfoList({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode }>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-2 wrap-break-word text-sm text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({
  items,
  emptyLabel,
}: {
  items: string[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex rounded-full border bg-background px-3 py-1 text-xs font-medium"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

export default function EntryPage() {
  const { id } = useParams<{ id?: string }>();
  const { user } = useAuth0();

  const roles: string[] = useMemo(() => {
    const raw = user?.[ROLES_CLAIM as keyof typeof user];
    return Array.isArray(raw)
      ? raw.filter((role): role is string => typeof role === 'string')
      : [];
  }, [user]);

  const isAdmin = roles.includes('admin');

  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    const title =
      getLocalizedText(entry.title, entry.title_de, 'de') || 'Kein Titel';

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
    const sourceMeta = getEntrySourceMeta(entry);
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
      sourceMeta,
      iqs,
      ais,
    };
  }, [entry]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-4xl items-center justify-center p-6">
        <div className="text-center">
          <div className="text-base font-medium">Eintrag wird geladen…</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Details und Inhalte werden abgerufen.
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
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link to="/">Zur Suche</Link>
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
          <h1 className="text-xl font-semibold">Eintrag nicht gefunden</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Für diese ID konnte kein Eintrag geladen werden.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link to="/">Zur Suche</Link>
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
  } = viewModel;

  const publicTopics = topics.filter((topic) =>
    ['financial_support', 'employment'].includes(topic)
  );

  return (
    <div className={`mx-auto w-full p-4 md:p-6 ${isAdmin ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/">Zur Suche</Link>
          </Button>

          {url && (
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noopener noreferrer">
                Originalquelle
              </a>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
            Domain: {domain}
          </span>
          <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
            Status: {status}
          </span>
          <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
            Source: {sourceMeta.source}
          </span>
          {sourceMeta.sourceTier !== 'unknown' && (
            <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium">
              Tier: {badgeLabel(sourceMeta.sourceTier)}
            </span>
          )}
          {isAdmin && id && (
            <span className="inline-flex rounded-full border px-3 py-1 font-mono text-xs font-medium">
              ID: {id}
            </span>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {title}
          </h1>
          {!isAdmin && (
            <p className="mt-2 text-sm text-muted-foreground">
              Detailansicht des Eintrags.
            </p>
          )}
        </div>
      </div>

      {isAdmin ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <SectionCard title="Inhalt">
              <div className="whitespace-pre-line text-sm leading-7 text-foreground">
                {content}
              </div>
            </SectionCard>

            <SectionCard title="Themen">
              <ChipList items={topics} emptyLabel="Keine Themen vorhanden." />
            </SectionCard>

            <SectionCard title="Zielgruppen">
              <ChipList
                items={targetGroups}
                emptyLabel="Keine Zielgruppen vorhanden."
              />
            </SectionCard>

            <SectionCard title="Tags">
              <ChipList items={tags} emptyLabel="Keine Tags vorhanden." />
            </SectionCard>
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

            <SectionCard title="Metadaten">
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
            </SectionCard>

            <SectionCard title="Provenienz">
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
            </SectionCard>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <SectionCard title="Inhalt">
            <div className="whitespace-pre-line text-sm leading-7 text-foreground">
              {content}
            </div>
          </SectionCard>

          <SectionCard title="Relevante Themen">
            <ChipList
              items={publicTopics}
              emptyLabel="Keine relevanten Themen vorhanden."
            />
          </SectionCard>

          <SectionCard title="Zielgruppen">
            <ChipList
              items={targetGroups}
              emptyLabel="Keine Zielgruppen vorhanden."
            />
          </SectionCard>

          <SectionCard title="Quelle und Datenqualitaet">
            <InfoList
              items={[
                { label: 'Quelle', value: sourceMeta.source },
                { label: 'Quellentyp', value: badgeLabel(sourceMeta.institutionType) },
                { label: 'Source tier', value: badgeLabel(sourceMeta.sourceTier) },
                { label: 'Jurisdiktion', value: sourceMeta.jurisdiction },
                { label: 'IQS', value: scoreValue(iqs) },
                { label: 'AIS', value: scoreValue(ais) },
              ]}
            />
            <div className="mt-4 text-sm text-muted-foreground">
              Transparenzhinweis: Diese Angaben stammen aus der erfassten Provenienz und den berechneten Qualitaetswerten des Eintrags.
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
