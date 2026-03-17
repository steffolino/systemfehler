import { useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, getSourceRoleLabel, type SourceCatalogItem } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

function prettyLabel(value: string) {
  if (!value) return 'unknown';
  return value.replace(/_/g, ' ');
}

function isKnownBadgeValue(value: string | null | undefined) {
  return Boolean(value) && value !== 'unknown' && value !== '-';
}

const DOMAIN_ORDER = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];

export default function SourcesPage() {
  const { locale, t } = useI18n();
  const [sources, setSources] = useState<SourceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US';

  useEffect(() => {
    let cancelled = false;

    api
      .getSourceCatalog()
      .then((items) => {
        if (!cancelled) setSources(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t('common.error_title'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return sources;
    return sources.filter((source) =>
      [source.name, source.host, source.sourceTier, source.institutionType, source.jurisdiction, ...source.domains]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [filter, sources]);

  const groupedByDomain = useMemo(() => {
    const groups = new Map<string, SourceCatalogItem[]>();

    for (const source of filtered) {
      const sourceDomains = source.domains.length > 0 ? source.domains : ['unknown'];
      for (const domain of sourceDomains) {
        const current = groups.get(domain) || [];
        current.push(source);
        groups.set(domain, current);
      }
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        const aIndex = DOMAIN_ORDER.indexOf(a);
        const bIndex = DOMAIN_ORDER.indexOf(b);
        const safeA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
        const safeB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
        if (safeA !== safeB) return safeA - safeB;
        return a.localeCompare(b);
      })
      .map(([domain, items]) => ({
        domain,
        title: t(`sources.domain_${domain}` as never),
        items: items.sort((left, right) => right.entryCount - left.entryCount),
      }));
  }, [filtered, t]);

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="mb-6 rounded-3xl border bg-gradient-to-br from-muted/50 via-background to-emerald-50/60 p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('sources.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{t('sources.subtitle')}</p>
          </div>

          <div className="w-full md:w-80">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('sources.filter')}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
        </div>
      </div>

      <Card className="p-4 md:p-5">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('sources.stats_total')}</div>
            <div className="mt-2 text-2xl font-semibold">{sources.length}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('sources.stats_visible')}</div>
            <div className="mt-2 text-2xl font-semibold">{filtered.length}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('sources.stats_official')}</div>
            <div className="mt-2 text-2xl font-semibold">
              {sources.filter((source) => source.sourceRole === 'official_info').length}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('sources.stats_tools')}</div>
            <div className="mt-2 text-2xl font-semibold">
              {sources.filter((source) => source.sourceRole === 'trusted_tool').length}
            </div>
          </div>
          <div className="rounded-xl border p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('sources.stats_context')}</div>
            <div className="mt-2 text-2xl font-semibold">
              {sources.filter((source) => source.sourceRole === 'context_info').length}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">{t('sources.loading')}</div>
        ) : error ? (
          <div className="p-8 text-sm text-red-600">{error}</div>
        ) : groupedByDomain.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">{t('sources.empty')}</div>
        ) : (
          <div className="space-y-8">
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('sources.jump_to_domain')}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {groupedByDomain.map(({ domain, title, items }) => (
                  <a
                    key={domain}
                    href={`#domain-${domain}`}
                    className="rounded-full border bg-background px-3 py-1 text-sm font-medium hover:border-foreground/30"
                  >
                    {title} ({items.length})
                  </a>
                ))}
              </div>
            </div>

            {groupedByDomain.map(({ domain, title, items }) => (
              <section key={domain} id={`domain-${domain}`} className="space-y-4 scroll-mt-24">
                <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t('sources.group_by_domain')}
                    </div>
                    <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('sources.source_count')}: {items.length} · {t('sources.entries')}: {items.reduce((sum, item) => sum + item.entryCount, 0)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {items.map((source) => (
                    <div key={`${domain}-${source.id}`} className="rounded-2xl border p-4 md:p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="text-lg font-semibold">{source.name}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{source.host}</div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border px-3 py-1">
                              {getSourceRoleLabel(source.sourceRole, locale)}
                            </span>
                            {isKnownBadgeValue(source.sourceTier) && (
                              <span className="rounded-full border px-3 py-1">{prettyLabel(source.sourceTier)}</span>
                            )}
                            {isKnownBadgeValue(source.institutionType) && (
                              <span className="rounded-full border px-3 py-1">{prettyLabel(source.institutionType)}</span>
                            )}
                            {isKnownBadgeValue(source.jurisdiction) && (
                              <span className="rounded-full border px-3 py-1">{source.jurisdiction}</span>
                            )}
                            {source.domains.map((entryDomain) => (
                              <span key={entryDomain} className="rounded-full border px-3 py-1">
                                {t(`sources.domain_${entryDomain}` as never)}
                              </span>
                            ))}
                          </div>
                        </div>

                        {source.sampleUrl && (
                          <Button asChild variant="outline" size="sm">
                            <a href={source.sampleUrl} target="_blank" rel="noopener noreferrer">
                              {t('sources.open')}
                            </a>
                          </Button>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border bg-muted/20 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('sources.entries')}</div>
                          <div className="mt-1 text-lg font-semibold">{source.entryCount}</div>
                        </div>
                        <div className="rounded-xl border bg-muted/20 p-3">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('sources.last_seen')}</div>
                          <div className="mt-1 text-sm font-medium">
                            {source.lastSeen ? new Date(source.lastSeen).toLocaleDateString(dateLocale) : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
