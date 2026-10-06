import { assertAuthSession, captureAuthSession, getAccessToken, ReauthorizationRequiredError } from "./spotifyAuth";
import { isCancellation, requestJson } from "./request";
import { spotifyContentUrl } from "./spotifyLinks";

const API_BASE_URL = "https://api.spotify.com/v1";
let cooldown = { session: null, until: 0 };
export class SpotifyApiError extends Error {
  constructor(operation, status, message, { code = "spotify_api_error", retryAfterSeconds = null, outcomeUnknown = false, cause } = {}) {
    super(message, { cause });
    this.name = "SpotifyApiError";
    Object.assign(this, { operation, status, code, retryAfterSeconds, outcomeUnknown });
  }
}
export function getSpotifyRetryDelay() {
  return cooldown.session === captureAuthSession() ? Math.max(0, Math.ceil((cooldown.until - Date.now()) / 1000)) : 0;
}
function retryDelay(response) {
  const value = response.headers.get("Retry-After");
  if (value === null || !value.trim()) return null;
  const seconds = /^\d+$/.test(value.trim()) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}
function responseError(response, body, operation, isWrite) {
  if (response.status === 403) return new SpotifyApiError(operation, 403,
    "Spotify denied this request. Development Mode requires an allowlisted account; missing permissions or app availability can also cause this. Use Try demo to explore the app.",
    { code: "access_denied" });
  if (response.status === 429) {
    const delay = retryDelay(response);
    if (delay !== null) cooldown = { session: captureAuthSession(), until: Date.now() + delay * 1000 };
    return new SpotifyApiError(operation, 429,
      body.error?.reason === "QUOTA_EXCEEDED"
        ? "Spotify's request quota was reached. Try demo or try Spotify again later."
        : `Spotify is limiting requests. ${delay === null ? "Please try again later." : `Try again in ${delay} seconds.`}`,
      { code: "rate_limited", retryAfterSeconds: delay });
  }
  return new SpotifyApiError(operation, response.status,
    `Spotify could not complete the ${operation} request. Please try again later.`,
    { code: "spotify_http_error", outcomeUnknown: isWrite && response.status >= 500 });
}
async function spotifyFetch(path, options, operation, { signal, authSession = captureAuthSession() } = {}) {
  const isWrite = options?.method === "POST";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    assertAuthSession(authSession, signal);
    const delay = getSpotifyRetryDelay();
    if (delay) throw new SpotifyApiError(operation, 429, `Spotify is limiting requests. Try again in ${delay} seconds.`, { code: "rate_limited", retryAfterSeconds: delay });
    const token = await getAccessToken({ forceRefresh: attempt === 1, authSession, signal });
    assertAuthSession(authSession, signal);
    let result;
    try {
      result = await requestJson(API_BASE_URL + path, {
        ...options, headers: { Authorization: `Bearer ${token}`, ...options?.headers },
      }, [authSession.controller.signal, signal]);
    } catch (error) {
      if (isCancellation(error)) throw error;
      throw new SpotifyApiError(operation, 0, error.message, {
        code: error.code || "network_error", outcomeUnknown: isWrite, cause: error,
      });
    }
    assertAuthSession(authSession, signal);
    const { response, body, bodyValid } = result;
    if (response.status === 401 && attempt === 0) continue;
    if (response.status === 401) throw new ReauthorizationRequiredError();
    if (!response.ok) throw responseError(response, body, operation, isWrite);
    if (!bodyValid) throw new SpotifyApiError(operation, response.status, "Spotify's response could not be read.", { code: "invalid_response", outcomeUnknown: isWrite });
    return body;
  }
}
export async function searchTracks(query, options = {}) {
  if (!query.trim()) return [];
  const data = await spotifyFetch(`/search?type=track&q=${encodeURIComponent(query)}&limit=10`, {}, "search", options);
  return (data.tracks?.items ?? []).filter(track => track?.id && track?.uri).map(track => ({
    source: "spotify", id: track.id, name: track.name || "Untitled track",
    artist: (track.artists ?? []).map(artist => artist.name).join(", ") || "Unknown artist",
    album: track.album?.name || "Unknown album", uri: track.uri,
    spotifyUrl: spotifyContentUrl("track", track.id, track.external_urls?.spotify),
  }));
}
export async function createPlaylist(name, options = {}) {
  const data = await spotifyFetch("/me/playlists", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, public: true }),
  }, "create playlist", options);
  if (typeof data.id !== "string" || !data.id) throw new SpotifyApiError("create playlist", 201, "Spotify returned no playlist identifier.", { code: "invalid_response", outcomeUnknown: true });
  return { ...data, source: "spotify", spotifyUrl: spotifyContentUrl("playlist", data.id, data.external_urls?.spotify) };
}
export async function addItemsToPlaylist(playlistId, itemUris, options = {}) {
  if (!Array.isArray(itemUris) || !itemUris.length || itemUris.length > 100) {
    throw new SpotifyApiError("add playlist items", 0, "Provide between 1 and 100 Spotify item URIs.", { code: "invalid_items" });
  }
  const data = await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}/items`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uris: itemUris }),
  }, "add playlist items", options);
  if (typeof data.snapshot_id !== "string" || !data.snapshot_id) throw new SpotifyApiError("add playlist items", 201, "Spotify did not confirm the playlist update.", { code: "invalid_response", outcomeUnknown: true });
  return data;
}
