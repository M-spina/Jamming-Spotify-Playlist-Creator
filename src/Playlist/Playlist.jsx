import { useState, useEffect } from "react";
import Track from "../Track/Track";

export default function Playlist({ tracks , onRemove }) {

    return (
        <div className="playlist">
            <h2>Playlist</h2>
            {tracks.map((track) => (
                <Track key={track.id} track={track} onSelectFun={onRemove} isSelectable={false} buttonText="Remove" />
            ))}
            {tracks.length > 0 && (
                <button>
                    Save to Spotify
                </button>
            )}
        </div>
    );
}