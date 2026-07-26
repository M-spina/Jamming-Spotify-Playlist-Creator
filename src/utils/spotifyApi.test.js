import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./spotifyAuth", () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from "./spotifyAuth";
import {
  addItemsToPlaylist,
  createPlaylist,
  searchTracks,
  SpotifyApiError,
} from "./spotifyApi";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Spotify API requests", () => {
  beforeEach(() => {
    getAccessToken.mockResolvedValue("access-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("creates an explicitly public playlist for the current user", async () => {
    fetch.mockResolvedValue(jsonResponse({ id: "playlist-1", name: "Road Trip" }, 201));

    await createPlaylist("Road Trip");

    expect(fetch).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/me/playlists",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Road Trip", public: true }),
      }),
    );
  });

  it("adds items with the 2026 playlist items endpoint", async () => {
    fetch.mockResolvedValue(jsonResponse({ snapshot_id: "snapshot" }, 201));
    const uris = ["spotify:track:one", "spotify:track:two"];

    await addItemsToPlaylist("playlist/with spaces", uris);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.spotify.com/v1/playlists/playlist%2Fwith%20spaces/items",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ uris }),
      }),
    );
  });

  it("rejects batches larger than Spotify's 100-item limit", async () => {
    const uris = Array.from({ length: 101 }, (_, index) => `spotify:track:${index}`);

    await expect(addItemsToPlaylist("playlist-1", uris)).rejects.toMatchObject({
      operation: "add playlist items",
      status: 0,
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("retries one time with a forced refresh after a 401", async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ error: { message: "expired" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ tracks: { items: [] } }));

    await searchTracks("test");

    expect(getAccessToken).toHaveBeenNthCalledWith(1, { forceRefresh: false });
    expect(getAccessToken).toHaveBeenNthCalledWith(2, { forceRefresh: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces Spotify's safe error message and status", async () => {
    fetch.mockResolvedValue(jsonResponse({ error: { message: "Rate limited" } }, 429));

    await expect(searchTracks("test")).rejects.toEqual(
      expect.objectContaining({
        name: "SpotifyApiError",
        operation: "search",
        status: 429,
        message: "Rate limited",
      }),
    );
  });

  it("maps the current search response fields", async () => {
    fetch.mockResolvedValue(jsonResponse({
      tracks: {
        items: [{
          id: "track-1",
          name: "Digital Love",
          uri: "spotify:track:track-1",
          artists: [{ name: "Daft Punk" }],
          album: { name: "Discovery" },
        }],
      },
    }));

    await expect(searchTracks("Digital Love")).resolves.toEqual([{
      id: "track-1",
      name: "Digital Love",
      uri: "spotify:track:track-1",
      artist: "Daft Punk",
      album: "Discovery",
    }]);
  });

  it("uses a structured validation error for missing item URIs", async () => {
    await expect(addItemsToPlaylist("playlist-1", [])).rejects.toBeInstanceOf(SpotifyApiError);
  });
});
