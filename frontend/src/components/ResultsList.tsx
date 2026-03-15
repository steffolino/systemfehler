import type { Entry } from '../lib/api';
import ResultCard from './ResultCard';
import { useI18n } from '@/lib/i18n';

interface ResultsListProps {
  results: Entry[];
}

export default function ResultsList({ results }: ResultsListProps) {
  const { t } = useI18n();

  if (!Array.isArray(results) || results.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">{t('common.no_results_simple')}</div>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
      {results.map((result) => (result && result.id ? <ResultCard key={result.id} result={result} /> : null))}
    </div>
  );
}
