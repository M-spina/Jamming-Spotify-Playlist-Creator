import { useState } from 'react'
import SearchBar from './SearchBar'
import SearchResults from './SearchResult/SearchResults'
import Playlist from './Playlist/Playlist'
import './App.css'

function App() {
  const [tracks, setTracks] = useState([]);
  const [playlisttracks, setPlaylistTracks] = useState([]);

  const handleSearch = (query) => {
    // Mock search results - replace with actual Spotify API call
    const mockTracks = [
      { id: 1, name: 'Song One', artist: 'Artist One', album: 'Album One' },
      { id: 2, name: 'Song Two', artist: 'Artist Two', album: 'Album Two' },
      { id: 3, name: 'Song Three', artist: 'Artist Three', album: 'Album Three' },
    ];
    setTracks(mockTracks);
  };

  const handleSelectTrack = (track) => {
    setPlaylistTracks([...playlisttracks, track]);
  }

  const RemoveTrack = (track) => {
    setPlaylistTracks(playlisttracks.filter(t => t.id !== track.id));
  }

  return (
    <div className="App">
      <h1>Jammming</h1>
      <SearchBar onSearch={handleSearch} />
      <SearchResults results={tracks} onSelect={handleSelectTrack} />
      <Playlist tracks={playlisttracks} onRemove={RemoveTrack} />
    </div>
  )
}

export default App
