import { AUTH_SESSION_VERSION, TERMS_VERSION } from "../utils/spotifyAuth";
export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
export function seedSession({ token = "access-token", refresh = "refresh-token", expiresAt = Date.now() + 120_000 } = {}) {
  sessionStorage.setItem("spotify_access_token", token);
  sessionStorage.setItem("spotify_refresh_token", refresh);
  sessionStorage.setItem("spotify_token_expires_at", String(expiresAt));
  sessionStorage.setItem("spotify_auth_session_version", AUTH_SESSION_VERSION);
  sessionStorage.setItem("jammming_terms_version", TERMS_VERSION);
}
export function realTracks(count = 1) {
  return Array.from({ length: count }, (_, index) => {
    const id = String(index + 1).padStart(22, "0");
    return { source: "spotify", id, name: "Track " + index, artist: "Artist", album: "Album", uri: "spotify:track:" + id, spotifyUrl: "https://open.spotify.com/track/" + id };
  });
}
