import { useState } from "react";

export default function Track({ track , onSelectFun, isSelectable = true, buttonText = "Remove" }) {
  const [isSelected, setIsSelected] = useState(false);

  const handleSelected = () => {
    onSelectFun(track);
    if (isSelectable){
        setIsSelected(!isSelected);
    }
  };

  const displayButtonText = isSelectable ? (isSelected ? "Selected" : "Select") : buttonText;

  return (
    <div className="track">
      <h3>{track.name}</h3>
      <p>{track.artist}</p>
      <p>{track.album}</p>
      <button onClick={handleSelected}>{displayButtonText}</button>
    </div>
  );
}