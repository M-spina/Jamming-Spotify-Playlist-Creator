import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useSpotify } from "./hooks/useSpotify";
import { safeSpotifyUrl } from "./utils/spotifyLinks";
import SearchBar from "./SearchBar/SearchBar";
import SearchResults from "./SearchResults/SearchResults";
import Playlist from "./Playlist/Playlist";
import "./App.css";

function PolicyLinks() {
  return <footer className="policy-links" aria-label="App information">
    <a href="/privacy.html">Privacy</a><a href="/terms.html">App Terms</a><a href="/disconnect.html">Disconnect Spotify</a>
  </footer>;
}
function Workspace({ mode, onExit, onDemo, onAuthInvalidated }) {
  const { searchResults, isSearching, isSaving, searchError, saveStatus, retryDelay, handleSearch, createPlaylistFromTracks, resetSpotifyState } = useSpotify(mode, onAuthInvalidated);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const isDemo = mode === "demo";
  function leave(action) { resetSpotifyState(); setPlaylistTracks([]); action(); }
  async function save(name) {
    try { await createPlaylistFromTracks(name, playlistTracks); setPlaylistTracks([]); }
    catch { /* Cancelled or unconfirmed saves must not clear the draft. */ }
  }
  const playlistUrl = safeSpotifyUrl(saveStatus?.playlist?.spotifyUrl);
  return <main className="App">
    <header className="app-header">
      <div><p className="eyebrow">{isDemo ? "Playlist builder demo" : "Spotify playlist creator"}</p><h1>Jammming</h1></div>
      <div className="header-actions">
        {!isDemo && <button className="secondary-button" type="button" onClick={() => leave(onDemo)}>Try demo</button>}
        <button className="logout-button" type="button" onClick={() => leave(onExit)}>{isDemo ? "Exit demo" : "Logout"}</button>
      </div>
    </header>
    {isDemo ? <>
      <p className="demo-notice"><strong>Demo — fictional sample data; saving is simulated.</strong><br />No Spotify account is needed. Sample playlists reset when you reload.</p>
      <p className="intro">Choose sample tracks or search for “Signal”, “Night”, or “Juniper”.</p>
    </> : <>
      <p className="intro">Search Spotify, choose your tracks, and create a public playlist.</p>
      <div className="spotify-attribution"><img src="/spotify-logo-white.svg" alt="Spotify" width="88" height="27" /><span>Track metadata supplied by Spotify.</span></div>
    </>}
    <div className="app-status" aria-live="polite" aria-atomic="true">
      {searchError && <p className="status-message status-message--error">{searchError}</p>}
      {saveStatus && <div className={`status-message status-message--${saveStatus.type}`}><p>{saveStatus.message}</p>
        {playlistUrl && <a href={playlistUrl} target="_blank" rel="noopener noreferrer">Open playlist in Spotify</a>}
      </div>}
      {retryDelay > 0 && <p className="operation-status">Spotify requests paused. Try again in {retryDelay} seconds.</p>}
      {isSearching && <p className="operation-status">{isDemo ? "Searching sample tracks…" : "Searching Spotify…"}</p>}
      {isSaving && <p className="operation-status">{isDemo ? "Simulating save…" : "Saving playlist…"}</p>}
    </div>
    {isDemo && saveStatus?.playlist?.simulated && <section className="demo-summary" aria-labelledby="demo-summary-heading">
      <h2 id="demo-summary-heading">Simulated playlist: {saveStatus.playlist.name}</h2>
      <p>{saveStatus.playlist.tracks.length} fictional tracks — saved for this preview only.</p>
      <ol>{saveStatus.playlist.tracks.map(track => <li key={track.id}>{track.name} — {track.artist}</li>)}</ol>
    </section>}
    <SearchBar onSearch={handleSearch} disabled={isSaving || isSearching || retryDelay > 0} mode={mode} />
    <div className="workspace">
      <SearchResults results={searchResults} disabled={isSaving} mode={mode}
        onSelect={track => setPlaylistTracks(current => current.some(item => item.id === track.id) ? current : [...current, track])}
        isTrackSelected={track => playlistTracks.some(item => item.id === track.id)} />
      <Playlist tracks={playlistTracks} mode={mode} onSave={save} isSaving={isSaving} saveDisabled={isSearching || retryDelay > 0}
        onRemove={track => setPlaylistTracks(current => current.filter(item => item.id !== track.id))} />
    </div><PolicyLinks />
  </main>;
}
function App() {
  const auth = useAuth();
  const [view, setView] = useState("landing");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  function enterDemo() { auth.logout(); setAcceptedTerms(false); setView("demo"); }
  function exit() { auth.logout(); setAcceptedTerms(false); setView("landing"); }
  function invalidate(error) { setAcceptedTerms(false); setView("landing"); auth.invalidateSession(error); }
  const mode = view === "demo" ? "demo" : auth.isAuthenticated ? "spotify" : null;
  if (mode) return <Workspace key={mode} mode={mode} onExit={exit} onDemo={enterDemo} onAuthInvalidated={invalidate} />;
  return <main className="App auth-screen">
    <p className="eyebrow">Build your next mix</p><h1>Jammming</h1>
    <p>Explore the playlist builder immediately with fictional tracks, or create public playlists with an allowed Spotify account.</p>
    <button type="button" onClick={enterDemo}>Try demo</button>
    <p className="development-notice">Real Spotify integration is for allowlisted testers. Login can succeed while API access is denied in Development Mode.</p>
    {auth.status === "loading" && <p className="operation-status" role="status">Checking your Spotify session…</p>}
    {auth.error && <p className="status-message status-message--error" role="alert">{auth.error}</p>}
    <div className="login-panel">
      <label className="terms-checkbox"><input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} /><span>I agree to the <a href="/terms.html">App Terms</a>.</span></label>
      <p>Read our <a href="/privacy.html">Privacy Policy</a> before logging in.</p>
      <button type="button" className="secondary-button" onClick={() => auth.login(acceptedTerms)} disabled={!acceptedTerms || auth.status === "loading"}>Login with Spotify — allowlisted testers</button>
    </div><PolicyLinks />
  </main>;
}
export default App;
