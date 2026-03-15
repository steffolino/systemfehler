import { useState, useEffect } from 'react';
import { api, type ModerationQueueEntry } from '../../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

function getTextValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function getRecordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function ModerationQueue() {
  const [queue, setQueue] = useState<ModerationQueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getModerationQueue({ status: 'pending' });
      setQueue(response.queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeVariant = (action?: string) => {
    switch (action?.toLowerCase()) {
      case 'create':
        return 'default';
      case 'update':
        return 'secondary';
      case 'delete':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading moderation queue...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Moderation Queue</CardTitle>
          <CardDescription>
            Review pending changes from crawlers before they are published
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending items in the moderation queue.
            </div>
          ) : (
            <div className="space-y-4">
              {queue.map((item) => {
                const itemTitle =
                  typeof item.title === 'string'
                    ? item.title
                    : item.title?.de ?? item.title_de;
                const createdAt = item.createdAt ?? item.created_at;
                const candidateData = item.candidateData ?? item.candidate_data;
                const existingData = item.existingData ?? item.existing_data;
                const diff = getRecordValue(item.diff);
                const added = getRecordValue(diff?.added);
                const modified = getRecordValue(diff?.modified);
                const removed = getRecordValue(diff?.removed);
                const translationEntries = candidateData?.translations
                  ? Object.entries(candidateData.translations as Record<string, Record<string, unknown>>)
                  : [];

                return (
                  <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getActionBadgeVariant(item.action)}>
                          {(item.action ?? 'unknown').toUpperCase()}
                        </Badge>
                        <Badge variant="outline">{item.domain}</Badge>
                        {itemTitle && (
                          <span className="font-medium">{itemTitle}</span>
                        )}
                      </div>
                      {item.url && (
                        <div className="text-sm text-muted-foreground">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {item.url}
                          </a>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Created: {createdAt ? new Date(createdAt).toLocaleString() : 'Unknown'}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedId(expandedId === item.id ? null : item.id)
                      }
                    >
                      {expandedId === item.id ? 'Hide Details' : 'Show Details'}
                    </Button>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === item.id && (
                    <div className="space-y-4 pt-4 border-t">
                      {/* Translations */}
                      {translationEntries.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Translations</h4>
                          <div className="space-y-3">
                            {translationEntries.map(([lang, data]) => (
                              <div key={lang} className="rounded-lg border p-3 bg-muted/40 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold">{lang}</span>
                                  {typeof data.reviewed === 'boolean' && (
                                    <Badge variant={data.reviewed ? 'default' : 'outline'}>
                                      {data.reviewed ? 'Reviewed' : 'Pending Review'}
                                    </Badge>
                                  )}
                                </div>
                                {getTextValue(data.summary) && (
                                  <p className="text-sm text-foreground/80">{getTextValue(data.summary)}</p>
                                )}
                                {getTextValue(data.body) && (
                                  <details className="text-xs">
                                    <summary className="cursor-pointer font-medium">Full Text</summary>
                                    <p className="mt-2 whitespace-pre-wrap">{getTextValue(data.body)}</p>
                                  </details>
                                )}
                                <div className="text-xs text-muted-foreground space-y-1">
                                  {getTextValue(data.method) && <div>Method: {getTextValue(data.method)}</div>}
                                  {getTextValue(data.generator) && <div>Generator: {getTextValue(data.generator)}</div>}
                                  {getTextValue(data.timestamp) && (
                                    <div>Generated: {new Date(getTextValue(data.timestamp) as string).toLocaleString()}</div>
                                  )}
                                  {typeof data.provenance === 'object' && data.provenance && getTextValue((data.provenance as Record<string, unknown>).source) && (
                                    <div>Source: {getTextValue((data.provenance as Record<string, unknown>).source)}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Provenance */}
                      {item.provenance && (
                        <div>
                          <h4 className="font-semibold mb-2">Provenance</h4>
                          <div className="text-sm space-y-1">
                            {item.provenance.source && (
                              <div>
                                <span className="text-muted-foreground">Source:</span>{' '}
                                {item.provenance.source}
                              </div>
                            )}
                            {item.provenance.crawler && (
                              <div>
                                <span className="text-muted-foreground">Crawler:</span>{' '}
                                {item.provenance.crawler}
                              </div>
                            )}
                            {item.provenance.crawlerVersion && (
                              <div>
                                <span className="text-muted-foreground">Crawler Version:</span>{' '}
                                {item.provenance.crawlerVersion}
                              </div>
                            )}
                            {item.provenance.crawledAt && (
                              <div>
                                <span className="text-muted-foreground">Crawled:</span>{' '}
                                {new Date(item.provenance.crawledAt).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Diff */}
                      {diff && (
                        <div>
                          <h4 className="font-semibold mb-2">Changes</h4>
                          <div className="space-y-2">
                            {added && Object.keys(added).length > 0 && (
                              <div>
                                <div className="text-sm font-medium text-green-600">
                                  Added Fields ({Object.keys(added).length})
                                </div>
                                <div className="text-xs bg-green-50 p-2 rounded mt-1 max-h-40 overflow-auto">
                                  <pre>{JSON.stringify(added, null, 2)}</pre>
                                </div>
                              </div>
                            )}
                            {modified && Object.keys(modified).length > 0 && (
                              <div>
                                <div className="text-sm font-medium text-yellow-600">
                                  Modified Fields ({Object.keys(modified).length})
                                </div>
                                <div className="text-xs bg-yellow-50 p-2 rounded mt-1 max-h-40 overflow-auto">
                                  <pre>{JSON.stringify(modified, null, 2)}</pre>
                                </div>
                              </div>
                            )}
                            {removed && Object.keys(removed).length > 0 && (
                              <div>
                                <div className="text-sm font-medium text-red-600">
                                  Removed Fields ({Object.keys(removed).length})
                                </div>
                                <div className="text-xs bg-red-50 p-2 rounded mt-1 max-h-40 overflow-auto">
                                  <pre>{JSON.stringify(removed, null, 2)}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Raw Data */}
                      <details>
                        <summary className="cursor-pointer font-semibold text-sm">
                          Candidate Data (JSON)
                        </summary>
                        <pre className="mt-2 p-4 bg-gray-900 text-gray-100 rounded overflow-x-auto text-xs">
                          {JSON.stringify(candidateData, null, 2)}
                        </pre>
                      </details>

                      {existingData && (
                        <details>
                          <summary className="cursor-pointer font-semibold text-sm">
                            Existing Data (JSON)
                          </summary>
                          <pre className="mt-2 p-4 bg-gray-900 text-gray-100 rounded overflow-x-auto text-xs">
                            {JSON.stringify(existingData, null, 2)}
                          </pre>
                        </details>
                      )}

                      {/* Actions Note */}
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground italic">
                          Note: Moderation approval workflow will be implemented in PR #2.
                          This is a read-only preview for validating data quality.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
