import { useState } from "react";
import "./SearchBar.css";

export default function SearchBar({ onSearch, disabled = false }) {
  const [query, setQuery] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    void onSearch(query.trim());
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit} role="search">
      <label className="visually-hidden" htmlFor="spotify-search">
        Search Spotify for tracks
      </label>
      <input
        id="spotify-search"
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search by track, artist, or album"
        autoComplete="off"
        disabled={disabled}
      />
      <button type="submit" disabled={!query.trim() || disabled}>Search</button>
    </form>
  );
}
