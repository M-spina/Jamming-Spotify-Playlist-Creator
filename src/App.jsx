import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import {useSpotify} from './hooks/useSpotify'
import SearchBar from './SearchBar/SearchBar'
import SearchResults from './SearchResult/SearchResults'
import Playlist from './Playlist/Playlist'
import './App.css'

function App() {
  const { isAuth, loading, error, login, logout } = useAuth();
  const { searchResults, loading: spotifyLoading, error: spotifyError, handleSearch, createPlaylistFromTracks } = useSpotify(isAuth);
  const [playlisttracks, setPlaylistTracks] = useState([]);

  

  const handleSelectTrack = (track) => {
    if (playlisttracks.some(t => t.id === track.id)) return; // Prevent duplicates
    setPlaylistTracks([...playlisttracks, track]);
  }

  const RemoveTrack = (track) => {
    setPlaylistTracks(playlisttracks.filter(t => t.id !== track.id));
  }

  const isTrackSelected = (track) => playlisttracks.some(t => t.id === track.id);

  const handleLogout = () => {
    setPlaylistTracks([]);
    logout();
  }


  if (!isAuth) {
    return (
      <div className="App">
        <h1>Jammming</h1>
        {loading && <p>Loading...</p>}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button onClick={login}>Login with Spotify</button>
      </div>
    );
  }

  return (
    <div className="App">
      <h1>Jammming</h1>
      <button onClick={handleLogout}>Logout</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {spotifyError && <p style={{ color: 'red' }}>{spotifyError}</p>}
      {spotifyLoading && <p>Searching...</p>}
      <SearchBar onSearch={handleSearch} disabled={spotifyLoading} />
      <SearchResults results={searchResults} onSelect={handleSelectTrack} isTrackSelected={isTrackSelected} />
      <Playlist tracks={playlisttracks} onRemove={RemoveTrack} />
    </div>
  )
}

export default App
