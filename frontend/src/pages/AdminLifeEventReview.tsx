import { useEffect, useMemo, useState } from 'react';

import { api, type LifeEventOverride, type LifeEventReviewCase } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppAuth } from '@/lib/auth';

type CaseStatusFilter = 'open' | 'resolved' | 'all';

export default function AdminLifeEventReview() {
  const { isDemoReadOnly } = useAppAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CaseStatusFilter>('open');
  const [cases, setCases] = useState<LifeEventReviewCase[]>([]);
  const [overrides, setOverrides] = useState<LifeEventOverride[]>([]);
  const [lifeEvents, setLifeEvents] = useState<Array<{ id: string; label_de: string; tagwords: string[] }>>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [triggerText, setTriggerText] = useState('');
  const [targetLifeEvent, setTargetLifeEvent] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [note, setNote] = useState('');

  async function loadData(currentFilter: CaseStatusFilter) {
    setLoading(true);
    setError(null);

    try {
      const [reviewResponse, health] = await Promise.all([
        api.getLifeEventReview({ status: currentFilter, overrideStatus: 'all', limit: 250 }),
        api.getAIHealth(),
      ]);
      setCases(reviewResponse.cases || []);
      setOverrides(reviewResponse.overrides || []);
      setLifeEvents((health.retrieval?.lifeEvents || []).map((item) => ({
        id: item.id,
        label_de: item.label_de || item.id,
        tagwords: Array.isArray(item.tagwords) ? item.tagwords : [],
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load life-event review data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(statusFilter);
  }, [statusFilter]);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) || null,
    [cases, selectedCaseId]
  );

  useEffect(() => {
    if (!selectedCase && cases.length > 0) {
      setSelectedCaseId(cases[0].id);
      return;
    }
    if (selectedCase && !targetLifeEvent) {
      setTriggerText(selectedCase.query || '');
      const defaultLifeEvent = selectedCase.selected_life_event || selectedCase.detected_stages?.[0] || '';
      setTargetLifeEvent(defaultLifeEvent);
      setNote(selectedCase.editorial_review_reasons?.join(', ') || '');
    }
  }, [cases, selectedCase, targetLifeEvent]);

  async function applyOverride() {
    if (isDemoReadOnly) {
      setError('Demo-Zugang ist read-only. Overrides können hier nur angesehen werden.');
      return;
    }

    if (!selectedCase || !triggerText.trim() || !targetLifeEvent.trim()) {
      setError('Bitte Trigger-Text und Ziel-Lebenssituation ausfüllen.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.createLifeEventOverride({
        action: 'create_override',
        case_id: selectedCase.id,
        trigger_text: triggerText.trim(),
        target_life_event: targetLifeEvent.trim(),
        reviewer: reviewer.trim() || undefined,
        note: note.trim() || undefined,
      });
      await loadData(statusFilter);
      setTargetLifeEvent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override konnte nicht gespeichert werden');
    } finally {
      setSaving(false);
    }
  }

  async function disableOverride(overrideId: string) {
    if (isDemoReadOnly) {
      setError('Demo-Zugang ist read-only. Overrides können hier nur angesehen werden.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.disableLifeEventOverride({
        action: 'disable_override',
        override_id: overrideId,
        reviewer: reviewer.trim() || undefined,
      });
      await loadData(statusFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override konnte nicht deaktiviert werden');
    } finally {
      setSaving(false);
    }
  }

  const activeOverrides = overrides.filter((item) => item.status === 'active');

  return (
    <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Life Event Review</h1>
          <p className="text-sm text-muted-foreground">
            Demo review queue for guided-search phrases that could map to the wrong
            life event. Cases appear here only after ambiguous or low-confidence user
            questions are collected; reviewers can then create routing overrides and
            watch how often those corrections are applied.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading ? 'Lade Review-Daten...' : `${cases.length} Review-Fälle - ${activeOverrides.length} aktive Overrides`}
        </div>
      </div>

      {error && <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card>}
      {isDemoReadOnly && (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Demo-Zugang: read-only. Review-Fälle und Overrides sind sichtbar, aber Änderungen sind deaktiviert.
        </Card>
      )}

      <Card className="mb-4 p-4">
        <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold">Configured Life Events</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                These are the existing guided-search situations loaded from the
                retrieval configuration. They are a curated routing taxonomy for
                welfare-service search, not a scientific life-event scale.
              </p>
              <p>
                The initial list was assembled from common social-benefit,
                counselling, and administrative-procedure use cases, then checked
                against the suggested-query retrieval tests. It is intentionally
                expandable: domain experts can add, split, merge, or rename
                situations as real review feedback shows gaps.
              </p>
              <p>
                Review cases below are only the exception queue for ambiguous or
                incorrect routing; they do not represent the full configured list.
              </p>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {loading ? 'Lade...' : `${lifeEvents.length} Life Events`}
          </div>
        </div>
        {lifeEvents.length === 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Keine Life Events geladen. Das ist ein Daten- oder API-Problem, weil
            diese Liste aus der AI-Health-Konfiguration kommen muss.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {lifeEvents.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <div className="text-sm font-medium">{item.label_de}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.id}</div>
                {item.tagwords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.tagwords.slice(0, 8).map((tagword) => (
                      <span
                        key={tagword}
                        className="inline-flex rounded-full border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                      >
                        {tagword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['open', 'resolved', 'all'] as CaseStatusFilter[]).map((value) => (
            <Button
              key={value}
              variant={statusFilter === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter(value);
                setSelectedCaseId(null);
                setTargetLifeEvent('');
              }}
            >
              {value}
            </Button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="max-h-[72vh] overflow-y-auto p-3">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">Lade...</div>
          ) : cases.length === 0 ? (
            <div className="space-y-2 p-3 text-sm text-muted-foreground">
              <div className="font-medium text-foreground">Keine Review-Fälle für diesen Filter.</div>
              <p>
                Das ist für die Demo okay: Die Queue füllt sich erst, wenn echte
                Such- oder Chatfragen als mehrdeutig, widersprüchlich oder
                niedrig vertrauenswürdig markiert werden.
              </p>
              <p>
                Sobald ein Fall vorhanden ist, kann links eine Frage ausgewählt
                und rechts ein passender Life-Event-Override angelegt werden.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cases.map((item) => {
                const selected = item.id === selectedCaseId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={[
                        'w-full rounded-xl border p-3 text-left',
                        selected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-muted/20',
                      ].join(' ')}
                      onClick={() => {
                        setSelectedCaseId(item.id);
                        setTargetLifeEvent('');
                      }}
                    >
                      <div className="line-clamp-2 text-sm font-medium">{item.query}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        detected: {(item.detected_stages || []).join(', ') || 'none'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        selected: {item.selected_life_event || 'none'} · count: {item.occurrence_count}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        reasons: {(item.editorial_review_reasons || []).join(', ') || 'none'}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            {!selectedCase ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Kein Fall ausgewählt.</div>
                <p>
                  Wenn Review-Fälle vorhanden sind, erscheint hier das Formular
                  zum Korrigieren der Zuordnung: Trigger-Text prüfen,
                  Ziel-Lebenssituation wählen, Notiz erfassen und Override
                  speichern.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Query</div>
                  <div className="mt-1 text-sm">{selectedCase.query}</div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Trigger-Text</div>
                    <textarea
                      className="min-h-24 w-full rounded-md border bg-background px-3 py-2"
                      value={triggerText}
                      onChange={(event) => setTriggerText(event.target.value)}
                      disabled={isDemoReadOnly}
                    />
                  </label>

                  <label className="text-sm">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ziel-Lebenssituation</div>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={targetLifeEvent}
                      onChange={(event) => setTargetLifeEvent(event.target.value)}
                      disabled={isDemoReadOnly}
                    >
                      <option value="">Bitte wählen</option>
                      {lifeEvents.map((item) => (
                        <option key={item.id} value={item.id}>{item.id} - {item.label_de}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Reviewer</div>
                    <input
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={reviewer}
                      onChange={(event) => setReviewer(event.target.value)}
                      disabled={isDemoReadOnly}
                    />
                  </label>

                  <label className="text-sm">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notiz</div>
                    <input
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      disabled={isDemoReadOnly}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={applyOverride} disabled={isDemoReadOnly || saving}>
                    {saving ? 'Speichere...' : 'Override anlegen und Fall aufgeloest markieren'}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold">Aktive Overrides</div>
            {activeOverrides.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Noch keine aktiven Overrides. Angelegte Korrekturen werden hier
                mit Trigger-Text, Ziel-Lebenssituation und Anwendungszähler
                sichtbar.
              </div>
            ) : (
              <div className="space-y-2">
                {activeOverrides.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{item.target_life_event}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Trigger: {item.trigger_text}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Applied: {item.applied_count}</div>
                    <div className="mt-2">
                      <Button variant="outline" size="sm" disabled={isDemoReadOnly || saving} onClick={() => disableOverride(item.id)}>
                        Deaktivieren
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
