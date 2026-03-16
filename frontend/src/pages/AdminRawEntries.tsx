/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { api, getEntryTitleText, type Entry } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MetadataEnrichmentCard } from '@/components/admin/MetadataEnrichmentCard';
import { PlainLanguageCard } from '@/components/admin/PlainLanguageCard';

function getEntryTitle(entry: Entry) {
  return getEntryTitleText(entry) || getEntryTitleText(entry, 'en') || 'Untitled entry';
}

function getEntrySubtitle(entry: Entry) {
  return [
    entry.domain,
    entry.status,
    entry.updated_at ? new Date(entry.updated_at).toLocaleString() : entry.created_at ? new Date(entry.created_at).toLocaleString() : null,
  ]
    .filter(Boolean)
    .join(' • ');
}

function matchesFilter(value: unknown, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();

  if (value == null) return false;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLowerCase().includes(q);
  }

  if (Array.isArray(value)) {
    return value.some((item) => matchesFilter(item, query));
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => matchesFilter(item, query));
  }

  return false;
}

function renderValue(value: unknown) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return (
      <div className="wrap-break-word text-sm leading-5 text-foreground">
        {String(value)}
      </div>
    );
  }

  return (
    <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto leading-5">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function AdminRawEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const limit = 20;

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .getEntries({
        limit,
        offset: (page - 1) * limit,
        includeTranslations: true,
      })
      .then((res) => {
        if (cancelled) return;
        setEntries(res.entries);
        setTotalPages(res.pages);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load entries');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  const allKeys = useMemo(() => {
    return Array.from(
      entries.reduce((set, entry) => {
        Object.keys(entry).forEach((key) => set.add(key));
        return set;
      }, new Set<string>())
    ).sort();
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!filter.trim()) return entries;
    return entries.filter((entry) => matchesFilter(entry, filter));
  }, [entries, filter]);

  const sortedEntries = useMemo(() => {
    if (!sortKey) return filteredEntries;

    return [...filteredEntries].sort((a, b) => {
      const aVal = a[sortKey as keyof Entry];
      const bVal = b[sortKey as keyof Entry];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }

      const result = String(aVal).localeCompare(String(bVal), undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      return sortAsc ? result : -result;
    });
  }, [filteredEntries, sortKey, sortAsc]);

  useEffect(() => {
    if (sortedEntries.length === 0) {
      setSelectedId(null);
      return;
    }

    const stillExists = sortedEntries.some((entry) => entry.id === selectedId);
    if (!stillExists) {
      setSelectedId(sortedEntries[0].id);
    }
  }, [sortedEntries, selectedId]);

  const selectedEntry = useMemo(
    () => sortedEntries.find((entry) => entry.id === selectedId) ?? null,
    [sortedEntries, selectedId]
  );

  const priorityFields = [
    'id',
    'status',
    'domain',
    'created_at',
    'updated_at',
    'url',
  ];

  const selectedPriorityEntries = selectedEntry
    ? priorityFields
        .filter((key) => key in selectedEntry)
        .map((key) => [key, selectedEntry[key as keyof Entry]] as const)
    : [];

  const selectedOtherEntries = selectedEntry
    ? Object.entries(selectedEntry).filter(([key]) => !priorityFields.includes(key))
    : [];

  function handleEntryUpdated(updatedEntry: Entry) {
    setEntries((current) =>
      current.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry))
    );
  }

  return (
    <div className="mx-auto w-full max-w-400 p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Raw Entries</h1>
          <p className="text-sm text-muted-foreground">
            Browse, inspect, and verify imported entries.
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          {loading ? 'Loading entries…' : `${filteredEntries.length} visible on this page`}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading entries…</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">Error: {error}</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-base font-medium">No entries found</div>
            <div className="mt-1 text-sm text-muted-foreground">
              There is no data for the current page.
            </div>
          </div>
        ) : (
          <div className="grid min-h-[75vh] grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
            {/* Left rail */}
            <aside className="border-r bg-muted/20">
              <div className="sticky top-0 z-10 border-b bg-background/95 p-4 backdrop-blur">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Search all fields…"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  />

                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 flex-1 rounded-md border bg-background px-3 text-sm"
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value)}
                    >
                      {allKeys.map((key) => (
                        <option key={key} value={key}>
                          Sort: {key}
                        </option>
                      ))}
                    </select>

                    <Button
                      variant="outline"
                      onClick={() => setSortAsc((v) => !v)}
                      className="shrink-0"
                    >
                      {sortAsc ? 'Asc' : 'Desc'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="max-h-[calc(75vh-96px)] overflow-y-auto p-2">
                {sortedEntries.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    No results match your filter.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sortedEntries.map((entry) => {
                      const isSelected = selectedEntry?.id === entry.id;

                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(entry.id)}
                            className={[
                              'w-full rounded-xl border p-3 text-left transition',
                              isSelected
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-transparent hover:border-border hover:bg-background',
                            ].join(' ')}
                          >
                            <div className="mb-1 line-clamp-2 text-sm font-medium">
                              {getEntryTitle(entry)}
                            </div>

                            <div className="mb-2 font-mono text-[11px] text-muted-foreground">
                              {entry.id}
                            </div>

                            <div className="line-clamp-2 text-xs text-muted-foreground">
                              {getEntrySubtitle(entry) || 'No metadata'}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between border-t p-3">
                <div className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </aside>

            {/* Detail panel */}
            <main className="min-w-0 bg-background">
              {!selectedEntry ? (
                <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                  Select an entry to inspect it.
                </div>
              ) : (
                <div className="h-full overflow-y-auto">
                  <div className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 backdrop-blur">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold">
                          {getEntryTitle(selectedEntry)}
                        </h2>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">
                          {selectedEntry.id}
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                          {getEntrySubtitle(selectedEntry) || 'No metadata available'}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowRawJson((v) => !v)}
                        >
                          {showRawJson ? 'Hide JSON' : 'Show JSON'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 p-5">
                    <section>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Key fields
                      </h3>
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {selectedPriorityEntries.map(([key, value]) => (
                          <div key={key} className="rounded-xl border p-4">
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {key}
                            </div>
                            {renderValue(value)}
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Full entry fields
                      </h3>
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        {selectedOtherEntries.map(([key, value]) => (
                          <div key={key} className="rounded-xl border p-4">
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {key}
                            </div>
                            {renderValue(value)}
                          </div>
                        ))}
                      </div>
                    </section>

                    <section>
                      <MetadataEnrichmentCard entry={selectedEntry} />
                    </section>

                    <section>
                      <PlainLanguageCard entry={selectedEntry} onEntryUpdated={handleEntryUpdated} />
                    </section>

                    {showRawJson && (
                      <section>
                        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Raw JSON
                        </h3>
                        <pre className="overflow-x-auto rounded-xl bg-zinc-950 p-4 text-xs leading-5 text-zinc-100">
                          {JSON.stringify(selectedEntry, null, 2)}
                        </pre>
                      </section>
                    )}
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </Card>
    </div>
  );
}
