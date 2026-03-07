import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
export default function SearchInput({ value, onChange, navbar }) {
  const [suggestions, setSuggestions] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    if (value && value.length > 1) {
      api.autocomplete({ query: value, limit: 10 }).then(setSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [value]);

  function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  return (
    <div className="relative">
      <input
        className={`w-full border rounded px-3 py-2 ${navbar ? 'bg-gray-100' : ''}`}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search..."
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 bg-white border mt-1 z-10">
          {suggestions.map(s => (
            <li key={s.id} className="px-3 py-2 flex justify-between cursor-pointer hover:bg-gray-100"
                onClick={() => navigate(`/entry/${s.id}`)}>
              <span dangerouslySetInnerHTML={{ __html: highlightMatch(s.title, value) }} />
              <span className="text-xs text-gray-500">{s.category}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
