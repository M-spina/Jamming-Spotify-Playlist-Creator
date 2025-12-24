import { useState, useEffect } from "react";
import Track from "../Track/Track";

export default function Playlist({ playlist , onRemove }) {
    const [playlistTracks, setPlaylistTracks] = useState([]);

    useEffect(() => {
        setPlaylistTracks(playlist);
    }, [playlist]);

    return (
        <div className="playlist">
            <h2>Playlist</h2>
            {playlistTracks.map((track) => (
                <Track key={track.id} track={track} onSelectFun={onRemove} />
            ))}
        </div>
    );
}