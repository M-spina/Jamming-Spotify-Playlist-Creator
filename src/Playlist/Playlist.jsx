import { useState } from "react";
import Track from "../Track/Track";
import "./Playlist.css";
export default function Playlist({ tracks, onRemove, onSave, isSaving = false, saveDisabled = false, mode = "spotify" }) {
  const [name, setName] = useState("New Playlist");
  const isDemo = mode === "demo";
  function submit(event) {
    event.preventDefault();
    if (!name.trim() || !tracks.length || isSaving || saveDisabled) return;
    void onSave(name.trim());
  }
  return <section className="playlist" aria-labelledby="playlist-heading">
    <div className="section-heading"><div><p className="eyebrow">Your mix</p><h2 id="playlist-heading">Playlist</h2></div><span className="track-count">{tracks.length} selected</span></div>
    <form onSubmit={submit}>
      <label htmlFor="playlist-name">Playlist name</label>
      <input id="playlist-name" type="text" value={name} onChange={event => setName(event.target.value)} disabled={isSaving} />
      <div className="playlist-tracks">{!tracks.length && <p className="empty-state">Selected tracks will appear here.</p>}
        {tracks.map(track => <Track key={track.id} track={track} onAction={onRemove} isSelectable={false} disabled={isSaving} />)}
      </div>
      {tracks.length > 0 && <>
        <p className="visibility-notice">{isDemo ? "This is a simulated save using fictional tracks. Nothing will be created in Spotify." : "Spotify will create a public, shareable playlist. You can manage its visibility and access later in Spotify. Leaving during a save may leave an empty or partially populated playlist."}</p>
        <button className="save-button" type="submit" disabled={!name.trim() || isSaving || saveDisabled}>{isSaving ? "Saving…" : isDemo ? "Simulate save" : "Create public playlist"}</button>
      </>}
    </form>
  </section>;
}
