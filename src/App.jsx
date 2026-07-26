import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useSpotify } from "./hooks/useSpotify";
import SearchBar from "./SearchBar/SearchBar";
import SearchResults from "./SearchResults/SearchResults";
import Playlist from "./Playlist/Playlist";
import "./App.css";

function App() {
  const {
    status: authStatus,
    isAuthenticated,
    error: authError,
    login,
    logout,
    invalidateSession,
  } = useAuth();
  const {
    searchResults,
    isSearching,
    isSaving,
    searchError,
    saveStatus,
    handleSearch,
    createPlaylistFromTracks,
    resetSpotifyState,
  } = useSpotify(isAuthenticated, invalidateSession);
  const [playlistTracks, setPlaylistTracks] = useState([]);

  const handleSelectTrack = (track) => {
    setPlaylistTracks((currentTracks) => (
      currentTracks.some((item) => item.id === track.id)
        ? currentTracks
        : [...currentTracks, track]
    ));
  };

  const handleRemoveTrack = (track) => {
    setPlaylistTracks((currentTracks) => (
      currentTracks.filter((item) => item.id !== track.id)
    ));
  };

  const isTrackSelected = (track) => (
    playlistTracks.some((item) => item.id === track.id)
  );

  const handleLogout = () => {
    setPlaylistTracks([]);
    resetSpotifyState();
    logout();
  };

  const handleSavePlaylist = async (playlistName) => {
    try {
      await createPlaylistFromTracks(playlistName, playlistTracks);
      setPlaylistTracks([]);
    } catch {
      // The hook preserves the tracks and provides an accessible, actionable status.
    }
  };

  if (authStatus === "loading") {
    return (
      <main className="App auth-screen">
        <h1>Jammming</h1>
        <p className="operation-status" role="status">Checking your Spotify session…</p>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="App auth-screen">
        <h1>Jammming</h1>
        <p>Create a playlist from Spotify search results.</p>
        {authError && (
          <p className="status-message status-message--error" role="alert">
            {authError}
          </p>
        )}
        <button type="button" onClick={login}>
          {authError ? "Authorize with Spotify" : "Login with Spotify"}
        </button>
      </main>
    );
  }

  return (
    <main className="App">
      <header className="app-header">
        <div>
          <p className="eyebrow">Spotify playlist creator</p>
          <h1>Jammming</h1>
        </div>
        <button className="logout-button" type="button" onClick={handleLogout}>
          Logout
        </button>
      </header>

      <p className="intro">Search Spotify, choose your tracks, and create a public playlist.</p>

      <div className="app-status" aria-live="polite" aria-atomic="true">
        {authError && <p className="status-message status-message--error">{authError}</p>}
        {searchError && <p className="status-message status-message--error">{searchError}</p>}
        {saveStatus && (
          <p className={`status-message status-message--${saveStatus.type}`}>
            {saveStatus.message}
          </p>
        )}
        {isSearching && <p className="operation-status">Searching Spotify…</p>}
        {isSaving && <p className="operation-status">Saving playlist…</p>}
      </div>

      <SearchBar onSearch={handleSearch} disabled={isSearching || isSaving} />

      <div className="workspace">
        <SearchResults
          results={searchResults}
          onSelect={handleSelectTrack}
          isTrackSelected={isTrackSelected}
        />
        <Playlist
          tracks={playlistTracks}
          onRemove={handleRemoveTrack}
          onSave={handleSavePlaylist}
          isSaving={isSaving}
        />
      </div>
    </main>
  );
}

export default App;
