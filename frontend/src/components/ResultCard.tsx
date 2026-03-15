import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getEntrySourceMeta, getEntryTitleText, type Entry } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

function getSummary(entry: Entry) {
  if (typeof entry.summary === 'object' && entry.summary?.de) return entry.summary.de;
  if (typeof entry.summary === 'string') return entry.summary;
  return entry.summary_de || '';
}

function qualityTone(score: number | null) {
  if (score == null) return 'text-muted-foreground';
  if (score >= 80) return 'text-emerald-700';
  if (score >= 60) return 'text-amber-700';
  return 'text-rose-700';
}

function tierLabel(value: string) {
  switch (value) {
    case 'tier_1_official':
      return 'Official';
    case 'tier_2_ngo_watchdog':
      return 'NGO';
    case 'tier_3_press':
      return 'Press';
    case 'tier_4_academic':
      return 'Academic';
    default:
      return 'Source';
  }
}

function isKnownBadgeValue(value: string | null | undefined) {
  return Boolean(value) && value !== 'unknown' && value !== '-';
}

export default function ResultCard({ result }: { result: Entry }) {
  const { locale, t } = useI18n();
  const title = getEntryTitleText(result) || 'Kein Titel';
  const summary = getSummary(result) || t('entry.no_description');
  const meta = getEntrySourceMeta(result);
  const iqs =
    result.iqs != null
      ? Number(result.iqs)
      : result.qualityScores?.iqs != null
        ? Number(result.qualityScores.iqs)
        : null;
  const ais =
    result.ais != null
      ? Number(result.ais)
      : result.qualityScores?.ais != null
        ? Number(result.qualityScores.ais)
        : null;
  const lastSeen = result.lastSeen || result.last_seen || result.updatedAt || result.updated_at || null;
  const dateLocale = locale === 'de' ? 'de-DE' : 'en-US';

  return (
    <Link to={`/entry/${result.id}`} className="block">
      <Card className="h-full border-border/70 bg-gradient-to-b from-background to-muted/10 transition hover:border-foreground/20 hover:shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{result.domain || 'unknown'}</Badge>
            {isKnownBadgeValue(meta.sourceTier) && <Badge variant="outline">{tierLabel(meta.sourceTier)}</Badge>}
            {isKnownBadgeValue(meta.jurisdiction) && <Badge variant="outline">{meta.jurisdiction}</Badge>}
          </div>

          <div className="space-y-2">
            <div className="text-lg font-semibold leading-tight text-foreground">{title}</div>
            <div className="line-clamp-3 text-sm leading-6 text-muted-foreground">{summary}</div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('entry.field_source')}</div>
              <div className="font-medium text-foreground">{meta.source}</div>
              {isKnownBadgeValue(meta.institutionType) && (
                <div className="text-xs text-muted-foreground">{meta.institutionType.replace(/_/g, ' ')}</div>
              )}
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('entry.source_quality')}</div>
              <div className="flex gap-3">
                <span className={qualityTone(iqs)}>IQS {iqs != null ? iqs.toFixed(0) : '-'}</span>
                <span className={qualityTone(ais)}>AIS {ais != null ? ais.toFixed(0) : '-'}</span>
              </div>
            </div>
          </div>

          {lastSeen && (
            <div className="text-xs text-muted-foreground">
              {t('sources.last_seen')} {new Date(lastSeen).toLocaleDateString(dateLocale)}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
