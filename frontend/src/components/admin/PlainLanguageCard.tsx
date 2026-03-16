import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Entry } from '@/lib/api';
import {
  auditPlainLanguage,
  getReadableEntryText,
  getReadableEntryTranslations,
  type PlainLanguageAudit,
} from '@/lib/plain_language';

function ScoreBadge({ audit }: { audit: PlainLanguageAudit }) {
  const variant = audit.score >= 80 ? 'secondary' : audit.score >= 60 ? 'outline' : 'destructive';
  return <Badge variant={variant as 'secondary' | 'outline' | 'destructive'}>{audit.score}/100</Badge>;
}

function AuditList({ audit }: { audit: PlainLanguageAudit }) {
  return (
    <div className="space-y-2">
      {audit.findings.map((finding, index) => (
        <div
          key={`${audit.mode}-${index}`}
          className={`rounded-lg border px-3 py-2 text-sm ${
            finding.severity === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'bg-muted/30 text-muted-foreground'
          }`}
        >
          {finding.message}
        </div>
      ))}
    </div>
  );
}

export function PlainLanguageCard({ entry }: { entry: Entry }) {
  const translations = getReadableEntryTranslations(entry);
  const einfach = getReadableEntryText(entry, 'einfach');
  const leicht = getReadableEntryText(entry, 'leicht');
  const einfachAudit = auditPlainLanguage(einfach, 'einfach');
  const leichtAudit = auditPlainLanguage(leicht, 'leicht');

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Plain Language Clone</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Automatische Vorschläge für Einfache und Leichte Sprache plus regelbasierte Prüfung.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Einfache Sprache</div>
              <div className="text-xs text-muted-foreground">
                Quelle:{' '}
                {translations['de-EINFACH']?.reviewed
                  ? 'gepruefte Uebersetzung'
                  : translations['de-EINFACH-SUGGESTED']?.generator || 'system'}
              </div>
            </div>
            <ScoreBadge audit={einfachAudit} />
          </div>
          <div className="whitespace-pre-line rounded-xl border bg-background p-3 text-sm leading-6">{einfach}</div>
          <AuditList audit={einfachAudit} />
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Leichte Sprache</div>
              <div className="text-xs text-muted-foreground">
                Quelle:{' '}
                {translations['de-LEICHT']?.reviewed
                  ? 'geprüfte Übersetzung'
                  : translations['de-LEICHT-SUGGESTED']?.generator || 'system'}
              </div>
            </div>
            <ScoreBadge audit={leichtAudit} />
          </div>
          <div className="whitespace-pre-line rounded-xl border bg-background p-3 text-sm leading-6">{leicht}</div>
          <AuditList audit={leichtAudit} />
        </div>
      </div>
    </Card>
  );
}
