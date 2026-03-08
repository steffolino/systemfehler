import { Link } from 'react-router-dom';
import SearchInput from './SearchInput';

import { useState } from 'react';
export default function Navbar() {
  const [searchValue, setSearchValue] = useState('');
  return (
    <nav className="flex items-center justify-between p-4 bg-white shadow-md">
      <Link to="/" className="font-bold text-lg">Systemfehler</Link>
      <div className="flex-1 mx-4 max-w-md">
        <SearchInput navbar value={searchValue} onChange={setSearchValue} />
      </div>
      <Link to="/admin" className="text-sm">Admin</Link>
    </nav>
  );
}
