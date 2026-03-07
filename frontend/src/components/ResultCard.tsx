import React from 'react';

export default function ResultCard({ result }) {
  return (
    <div className="bg-white rounded shadow p-4">
      <div className="font-bold text-lg mb-2">{result.title}</div>
      <div className="text-xs text-gray-500 mb-1">{result.category}</div>
      <div className="text-sm text-gray-700 mb-2">{result.summary}</div>
      {result.links && (
        <div className="mb-2">
          <span className="font-semibold">Links:</span>
          <ul className="list-disc ml-6">
            {result.links.map(link => (
              <li key={link.url}><a href={link.url} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">{link.label || link.url}</a></li>
            ))}
          </ul>
        </div>
      )}
      {result.laws && (
        <div className="mb-2">
          <span className="font-semibold">Laws:</span>
          <ul className="list-disc ml-6">
            {result.laws.map(law => (
              <li key={law.id}>{law.title}</li>
            ))}
          </ul>
        </div>
      )}
      {result.deadlines && (
        <div className="mb-2">
          <span className="font-semibold">Deadlines:</span>
          <ul className="list-disc ml-6">
            {result.deadlines.map(dl => (
              <li key={dl.id}>{dl.label}: {dl.date}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
