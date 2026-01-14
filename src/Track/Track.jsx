

import './Track.css';

export default function Track({ track , onSelectFun, isSelected = false ,isSelectable = true, buttonText = "Remove" }) {
    const displayButtonText = isSelectable ? (isSelected ? "Selected" : "Select") : buttonText;
    
    return (
        <div className="track">
            <h3>{track.name}</h3>
            <p>{track.artist}</p>
            <p>{track.album}</p>
            <button onClick={() => onSelectFun(track)}>{displayButtonText}</button>
        </div>
    )
}