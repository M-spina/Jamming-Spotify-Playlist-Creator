

import "./Track.css";

export default function Track({
    track,
    onAction,
    isSelected = false,
    isSelectable = true,
    buttonText = "Remove",
    disabled = false,
}) {
    const displayButtonText = isSelectable ? (isSelected ? "Selected" : "Select") : buttonText;

    return (
        <article className={`track${isSelected ? " track--selected" : ""}`}>
            <div className="track-copy">
              <h3 title={track.name}>{track.name}</h3>
              <p title={track.artist}>{track.artist}</p>
              <p className="track-album" title={track.album}>{track.album}</p>
            </div>
            <button
              type="button"
              onClick={() => onAction(track)}
              disabled={disabled || (isSelectable && isSelected)}
              aria-pressed={isSelectable ? isSelected : undefined}
              aria-label={`${displayButtonText} ${track.name} by ${track.artist}`}
            >
              {displayButtonText}
            </button>
        </article>
    );
}
