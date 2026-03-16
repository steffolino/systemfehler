import { useEffect, useState } from 'react';

import { api, type AIEnrichmentResponse, type Entry } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function renderChipList(values: string[], variant: 'secondary' | 'outline' = 'outline') {
  if (values.length === 0) {
    return <span className="text-sm text-muted-foreground">None</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Badge key={value} variant={variant}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

export function MetadataEnrichmentCard({
  entry,
  autoLoad = true,
}: {
  entry: Entry;
  autoLoad?: boolean;
}) {
  const [result, setResult] = useState<AIEnrichmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAIEnrichment(entry);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metadata suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResult(null);
    setError(null);
    if (!autoLoad) return;
    void loadSuggestions();
  }, [entry.id, entry.updated_at, entry.updatedAt]);

  const facets = result
    ? [
        ['topics', result.metadata.topics] as const,
        ['tags', result.metadata.tags] as const,
        ['target_groups', result.metadata.target_groups] as const,
        ['keywords', result.metadata.keywords] as const,
      ]
    : [];
  const matchedTopics = Array.isArray(result?.provenance?.matched_topics)
    ? (result?.provenance?.matched_topics as Array<{ id?: string; name?: string }>)
        .filter((topic) => topic && (typeof topic.id === 'string' || typeof topic.name === 'string'))
    : [];

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Metadata Enrichment
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Semi-automatic suggestions for taxonomy, audience labels, and search keywords.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => void loadSuggestions()} disabled={loading}>
          {loading ? 'Refreshing...' : result ? 'Refresh suggestions' : 'Suggest metadata'}
        </Button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Error: {error}</div>}

      {!result && !error && !loading && (
        <div className="mt-4 text-sm text-muted-foreground">
          No suggestions loaded yet.
        </div>
      )}

      {loading && !result && (
        <div className="mt-4 text-sm text-muted-foreground">
          Generating structured metadata suggestions...
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap gap-2">
            {(result.quality_flags.length > 0 ? result.quality_flags : ['metadata_review']).map((flag) => (
              <Badge key={flag} variant="secondary">
                {flag}
              </Badge>
            ))}
          </div>

          {result.summary.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Suggested improvements</div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.summary.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>
          )}

          {matchedTopics.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Matched topic profiles</div>
              <div className="flex flex-wrap gap-2">
                {matchedTopics.map((topic) => {
                  const label = topic.name || topic.id || 'unknown-topic';
                  const key = `${topic.id || label}-${label}`;
                  return (
                    <Badge key={key} variant="secondary">
                      {label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {facets.map(([label, facet]) => (
              <div key={label} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium">{titleCase(label)}</div>
                  <Badge variant="outline">{Math.round(facet.confidence * 100)}%</Badge>
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Current
                    </div>
                    {renderChipList(facet.current)}
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Suggested
                    </div>
                    {renderChipList(facet.suggested)}
                  </div>

                  {facet.added.length > 0 && (
                    <div>
                      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Add
                      </div>
                      {renderChipList(facet.added, 'secondary')}
                    </div>
                  )}

                  <div className="text-xs leading-5 text-muted-foreground">
                    {facet.rationale}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            Provider: {String(result.provenance.provider ?? 'unknown')} | Model:{' '}
            {String(result.provenance.model ?? 'unknown')} | Strategy:{' '}
            {String(result.provenance.strategy ?? 'unknown')}
          </div>
        </div>
      )}
    </Card>
  );
}
