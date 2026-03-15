import { Link } from 'react-router-dom';

import type { Entry } from '../lib/api';

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

interface ResultsListProps {
  results: Entry[];
}

export default function ResultsList({ results }: ResultsListProps) {
  // Get search query from URL
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const query = params.get('search') || '';
  if (!Array.isArray(results) || results.length === 0) return <div className="p-4">No results found.</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {results.map(r => r && r.id ? (
        <Link key={r.id} to={`/entry/${r.id}`} className="block bg-white shadow rounded p-4 hover:bg-gray-50">
          <div className="font-bold text-lg mb-2" dangerouslySetInnerHTML={{ __html: highlightMatch(typeof r.title === 'object' ? r.title?.de || r.title_de || '' : r.title || r.title_de || '', query) }} />
          <div className="text-xs text-gray-500 mb-1">{r.domain || 'Unbekannt'}</div>
          <div className="text-sm text-gray-700 line-clamp-2">{typeof r.summary === 'object' ? r.summary?.de || r.summary_de || '' : r.summary || r.summary_de || ''}</div>
        </Link>
      ) : null)}
    </div>
  );
}
