import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./hooks/useSpotify", () => ({
  useSpotify: vi.fn(),
}));

import { useAuth } from "./hooks/useAuth";
import { useSpotify } from "./hooks/useSpotify";
import App from "./App";

const track = {
  id: "track-1",
  name: "Digital Love",
  artist: "Daft Punk",
  album: "Discovery",
  uri: "spotify:track:track-1",
};

function spotifyHook(overrides = {}) {
  return {
    searchResults: [track],
    isSearching: false,
    isSaving: false,
    searchError: null,
    saveStatus: null,
    handleSearch: vi.fn(),
    createPlaylistFromTracks: vi.fn().mockResolvedValue({ id: "playlist-1" }),
    resetSpotifyState: vi.fn(),
    ...overrides,
  };
}

describe("App playlist save behavior", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      status: "authenticated",
      isAuthenticated: true,
      error: null,
      login: vi.fn(),
      logout: vi.fn(),
      invalidateSession: vi.fn(),
    });
  });

  it("retains selected tracks when playlist saving fails", async () => {
    const user = userEvent.setup();
    const createPlaylistFromTracks = vi.fn().mockRejectedValue(new Error("Rejected"));
    useSpotify.mockReturnValue(spotifyHook({ createPlaylistFromTracks }));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /select digital love/i }));
    expect(screen.getByText(/public, shareable playlist/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /create public playlist/i }));

    await waitFor(() => expect(createPlaylistFromTracks).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /remove digital love/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create public playlist/i })).toBeInTheDocument();
  });

  it("clears selected tracks only after confirmed success", async () => {
    const user = userEvent.setup();
    const createPlaylistFromTracks = vi.fn().mockResolvedValue({ id: "playlist-1" });
    useSpotify.mockReturnValue(spotifyHook({ createPlaylistFromTracks }));
    render(<App />);

    await user.click(screen.getByRole("button", { name: /select digital love/i }));
    await user.click(screen.getByRole("button", { name: /create public playlist/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /remove digital love/i })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /create public playlist/i })).not.toBeInTheDocument();
  });
});
