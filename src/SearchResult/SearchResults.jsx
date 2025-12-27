
import Tracklist from '../Tracklist/Tracklist';

export default function SearchResults({results, onSelect, isTrackSelected}) {

  return (
    <div className="search-results">
      <h2>Search Results</h2>
      <Tracklist tracks={results} onSelectFun={onSelect} isTrackSelected={isTrackSelected} />
    </div>
  );
}