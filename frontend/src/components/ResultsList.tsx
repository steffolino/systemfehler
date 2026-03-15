import type { Entry } from '../lib/api';
import ResultCard from './ResultCard';

interface ResultsListProps {
  results: Entry[];
}

export default function ResultsList({ results }: ResultsListProps) {
  if (!Array.isArray(results) || results.length === 0) return <div className="p-4">No results found.</div>;
  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
      {results.map((result) => (result && result.id ? <ResultCard key={result.id} result={result} /> : null))}
    </div>
  );
}
