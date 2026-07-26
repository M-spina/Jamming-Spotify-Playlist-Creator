
import Tracklist from "../Tracklist/Tracklist";
import "./SearchResults.css";

export default function SearchResults({ results, onSelect, isTrackSelected }) {
  return (
    <section className="search-results" aria-labelledby="search-results-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Discover</p>
          <h2 id="search-results-heading">Search Results</h2>
        </div>
        <span className="track-count">{results.length} tracks</span>
      </div>
      {results.length === 0 && (
        <p className="empty-state">Search for music to start building your playlist.</p>
      )}
      <Tracklist
        tracks={results}
        onSelect={onSelect}
        isTrackSelected={isTrackSelected}
      />
    </section>
  );
}
