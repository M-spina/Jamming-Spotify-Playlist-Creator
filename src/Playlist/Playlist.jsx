import { useState } from "react";
import Track from "../Track/Track";

export default function Playlist({ tracks , onRemove, onSave }) {
    const [playlistName, setPlaylistName] = useState("New Playlist");
    
    const handleSave = () => {
        if(!playlistName.trim() || tracks.length === 0) return;
        onSave(playlistName);
    };

    return (
        <div className="playlist">
            <h2>Playlist</h2>
            <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Playlist Name"
            />
            {tracks.map((track) => (
                <Track key={track.id} track={track} onSelectFun={onRemove} isSelectable={false} buttonText="Remove" />
            ))}
            {tracks.length > 0 && (
                <button onClick={handleSave} disabled={!playlistName.trim()}>
                    Save to Spotify
                </button>
            )}
        </div>
    );
}