import Tracklist from "../Tracklist/Tracklist";
import "./SearchResults.css";
export default function SearchResults({ results, onSelect, isTrackSelected, disabled = false, mode = "spotify" }) {
  return <section className="search-results" aria-labelledby="search-results-heading">
    <div className="section-heading"><div><p className="eyebrow">Discover</p><h2 id="search-results-heading">{mode === "demo" ? "Sample Tracks" : "Search Results"}</h2></div><span className="track-count">{results.length} tracks</span></div>
    {!results.length && <p className="empty-state">No tracks to show. Try another track, artist, or album.</p>}
    <Tracklist tracks={results} onSelect={onSelect} isTrackSelected={isTrackSelected} disabled={disabled} />
  </section>;
}
