import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, getEntryTitleText, type Entry } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlainLanguageCard } from '@/components/admin/PlainLanguageCard';

type ReviewBucket = 'all' | 'pending' | 'reviewed' | 'rejected';

function getEntryTitle(entry: Entry) {
  return getEntryTitleText(entry) || getEntryTitleText(entry, 'en') || 'Untitled entry';
}

function getTranslationStatuses(entry: Entry) {
  const translations = entry.translations || {};
  const records = [
    translations['de-EINFACH'],
    translations['de-EINFACH-SUGGESTED'],
    translations['de-LEICHT'],
    translations['de-LEICHT-SUGGESTED'],
  ].filter(Boolean);

  const statuses = new Set(records.map((record) => record?.reviewStatus).filter(Boolean));
  const hasSuggested = Boolean(translations['de-EINFACH-SUGGESTED'] || translations['de-LEICHT-SUGGESTED']);
  const hasReviewed = Boolean(translations['de-EINFACH'] || translations['de-LEICHT']);
  const hasRejected = statuses.has('rejected');
  const hasPendingSuggested = [translations['de-EINFACH-SUGGESTED'], translations['de-LEICHT-SUGGESTED']].some(
    (record) => record && record.reviewStatus !== 'rejected'
  );

  return {
    hasSuggested,
    hasReviewed,
    hasRejected,
    hasPendingSuggested,
  };
}

function getBucket(entry: Entry): Exclude<ReviewBucket, 'all'> {
  const state = getTranslationStatuses(entry);
  if (state.hasPendingSuggested) return 'pending';
  if (state.hasReviewed) return 'reviewed';
  return 'rejected';
}

function matchesSearch(entry: Entry, query: string) {
  if (!query.trim()) return true;
  const haystack = [
    getEntryTitle(entry),
    entry.id,
    entry.domain,
    entry.url,
    entry.summary_de,
    entry.summary?.de,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query.trim().toLowerCase());
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </Card>
  );
}

export default function AdminPlainLanguage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState<ReviewBucket>('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .getEntries({ limit: 1000, includeTranslations: true })
      .then((res) => {
        if (cancelled) return;
        const relevantEntries = res.entries.filter((entry) => {
          const state = getTranslationStatuses(entry);
          return state.hasSuggested || state.hasReviewed || state.hasRejected;
        });
        setEntries(relevantEntries);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load plain-language entries');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.total += 1;
        acc[getBucket(entry)] += 1;
        return acc;
      },
      { total: 0, pending: 0, reviewed: 0, rejected: 0 }
    );
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (bucket !== 'all' && getBucket(entry) !== bucket) return false;
      return matchesSearch(entry, search);
    });
  }, [bucket, entries, search]);

  useEffect(() => {
    if (filteredEntries.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!filteredEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedId]);

  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.id === selectedId) ?? null,
    [filteredEntries, selectedId]
  );

  function handleEntryUpdated(updatedEntry: Entry) {
    setEntries((current) => current.map((entry) => (entry.id === updatedEntry.id ? updatedEntry : entry)));
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plain Language Review</h1>
          <p className="text-sm text-muted-foreground">
            Review Einfach and Leicht drafts, approve them, or send them back.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading ? 'Loading review queue...' : `${filteredEntries.length} visible entries`}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CountCard label="Total" value={counts.total} />
        <CountCard label="Pending" value={counts.pending} />
        <CountCard label="Reviewed" value={counts.reviewed} />
        <CountCard label="Rejected" value={counts.rejected} />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading review queue...</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600">Error: {error}</div>
        ) : (
          <div className="grid min-h-[70vh] grid-cols-1 md:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="border-r bg-muted/20">
              <div className="sticky top-0 z-10 border-b bg-background/95 p-4 backdrop-blur">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Search queue..."
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-0"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {(['pending', 'reviewed', 'rejected', 'all'] as ReviewBucket[]).map((value) => (
                      <Button
                        key={value}
                        variant={bucket === value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setBucket(value)}
                      >
                        {value}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="max-h-[calc(70vh-96px)] overflow-y-auto p-2">
                {filteredEntries.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No entries match this queue filter.</div>
                ) : (
                  <ul className="space-y-2">
                    {filteredEntries.map((entry) => {
                      const isSelected = selectedEntry?.id === entry.id;
                      const state = getBucket(entry);
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
                            <div className="mb-1 line-clamp-2 text-sm font-medium">{getEntryTitle(entry)}</div>
                            <div className="mb-2 text-xs text-muted-foreground">{entry.domain}</div>
                            <div className="text-xs text-muted-foreground">
                              Status: <span className="font-medium text-foreground">{state}</span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>

            <main className="min-w-0 bg-background">
              {!selectedEntry ? (
                <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                  Select an entry to review it.
                </div>
              ) : (
                <div className="space-y-4 p-5">
                  <div className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold">{getEntryTitle(selectedEntry)}</h2>
                        <div className="mt-1 font-mono text-xs text-muted-foreground">{selectedEntry.id}</div>
                        <div className="mt-2 text-sm text-muted-foreground">{selectedEntry.url}</div>
                      </div>
                      <Button asChild variant="outline">
                        <Link to={`/admin/raw`}>Open in raw entries</Link>
                      </Button>
                    </div>
                  </div>

                  <PlainLanguageCard entry={selectedEntry} onEntryUpdated={handleEntryUpdated} />
                </div>
              )}
            </main>
          </div>
        )}
      </Card>
    </div>
  );
}
