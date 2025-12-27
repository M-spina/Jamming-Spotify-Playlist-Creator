import Track from "../Track/Track";

export default function Tracklist({ tracks, onSelectFun, isTrackSelected }) {
  return (
    <div className="tracklist">
      {tracks.map((track) => (
        <Track key={track.id} track={track} onSelectFun={onSelectFun} isSelected={isTrackSelected(track)} isSelectable={true} />
      ))}
    </div>
  );
}