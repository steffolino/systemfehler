import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import SearchInput from '../components/SearchInput';
import ResultsList from '../components/ResultsList';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [standardResults, setStandardResults] = useState([]);
  const [aiResults, setAiResults] = useState([]);
  const [tab, setTab] = useState<'standard' | 'ai'>('standard');

  useEffect(() => {
    if (query) {
      api.getEntries({ search: query }).then(res => setStandardResults(res.entries));
      api.getAIResults({ query }).then(setAiResults);
    } else {
      api.getEntries({}).then(res => setStandardResults(res.entries));
      setAiResults([]);
    }
  }, [query]);

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} />
      <div>
        <button onClick={() => setTab('standard')}>Standard</button>
        <button onClick={() => setTab('ai')}>AI</button>
      </div>
      <ResultsList results={tab === 'standard' ? standardResults : aiResults} />
    </div>
  );
}
