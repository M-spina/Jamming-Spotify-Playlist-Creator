import { safeSpotifyUrl } from "../utils/spotifyLinks";
import "./Track.css";
export default function Track({ track, onAction, isSelected = false, isSelectable = true, buttonText = "Remove", disabled = false }) {
  const text = isSelectable ? (isSelected ? "Selected" : "Select") : buttonText;
  const url = track.source === "spotify" ? safeSpotifyUrl(track.spotifyUrl) : null;
  return <article className={`track${isSelected ? " track--selected" : ""}`}>
    <div className="track-copy"><h3 title={track.name}>{track.name}</h3><p title={track.artist}>{track.artist}</p><p className="track-album" title={track.album}>{track.album}</p>
      {track.source === "demo" && <span className="sample-label">Fictional sample</span>}
      {url && <a className="spotify-track-link" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${track.name} in Spotify`}>Open in Spotify</a>}
    </div>
    <button type="button" onClick={() => onAction(track)} disabled={disabled || (isSelectable && isSelected)} aria-pressed={isSelectable ? isSelected : undefined} aria-label={`${text} ${track.name} by ${track.artist}`}>{text}</button>
  </article>;
}
