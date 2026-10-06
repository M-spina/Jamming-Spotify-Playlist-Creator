import { useState } from "react";
import "./SearchBar.css";
export default function SearchBar({ onSearch, disabled = false, mode = "spotify" }) {
  const [query, setQuery] = useState("");
  function submit(event) {
    event.preventDefault();
    if (!query.trim() || disabled) return;
    void onSearch(query.trim());
  }
  return <form className="search-bar" onSubmit={submit} role="search">
    <label className="visually-hidden" htmlFor="track-search">{mode === "demo" ? "Search fictional sample tracks" : "Search Spotify for tracks"}</label>
    <input id="track-search" type="text" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by track, artist, or album" autoComplete="off" disabled={disabled} />
    <button type="submit" disabled={!query.trim() || disabled}>Search</button>
  </form>;
}
