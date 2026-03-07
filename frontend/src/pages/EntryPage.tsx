import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
// import ResultCard from '../components/ResultCard';
import { api } from '../lib/api';

export default function EntryPage() {
  const { id } = useParams();
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getEntry(id).then(setResult);
  }, [id]);

  if (!result) return <div className="p-4">Loading...</div>;
  const entry = result.entry || result;
  const title = typeof entry.title === 'object' ? entry.title?.de || entry.title_de || '' : entry.title || entry.title_de || '';
  const content = typeof entry.content === 'object' ? entry.content?.de || entry.content_de || '' : entry.content || entry.content_de || '';
  const url = entry.url || '';
  const domain = entry.domain || '';
  const topics = entry.topics || [];
  const tags = entry.tags || [];
  const targetGroups = entry.targetGroups || entry.target_groups || [];
  const status = entry.status || '';
  const provenance = entry.provenance || {};
  const qualityScores = entry.qualityScores || entry.quality_scores || {};
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-2">{title || 'Kein Titel'}</h1>
      <div className="mb-2 text-xs text-gray-500">Domain: {domain} | Status: {status}</div>
      <div className="mb-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Zur Originalquelle</a>
      </div>
      <div className="mb-4">
        <strong>Inhalt:</strong>
        <div className="whitespace-pre-line text-sm mt-1">{content || 'Keine Beschreibung verfügbar.'}</div>
      </div>
      <div className="mb-2">
        <strong>Themen:</strong> {topics.length ? topics.join(', ') : 'Keine'}
      </div>
      <div className="mb-2">
        <strong>Tags:</strong> {tags.length ? tags.join(', ') : 'Keine'}
      </div>
      <div className="mb-2">
        <strong>Zielgruppen:</strong> {targetGroups.length ? targetGroups.join(', ') : 'Keine'}
      </div>
      <div className="mb-2">
        <strong>Qualitätswerte:</strong> IQS: {qualityScores.iqs || entry.iqs || '-'} | AIS: {qualityScores.ais || entry.ais || '-'}
      </div>
      <div className="mb-2">
        <strong>Provenienz:</strong>
        <ul className="text-xs text-gray-600">
          <li>Quelle: {provenance.source || '-'}</li>
          <li>Crawler: {provenance.crawler || '-'}</li>
          <li>Crawl-ID: {provenance.crawlId || '-'}</li>
          <li>Checksum: {provenance.checksum || '-'}</li>
          <li>Gecrawlt am: {provenance.crawledAt ? new Date(provenance.crawledAt).toLocaleString() : '-'}</li>
        </ul>
      </div>
    </div>
  );
}
