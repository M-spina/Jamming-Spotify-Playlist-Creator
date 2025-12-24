import {useEffect, useState} from 'react';
import Tracklist from '../Tracklist/Tracklist';

export default function SearchResults({results, onSelect}) {
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    setSearchResults(results);
  }, [results]);

  return (
    <div className="search-results">
      <h2>Search Results</h2>
      <Tracklist tracks={searchResults} onSelectFun={onSelect} />
    </div>
  );
}