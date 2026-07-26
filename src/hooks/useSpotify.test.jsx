import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/spotifyApi", () => ({
  searchTracks: vi.fn(),
  createPlaylist: vi.fn(),
  addItemsToPlaylist: vi.fn(),
}));

import {
  addItemsToPlaylist,
  createPlaylist,
  searchTracks,
} from "../utils/spotifyApi";
import { ReauthorizationRequiredError } from "../utils/spotifyAuth";
import { PlaylistSaveError, useSpotify } from "./useSpotify";

const tracks = Array.from({ length: 101 }, (_, index) => ({
  id: `track-${index}`,
  name: `Track ${index}`,
  artist: "Artist",
  album: "Album",
  uri: `spotify:track:${index}`,
}));

describe("useSpotify", () => {
  beforeEach(() => {
    createPlaylist.mockResolvedValue({ id: "playlist-1", name: "Test Mix" });
    addItemsToPlaylist.mockResolvedValue({ snapshot_id: "snapshot" });
    searchTracks.mockResolvedValue([]);
  });

  it("saves only after every ordered 100-item batch succeeds", async () => {
    const onAuthInvalidated = vi.fn();
    const { result } = renderHook(() => useSpotify(true, onAuthInvalidated));
    let playlist;

    await act(async () => {
      playlist = await result.current.createPlaylistFromTracks(" Test Mix ", tracks);
    });

    expect(playlist).toEqual({ id: "playlist-1", name: "Test Mix" });
    expect(createPlaylist).toHaveBeenCalledWith("Test Mix");
    expect(addItemsToPlaylist).toHaveBeenCalledTimes(2);
    expect(addItemsToPlaylist.mock.calls[0][1]).toHaveLength(100);
    expect(addItemsToPlaylist.mock.calls[1][1]).toHaveLength(1);
    expect(result.current.saveStatus).toEqual({
      type: "success",
      message: "\"Test Mix\" was saved to Spotify.",
    });
  });

  it("rejects creation failures and reports that nothing was created", async () => {
    createPlaylist.mockRejectedValue(new Error("Account is not allowed"));
    const { result } = renderHook(() => useSpotify(true, vi.fn()));
    let thrownError;

    await act(async () => {
      try {
        await result.current.createPlaylistFromTracks("Mix", tracks.slice(0, 1));
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toBeInstanceOf(PlaylistSaveError);
    expect(thrownError.stage).toBe("create");
    expect(addItemsToPlaylist).not.toHaveBeenCalled();
    expect(result.current.saveStatus).toEqual({
      type: "error",
      message: "The playlist was not created. Account is not allowed",
    });
  });

  it("reports a partial failure without claiming rollback", async () => {
    addItemsToPlaylist.mockRejectedValue(new Error("Items request failed"));
    const { result } = renderHook(() => useSpotify(true, vi.fn()));
    let thrownError;

    await act(async () => {
      try {
        await result.current.createPlaylistFromTracks("Mix", tracks.slice(0, 1));
      } catch (error) {
        thrownError = error;
      }
    });

    expect(thrownError).toMatchObject({
      name: "PlaylistSaveError",
      stage: "add-items",
      playlist: { id: "playlist-1", name: "Test Mix" },
    });
    expect(result.current.saveStatus.type).toBe("error");
    expect(result.current.saveStatus.message).toMatch(/playlist.*created/i);
    expect(result.current.saveStatus.message).toMatch(/before retrying/i);
  });

  it("invalidates auth when refresh-token expiration reaches a save", async () => {
    const authError = new ReauthorizationRequiredError();
    createPlaylist.mockRejectedValue(authError);
    const onAuthInvalidated = vi.fn();
    const { result } = renderHook(() => useSpotify(true, onAuthInvalidated));

    await act(async () => {
      await expect(
        result.current.createPlaylistFromTracks("Mix", tracks.slice(0, 1)),
      ).rejects.toBe(authError);
    });

    expect(onAuthInvalidated).toHaveBeenCalledWith(authError);
    expect(result.current.saveStatus).toBeNull();
  });

  it("keeps search errors separate from save state", async () => {
    searchTracks.mockRejectedValue(new Error("Search unavailable"));
    const { result } = renderHook(() => useSpotify(true, vi.fn()));

    await act(async () => {
      await result.current.handleSearch("Daft Punk");
    });

    expect(result.current.searchError).toBe("Search unavailable");
    expect(result.current.saveStatus).toBeNull();
    expect(result.current.isSearching).toBe(false);
  });
});
