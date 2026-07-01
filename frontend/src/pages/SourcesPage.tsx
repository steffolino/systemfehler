import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { GlossaryTerm } from '@/components/glossary/GlossaryProvider';
import { api, getSourceRoleLabel, getSourceTierLabel, type SourceCatalogItem } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

function isKnownBadgeValue(value: string | null | undefined) {
  return Boolean(value) && value !== 'unknown' && value !== '-';
}

function institutionTypeLabel(value: string, locale: 'de' | 'en') {
  const labels = {
    en: {
      government: 'Government',
      public_service: 'Public service',
      ngo: 'NGO',
      advisory: 'Advisory service',
      media: 'Media',
      journalism: 'Journalism',
      political: 'Political organization',
      research: 'Research',
      research_network: 'Research network',
    },
    de: {
      government: 'Behörde',
      public_service: 'Öffentlicher Dienst',
      ngo: 'NGO',
      advisory: 'Beratung',
      media: 'Medien',
      journalism: 'Journalismus',
      political: 'Politische Organisation',
      research: 'Forschung',
      research_network: 'Forschungsnetzwerk',
    },
  } as const;

  return labels[locale][value as keyof typeof labels.de] || value.replace(/_/g, ' ');
}

function jurisdictionLabel(value: string, locale: 'de' | 'en') {
  if (value === 'DE') return locale === 'de' ? 'Deutschland' : 'Germany';
  if (value === 'EU') return locale === 'de' ? 'Europäische Union' : 'European Union';
  return value;
}

