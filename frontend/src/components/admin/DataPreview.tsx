import { Fragment, useState, useEffect } from 'react';
import { api, type Entry } from '../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

const DOMAINS = ['benefits', 'aid', 'tools', 'organizations', 'contacts'];

export function DataPreview() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    loadEntries();
  }, [selectedDomain, page]);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getEntries({
        domain: selectedDomain,
        limit,
        offset: (page - 1) * limit,
        includeTranslations: true,
      });
      setEntries(response.entries);
      setTotalPages(response.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const getQualityColor = (score?: number) => {
    if (!score) return 'text-gray-500';
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Crawled Data Preview</CardTitle>
          <CardDescription>
            View and inspect crawled entries from all domains
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Domain filter tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <Button
              variant={selectedDomain === undefined ? 'default' : 'outline'}
              onClick={() => {
                setSelectedDomain(undefined);
                setPage(1);
              }}
              size="sm"
            >
              All
            </Button>
            {DOMAINS.map((domain) => (
              <Button
                key={domain}
                variant={selectedDomain === domain ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedDomain(domain);
                  setPage(1);
                }}
                size="sm"
              >
                {domain.charAt(0).toUpperCase() + domain.slice(1)}
              </Button>
            ))}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading entries...
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center py-8 text-red-600">
              Error: {error}
            </div>
          )}

          {/* Entries table */}
          {!loading && !error && entries.length > 0 && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">Title</th>
                      <th className="text-left p-2 font-semibold">Domain</th>
                      <th className="text-left p-2 font-semibold">Status</th>
                      <th className="text-left p-2 font-semibold">IQS</th>
                      <th className="text-left p-2 font-semibold">AIS</th>
                      <th className="text-left p-2 font-semibold">Last Seen</th>
                      <th className="text-left p-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <Fragment key={entry.id}>
                        <tr className="border-b hover:bg-muted/50">
                          <td className="p-2">
                            <div className="max-w-md truncate">
                              {entry.title?.de || entry.title_de || 'No title'}
                            </div>
                          </td>
                          <td className="p-2">
                            <Badge variant="outline">{entry.domain}</Badge>
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={entry.status === 'active' ? 'default' : 'secondary'}
                            >
                              {entry.status}
                            </Badge>
                          </td>
                          <td className="p-2">
                            {(() => {
                              const iqsNum = entry.iqs !== undefined && entry.iqs !== null ? Number(entry.iqs) : undefined;
                              return (
                                <span className={getQualityColor(iqsNum)}>
                                  {typeof iqsNum === 'number' && !Number.isNaN(iqsNum) ? iqsNum.toFixed(1) : 'N/A'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-2">
                            {(() => {
                              const aisNum = entry.ais !== undefined && entry.ais !== null ? Number(entry.ais) : undefined;
                              return (
                                <span className={getQualityColor(aisNum)}>
                                  {typeof aisNum === 'number' && !Number.isNaN(aisNum) ? aisNum.toFixed(1) : 'N/A'}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {(entry.lastSeen || entry.last_seen)
                              ? (() => {
                                  const lastSeenValue = entry.lastSeen || entry.last_seen;
                                  return lastSeenValue ? new Date(lastSeenValue).toLocaleDateString() : 'N/A';
                                })()
                              : 'N/A'}
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setExpandedId(expandedId === entry.id ? null : entry.id)
                              }
                            >
                              {expandedId === entry.id ? 'Hide' : 'View'}
                            </Button>
                          </td>
                        </tr>
                        {expandedId === entry.id && (
                          <tr>
                            <td colSpan={7} className="p-4 bg-muted/30">
                              <div className="space-y-2">
                                <div>
                                  <strong>URL:</strong>{' '}
                                  <a
                                    href={entry.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline"
                                  >
                                    {entry.url}
                                  </a>
                                </div>
                                {(entry.summary?.de || entry.summary_de) && (
                                  <div>
                                    <strong>Summary:</strong> {entry.summary?.de || entry.summary_de}
                                  </div>
                                )}
                                {entry.translationLanguages && entry.translationLanguages.length > 0 && (
                                  <div>
                                    <strong>Translations:</strong>{' '}
                                    {entry.translationLanguages.join(', ')}
                                  </div>
                                )}
                                <details>
                                  <summary className="cursor-pointer font-semibold">
                                    Raw JSON
                                  </summary>
                                  <pre className="mt-2 p-4 bg-gray-900 text-gray-100 rounded overflow-x-auto text-xs">
                                    {JSON.stringify(entry, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && entries.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No entries found. Run the crawler to populate data.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
