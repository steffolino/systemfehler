import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';

import type { MultilingualText } from '../lib/api';

interface AutocompleteSuggestion {
  id: string;
  title: string | MultilingualText;
  category: string;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  navbar?: boolean;
  placeholder?: string;
  enableAutocomplete?: boolean;
  onSubmit?: () => void;
}

export default function SearchInput({
  value,
  onChange,
  navbar,
  placeholder = 'Search...',
  enableAutocomplete = true,
  onSubmit,
}: SearchInputProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    if (enableAutocomplete && value && value.length > 1) {
      api.autocomplete({ query: value, limit: 10 }).then((results) => {
        if (!cancelled) {
          // Normalize title to string for display
          setSuggestions(results.map((s: AutocompleteSuggestion) => ({
            ...s,
            title: typeof s.title === 'object' ? s.title.de || '' : s.title
          })));
        }
      });
    } else {
      // Defer setSuggestions to avoid synchronous state update in effect
      Promise.resolve().then(() => setSuggestions([]));
    }
    return () => { cancelled = true; };
  }, [enableAutocomplete, value]);

  function highlightMatch(text: string, query: string): string {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  return (
    <div className="relative">
      <Input
        className={`w-full ${navbar ? 'bg-muted' : ''}`}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {enableAutocomplete && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 bg-background border mt-1 z-10 rounded shadow">
          {suggestions.map(s => (
            <li key={s.id} className="px-3 py-2 flex justify-between cursor-pointer hover:bg-muted"
                onClick={() => navigate(`/entry/${s.id}`)}>
              <span dangerouslySetInnerHTML={{ __html: highlightMatch(typeof s.title === 'object' ? s.title.de || '' : s.title, value) }} />
              <span className="text-xs text-muted-foreground">{s.category}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
