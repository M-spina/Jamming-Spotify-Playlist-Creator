import { useState } from "react";
import Track from "../Track/Track";
import "./Playlist.css";

export default function Playlist({ tracks, onRemove, onSave, isSaving = false }) {
    const [playlistName, setPlaylistName] = useState("New Playlist");

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!playlistName.trim() || tracks.length === 0 || isSaving) return;
        void onSave(playlistName.trim());
    };

    return (
        <section className="playlist" aria-labelledby="playlist-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your mix</p>
              <h2 id="playlist-heading">Playlist</h2>
            </div>
            <span className="track-count">{tracks.length} selected</span>
          </div>
          <form onSubmit={handleSubmit}>
            <label htmlFor="playlist-name">Playlist name</label>
            <input
                id="playlist-name"
                type="text"
                value={playlistName}
                onChange={(event) => setPlaylistName(event.target.value)}
                placeholder="Playlist Name"
                disabled={isSaving}
            />
            <div className="playlist-tracks">
              {tracks.length === 0 && (
                <p className="empty-state">Selected tracks will appear here.</p>
              )}
              {tracks.map((track) => (
                  <Track
                    key={track.id}
                    track={track}
                    onAction={onRemove}
                    isSelectable={false}
                    buttonText="Remove"
                    disabled={isSaving}
                  />
              ))}
            </div>
            {tracks.length > 0 && (
                <>
                  <p className="visibility-notice">
                    Spotify will create a public, shareable playlist. You can change
                    its visibility later in Spotify.
                  </p>
                  <button
                    className="save-button"
                    type="submit"
                    disabled={!playlistName.trim() || isSaving}
                  >
                      {isSaving ? "Saving…" : "Create public playlist"}
                  </button>
                </>
            )}
          </form>
        </section>
    );
}
