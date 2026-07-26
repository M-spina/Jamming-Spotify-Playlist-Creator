import Track from "../Track/Track";
import "./Tracklist.css";

export default function Tracklist({ tracks, onSelect, isTrackSelected }) {
  return (
    <div className="tracklist">
      {tracks.map((track) => (
        <Track
          key={track.id}
          track={track}
          onAction={onSelect}
          isSelected={isTrackSelected(track)}
          isSelectable
        />
      ))}
    </div>
  );
}
