import React from 'react';
import { Link } from 'react-router-dom';

function highlightMatch(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function ResultCard({ entry }) {
  const title = typeof entry.title === 'object' ? entry.title?.de || entry.title_de || '' : entry.title || entry.title_de || '';
  const summary = typeof entry.summary === 'object' ? entry.summary?.de || entry.summary_de || '' : entry.summary || entry.summary_de || '';
  const category = entry.domain || entry.category || '';
  return (
    <Link to={`/entry/${entry.id}`} className="block bg-white shadow rounded p-4 hover:bg-gray-50">
      <div className="font-bold text-lg mb-2">{title || 'Kein Titel'}</div>
      <div className="text-xs text-gray-500 mb-1">{category || 'Unbekannt'}</div>
      <div className="text-sm text-gray-700 line-clamp-2">{summary || 'Keine Zusammenfassung'}</div>
    </Link>
  );
}

export default function ResultsList({ results, ix }) {
  // Get search query from URL
  const search = window.location.search;
  const params = new URLSearchParams(search);
  const query = params.get('search') || '';
  if (!Array.isArray(results) || results.length === 0) return <div className="p-4">No results found.</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {results.map((r, index) => r && r.id ? (
        <Link name={`${ix}-${index}`} to={`/entry/${r.id}`} className="block bg-white shadow rounded p-4 hover:bg-gray-50">
          <div className="font-bold text-lg mb-2" dangerouslySetInnerHTML={{ __html: highlightMatch(typeof r.title === 'object' ? r.title?.de || r.title_de || '' : r.title || r.title_de || '', query) }} />
          <div className="text-xs text-gray-500 mb-1">{r.domain || r.category || 'Unbekannt'}</div>
          <div className="text-sm text-gray-700 line-clamp-2">{typeof r.summary === 'object' ? r.summary?.de || r.summary_de || '' : r.summary || r.summary_de || ''}</div>
        </Link>
      ) : null)}
    </div>
  );
}
