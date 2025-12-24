import { useState, useEffect } from "react";
import Track from "../Track/Track";

export default function Tracklist({ tracks, onSelectFun }) {
  const [trackList, setTrackList] = useState([]);

  useEffect(() => {
    setTrackList(tracks);
  }, [tracks]);

  return (
    <div className="tracklist">
      {trackList.map((track) => (
        <Track key={track.id} track={track} onSelectFun={onSelectFun} isSelectable={true}/>
      ))}
    </div>
  );
}