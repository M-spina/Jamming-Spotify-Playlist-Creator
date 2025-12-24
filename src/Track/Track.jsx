import { useState } from "react";

export default function Track({ track , onSelectFun }) {
  const [isSelected, setIsSelected] = useState(false);

  const handleSelected = () => {
    onSelectFun(track);
    setIsSelected(!isSelected);
  };


  return (
    <div className="track">
      <h3>{track.name}</h3>
      <p>{track.artist}</p>
      <p>{track.album}</p>
      <button onClick={handleSelected}>{isSelected ? "Selected" : "Select"}</button>
    </div>
  );
}