import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Track from "./Track";

const track = {
  id: "track-1",
  name: "Digital Love",
  artist: "Daft Punk",
  album: "Discovery",
};

describe("Track", () => {
  it("disables tracks that have already been selected", () => {
    render(<Track track={track} onAction={vi.fn()} isSelected isSelectable />);

    const button = screen.getByRole("button", { name: /selected digital love/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