export default function SourcesPage() {
  const { locale, t } = useI18n();
  const [sources, setSources] = useState<SourceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | SourceCatalogItem['sourceRole']>('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [jurisdictionFilter, setJurisdictionFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recommended' | 'entries' | 'name'>('recommended');
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
    const needle = query.trim().toLowerCase();

    const result = sources.filter((source) => {
      const haystack = [
        source.name,
        source.host,
        source.sourceTier,
        source.institutionType,
        source.jurisdiction,
        source.sourceRole,
        ...source.domains,
      ]
        .join(' ')
        .toLowerCase();

      if (needle && !haystack.includes(needle)) return false;
      if (roleFilter !== 'all' && source.sourceRole !== roleFilter) return false;
      if (tierFilter !== 'all' && source.sourceTier !== tierFilter) return false;
      if (jurisdictionFilter !== 'all' && source.jurisdiction !== jurisdictionFilter) return false;
      if (domainFilter !== 'all' && !source.domains.includes(domainFilter)) return false;
      return true;
    });

    return result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'entries') return b.entryCount - a.entryCount || a.name.localeCompare(b.name);
      if (a.sourceRole !== b.sourceRole) {
        const roleOrder: Record<SourceCatalogItem['sourceRole'], number> = {
          official_info: 0,
          trusted_tool: 1,
          context_info: 2,
        };
        const roleSort = roleOrder[a.sourceRole] - roleOrder[b.sourceRole];
        if (roleSort !== 0) return roleSort;
      }
      return b.entryCount - a.entryCount || a.name.localeCompare(b.name);
    });
  }, [domainFilter, jurisdictionFilter, query, roleFilter, sortBy, sources, tierFilter]);

  const filterOptions = useMemo(() => {
    return {
      tiers: Array.from(new Set(sources.map((source) => source.sourceTier).filter(Boolean))).sort(),
      jurisdictions: Array.from(new Set(sources.map((source) => source.jurisdiction).filter(Boolean))).sort(),
      domains: Array.from(new Set(sources.flatMap((source) => source.domains).filter(Boolean))).sort(),
    };
  }, [sources]);

  const sourceRoleOptions = useMemo(
    () => [
      { value: 'official_info', label: t('sources.filter_official_info') },
      { value: 'trusted_tool', label: t('sources.filter_trusted_tool') },
      { value: 'context_info', label: t('sources.filter_context_info') },
    ],
    [t]
  );

  const activeFilters =
    Number(Boolean(query.trim())) +
    Number(roleFilter !== 'all') +
    Number(tierFilter !== 'all') +
    Number(jurisdictionFilter !== 'all') +
    Number(domainFilter !== 'all') +
    Number(sortBy !== 'recommended');

  function resetFilters() {
    setQuery('');
    setRoleFilter('all');
    setTierFilter('all');
    setJurisdictionFilter('all');
    setDomainFilter('all');
    setSortBy('recommended');
  }

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="surface-hero mb-6 p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('sources.title')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{t('sources.subtitle')}</p>
          </div>
        </div>
      </div>

      <Card className="surface-panel mb-5">
        <div className="border-b p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('sources.filter')}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t('sources.filter_description')}
              </div>
            </div>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
            >
              {t('sources.reset_filters')}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="xl:col-span-2">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('sources.filter_search_label')}
              </span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('sources.filter')}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              />
            </label>

            <label>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('sources.filter_role_label')}
              </span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">{t('sources.filter_all_roles')}</option>
                {sourceRoleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('sources.filter_tier_label')}
              </span>
              <select
                value={tierFilter}
                onChange={(event) => setTierFilter(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">{t('sources.filter_all_tiers')}</option>
                {filterOptions.tiers.map((tier) => (
                  <option key={tier} value={tier}>
                    {getSourceTierLabel(tier, locale) || tier.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('sources.filter_jurisdiction_label')}
              </span>
              <select
                value={jurisdictionFilter}
                onChange={(event) => setJurisdictionFilter(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">{t('sources.filter_all_jurisdictions')}</option>
                {filterOptions.jurisdictions.map((jurisdiction) => (
                  <option key={jurisdiction} value={jurisdiction}>
                    {jurisdiction}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('sources.filter_domain_label')}
              </span>
              <select
                value={domainFilter}
                onChange={(event) => setDomainFilter(event.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">{t('sources.filter_all_domains')}</option>
                {filterOptions.domains.map((domain) => (
                  <option key={domain} value={domain}>
                    {domain}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('sources.filter_sort_label')}
              </span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="recommended">{t('sources.sort_recommended')}</option>
                <option value="entries">{t('sources.sort_entries')}</option>
                <option value="name">{t('sources.sort_name')}</option>
              </select>
            </label>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            {t('sources.active_filters', {
              count: activeFilters,
              suffix: activeFilters === 1 ? '' : 's',
            })}
          </div>
        </div>

      </Card>

      <Card className="surface-panel p-4 md:p-5">
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
              {filtered.filter((source) => source.sourceRole === 'official_info').length}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('sources.stats_tools')}</div>
            <div className="mt-2 text-2xl font-semibold">
              {filtered.filter((source) => source.sourceRole === 'trusted_tool').length}
            </div>
          </div>
          <div className="rounded-xl border p-4 md:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{t('sources.stats_context')}</div>
            <div className="mt-2 text-2xl font-semibold">
              {filtered.filter((source) => source.sourceRole === 'context_info').length}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">{t('sources.loading')}</div>
        ) : error ? (
          <div className="p-8 text-sm text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">{t('sources.empty')}</div>
        ) : (
          <div className="space-y-4">
            {filtered.map((source) => (
              <div key={source.id} className="rounded-2xl border bg-card p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold">{source.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{source.host}</div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-3 py-1">
                        <GlossaryTerm termId="source_role">
                          {getSourceRoleLabel(source.sourceRole, locale)}
                        </GlossaryTerm>
                      </span>
                      {isKnownBadgeValue(source.sourceTier) && (
                        <span className="rounded-full border px-3 py-1">
                          <GlossaryTerm termId="source_tier">
                            {getSourceTierLabel(source.sourceTier, locale) || source.sourceTier.replace(/_/g, ' ')}
                          </GlossaryTerm>
                        </span>
                      )}
                      {isKnownBadgeValue(source.institutionType) && (
                        <span className="rounded-full border px-3 py-1">
                          <GlossaryTerm termId="institution_type">
                            {institutionTypeLabel(source.institutionType, locale)}
                          </GlossaryTerm>
                        </span>
                      )}
                      {isKnownBadgeValue(source.jurisdiction) && (
                        <span className="rounded-full border px-3 py-1">
                          <GlossaryTerm termId="jurisdiction">
                            {jurisdictionLabel(source.jurisdiction, locale)}
                          </GlossaryTerm>
                        </span>
                      )}
                      {source.domains.map((entryDomain) => (
                        <span key={entryDomain} className="rounded-full border px-3 py-1">
                          <GlossaryTerm termId="content_domain">
                            {t(`sources.domain_${entryDomain}` as never)}
                          </GlossaryTerm>
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
                  <div className="rounded-xl border bg-card p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('sources.entries')}</div>
                    <div className="mt-1 text-lg font-semibold">{source.entryCount}</div>
                  </div>
                  <div className="rounded-xl border bg-card p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('sources.last_seen')}</div>
                    <div className="mt-1 text-sm font-medium">
                      {source.lastSeen ? new Date(source.lastSeen).toLocaleDateString(dateLocale) : '-'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
