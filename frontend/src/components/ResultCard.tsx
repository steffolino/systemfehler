interface ResultCardProps {
  result: import('../lib/api').Entry;
}

export default function ResultCard({ result }: ResultCardProps) {
  // Normalize title and summary
  const title = typeof result.title === 'object' ? result.title?.de || result.title_de || '' : result.title || result.title_de || '';
  const summary = typeof result.summary === 'object' ? result.summary?.de || result.summary_de || '' : result.summary || result.summary_de || '';
  return (
    <div className="bg-white rounded shadow p-4">
      <div className="font-bold text-lg mb-2">{title || 'Kein Titel'}</div>
      <div className="text-sm text-gray-700 mb-2">{summary || 'Keine Zusammenfassung'}</div>
      {result.deadline && (
        <div className="mb-2">
          <span className="font-semibold">Deadline:</span> {result.deadline}
        </div>
      )}
    </div>
  );
}
