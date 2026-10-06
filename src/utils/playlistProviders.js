import { addItemsToPlaylist, createPlaylist, searchTracks, SpotifyApiError } from "./spotifyApi";
import { assertAuthSession, captureAuthSession, ReauthorizationRequiredError } from "./spotifyAuth";
import { isCancellation } from "./request";
import { demoProvider } from "./demoApi";

export class PlaylistSaveError extends Error {
  constructor(stage, playlist, cause) {
    super(cause.message || "Playlist saving failed.", { cause });
    this.name = "PlaylistSaveError";
    this.stage = stage;
    this.playlist = playlist;
    this.outcomeUnknown = Boolean(cause.outcomeUnknown);
  }
}
const spotifyProvider = {
  searchTracks,
  async savePlaylist(name, tracks, { signal } = {}) {
    const authSession = captureAuthSession();
    assertAuthSession(authSession, signal);
    if (!name.trim() || !tracks.length || tracks.some(track =>
      track.source !== "spotify" || !/^spotify:track:[A-Za-z0-9]{22}$/.test(track.uri || ""))) {
      throw new PlaylistSaveError("create", null, new SpotifyApiError("save playlist", 0,
        "Choose real Spotify tracks and a playlist name.", { code: "invalid_items" }));
    }
    const uris = tracks.map(track => track.uri);
    let playlist = null;
    try {
      playlist = await createPlaylist(name.trim(), { signal, authSession });
      assertAuthSession(authSession, signal);
      for (let index = 0; index < uris.length; index += 100) {
        assertAuthSession(authSession, signal);
        await addItemsToPlaylist(playlist.id, uris.slice(index, index + 100), { signal, authSession });
        assertAuthSession(authSession, signal);
      }
      return playlist;
    } catch (error) {
      if (isCancellation(error) || error instanceof ReauthorizationRequiredError) throw error;
      throw new PlaylistSaveError(playlist ? "add-items" : "create", playlist, error);
    }
  },
};
export const playlistProviders = { spotify: spotifyProvider, demo: demoProvider };
