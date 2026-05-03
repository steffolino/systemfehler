import { useEffect, useMemo, useState } from 'react';

import { api, type LifeEventOverride, type LifeEventReviewCase } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type CaseStatusFilter = 'open' | 'resolved' | 'all';

export default function AdminLifeEventReview() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CaseStatusFilter>('open');
  const [cases, setCases] = useState<LifeEventReviewCase[]>([]);
  const [overrides, setOverrides] = useState<LifeEventOverride[]>([]);
  const [lifeEvents, setLifeEvents] = useState<Array<{ id: string; label_de: string }>>([]);
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
    if (!selectedCase || !triggerText.trim() || !targetLifeEvent.trim()) {
      setError('Bitte Trigger-Text und Ziel-Lebenssituation ausfuellen.');
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
            Redaktionelle Nacharbeit fuer semantisch mehrdeutige oder fehlerhafte Zuordnungen.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading ? 'Lade Review-Daten...' : `${cases.length} Faelle · ${activeOverrides.length} aktive Overrides`}
        </div>
      </div>

      {error && <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card>}

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
            <div className="p-3 text-sm text-muted-foreground">Keine Faelle fuer diesen Filter.</div>
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
              <div className="text-sm text-muted-foreground">Waehle links einen Fall aus.</div>
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
                    />
                  </label>

                  <label className="text-sm">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ziel-Lebenssituation</div>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={targetLifeEvent}
                      onChange={(event) => setTargetLifeEvent(event.target.value)}
                    >
                      <option value="">Bitte waehlen</option>
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
                    />
                  </label>

                  <label className="text-sm">
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notiz</div>
                    <input
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={applyOverride} disabled={saving}>
                    {saving ? 'Speichere...' : 'Override anlegen und Fall aufgeloest markieren'}
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-2 text-sm font-semibold">Aktive Overrides</div>
            {activeOverrides.length === 0 ? (
              <div className="text-sm text-muted-foreground">Noch keine aktiven Overrides.</div>
            ) : (
              <div className="space-y-2">
                {activeOverrides.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3">
                    <div className="text-sm font-medium">{item.target_life_event}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Trigger: {item.trigger_text}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Applied: {item.applied_count}</div>
                    <div className="mt-2">
                      <Button variant="outline" size="sm" disabled={saving} onClick={() => disableOverride(item.id)}>
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
