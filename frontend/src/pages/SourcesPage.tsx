import { useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, type SourceCatalogItem } from '@/lib/api';

function prettyLabel(value: string) {
  if (!value) return 'unknown';
  return value.replace(/_/g, ' ');
}

export default function SourcesPage() {
  const [sources, setSources] = useState<SourceCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let cancelled = false;

    api
      .getSourceCatalog()
      .then((items) => {
        if (!cancelled) setSources(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load source catalog');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Transparent overview of the organizations and institutions behind the current entries, including source type, jurisdiction, and basic data-quality signals.
          </p>
        </div>

        <div className="w-full md:w-80">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter sources..."
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </div>

      <Card className="p-4 md:p-5">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Sources</div>
            <div className="mt-2 text-2xl font-semibold">{sources.length}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Visible</div>
            <div className="mt-2 text-2xl font-semibold">{filtered.length}</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Official</div>
            <div className="mt-2 text-2xl font-semibold">
              {sources.filter((source) => source.sourceTier === 'tier_1_official').length}
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">NGO / Watchdog</div>
            <div className="mt-2 text-2xl font-semibold">
              {sources.filter((source) => source.sourceTier === 'tier_2_ngo_watchdog').length}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading source catalog...</div>
        ) : error ? (
          <div className="p-8 text-sm text-red-600">Error: {error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-sm text-muted-foreground">No sources match the current filter.</div>
        ) : (
          <div className="space-y-4">
            {filtered.map((source) => (
              <div key={source.id} className="rounded-2xl border p-4 md:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-lg font-semibold">{source.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{source.host}</div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border px-3 py-1">{prettyLabel(source.sourceTier)}</span>
                      <span className="rounded-full border px-3 py-1">{prettyLabel(source.institutionType)}</span>
                      <span className="rounded-full border px-3 py-1">{source.jurisdiction}</span>
                      {source.domains.map((domain) => (
                        <span key={domain} className="rounded-full border px-3 py-1">
                          {domain}
                        </span>
                      ))}
                    </div>
                  </div>

                  {source.sampleUrl && (
                    <Button asChild variant="outline" size="sm">
                      <a href={source.sampleUrl} target="_blank" rel="noopener noreferrer">
                        Open source
                      </a>
                    </Button>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Entries</div>
                    <div className="mt-1 text-lg font-semibold">{source.entryCount}</div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg IQS</div>
                    <div className="mt-1 text-lg font-semibold">
                      {source.avgIqs != null ? source.avgIqs.toFixed(1) : '–'}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg AIS</div>
                    <div className="mt-1 text-lg font-semibold">
                      {source.avgAis != null ? source.avgAis.toFixed(1) : '–'}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest seen</div>
                    <div className="mt-1 text-sm font-medium">
                      {source.lastSeen ? new Date(source.lastSeen).toLocaleDateString() : '–'}
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
