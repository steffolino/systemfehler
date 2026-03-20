import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

import { api } from '../lib/api';
import type { MultilingualText } from '../lib/api';
import { Input } from '@/components/ui/input';

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    if (enableAutocomplete && value.trim().length > 1) {
      api.autocomplete({ query: value, limit: 8 }).then((results) => {
        if (!cancelled) {
          setSuggestions(
            results.map((s: AutocompleteSuggestion) => ({
              ...s,
              title: typeof s.title === 'object' ? s.title.de || '' : s.title,
            }))
          );
        }
      });
    } else {
      Promise.resolve().then(() => {
        if (!cancelled) setSuggestions([]);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [enableAutocomplete, value]);

  const showSuggestions = enableAutocomplete && isFocused && suggestions.length > 0;

  const normalizedSuggestions = useMemo(
    () =>
      suggestions.map((s) => ({
        ...s,
        title: typeof s.title === 'object' ? s.title.de || '' : s.title,
      })),
    [suggestions]
  );

  function highlightMatch(text: string, query: string): string {
    if (!query.trim()) return text;
    const escaped = escapeRegExp(query.trim());
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark class="bg-transparent font-semibold text-foreground">$1</mark>');
  }

  return (
    <div className="relative">
      <div
        className={[
          'relative rounded-2xl transition',
          navbar
            ? 'bg-muted'
            : 'bg-background shadow-sm ring-1 ring-border focus-within:ring-2 focus-within:ring-foreground/20',
        ].join(' ')}
      >
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className={[
            'h-12 border-0 bg-transparent pl-11 pr-4 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            navbar ? 'bg-muted' : '',
          ].join(' ')}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
        />
      </div>

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border bg-background shadow-lg">
          <div className="border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Vorschläge
          </div>

          <ul className="max-h-80 overflow-auto py-2">
            {normalizedSuggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-muted/50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => navigate(`/entry/${suggestion.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className="line-clamp-2 text-sm font-medium leading-5 text-foreground"
                      dangerouslySetInnerHTML={{
                        __html: highlightMatch(suggestion.title, value),
                      }}
                    />
                  </div>

                  <div className="shrink-0 rounded-full border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {suggestion.category}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}