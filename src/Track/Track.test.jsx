import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Track from "./Track";
const track = { source: "spotify", id: "track-1", name: "Song", artist: "Artist", album: "Album", spotifyUrl: "https://open.spotify.com/track/abc" };
describe("Track", () => {
  it("disables selected tracks and exposes their pressed state", () => {
    render(<Track track={track} onAction={vi.fn()} isSelected />);
    expect(screen.getByRole("button",{name:"Selected Song by Artist"})).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed","true");
  });
  it("links real metadata back to Spotify", () => {
    render(<Track track={track} onAction={vi.fn()} />);
    expect(screen.getByRole("link",{name:"Open Song in Spotify"})).toHaveAttribute("href",track.spotifyUrl);
    expect(screen.getByRole("link")).toHaveAttribute("rel","noopener noreferrer");
  });
  it("does not render unsafe external links", () => {
    render(<Track track={{...track,spotifyUrl:"javascript:alert(1)"}} onAction={vi.fn()} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("labels fictional tracks and never attaches a Spotify link", () => {
    render(<Track track={{...track,source:"demo"}} onAction={vi.fn()} />);
    expect(screen.getByText("Fictional sample")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
