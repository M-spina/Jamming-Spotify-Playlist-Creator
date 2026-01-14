import {useState} from 'react';
import './SearchBar.css';

export default function SearchBar({onSearch, disabled = false}) {
  const [query, setQuery] = useState('');

  const handleInputChange = (e) => {
    setQuery(e.target.value);
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    onSearch(query);
  };

  return (
    <div className="search-bar">
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder="Search..."
      />
      <button onClick={handleSearch} disabled={!query.trim() || disabled}>Search</button>
    </div>
  );
}
