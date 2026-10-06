import { assertNotCancelled, OperationCancelledError, requestJson } from "./request";

const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SCOPES = "user-read-private playlist-modify-public";
export const TERMS_VERSION = "2026-10-05-v1";
export const AUTH_SESSION_VERSION = "2026-session-v2";
const TOKEN_EXPIRY_BUFFER_MS = 30_000;
const STORAGE_KEYS = {
  accessToken: "spotify_access_token",
  refreshToken: "spotify_refresh_token",
  expiresAt: "spotify_token_expires_at",
  legacyExpiresAt: "spotify_token_expires_in",
  sessionVersion: "spotify_auth_session_version",
  codeVerifier: "spotify_code_verifier",
  oauthState: "spotify_oauth_state",
  termsVersion: "jammming_terms_version",
};
let session = { generation: 0, controller: new AbortController() };
let refreshInFlight = null;

export class SpotifyConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SpotifyConfigurationError";
    this.code = "spotify_configuration_error";
  }
}
export class SpotifyAuthError extends Error {
  constructor(message, code = "spotify_auth_error", cause) {
    super(message, { cause });
    this.name = "SpotifyAuthError";
    this.code = code;
  }
}
export class ReauthorizationRequiredError extends SpotifyAuthError {
  constructor(message = "Your Spotify authorization has expired. Authorize again to continue.") {
    super(message, "reauthorization_required");
    this.name = "ReauthorizationRequiredError";
    this.authSession = session;
  }
}
function storageError(cause) {
  return new SpotifyAuthError(
    "Browser session storage is unavailable. Allow site storage to log in, or use Try demo. If you were logged in, clear this site's browser data to remove stored credentials.",
    "storage_unavailable", cause,
  );
}
function read(key) {
  try { return sessionStorage.getItem(key); }
  catch (error) { throw storageError(error); }
}
function write(key, value) {
  try { sessionStorage.setItem(key, value); }
  catch (error) { throw storageError(error); }
}
export function captureAuthSession() { return session; }
export function isCurrentAuthSession(expected) {
  return session === expected && !expected.controller.signal.aborted;
}
export function assertAuthSession(expected, signal) {
  if (!isCurrentAuthSession(expected)) throw new OperationCancelledError();
  assertNotCancelled(signal);
}
export function removeLegacyCredentials() {
  try {
    for (const key of Object.values(STORAGE_KEYS)) localStorage.removeItem(key);
  } catch (error) { throw storageError(error); }
}
export function clearOAuthTransientState(expected = session) {
  if (!isCurrentAuthSession(expected)) return;
  try {
    sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
    sessionStorage.removeItem(STORAGE_KEYS.oauthState);
  } catch (error) { throw storageError(error); }
}
export function logout() {
  session.controller.abort(new OperationCancelledError());
  session = { generation: session.generation + 1, controller: new AbortController() };
  refreshInFlight = null;
  let cleared = true;
  for (const key of Object.values(STORAGE_KEYS)) {
    try { sessionStorage.removeItem(key); } catch { cleared = false; }
    try { localStorage.removeItem(key); } catch { cleared = false; }
  }
  return cleared;
}
function getSpotifyConfig() {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim();
  const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    throw new SpotifyConfigurationError("Spotify login is not configured for this deployment. You can still use Try demo.");
  }
  return { clientId, redirectUri };
}
function randomString(byteLength) {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function codeChallenge(verifier) {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function getAuthUrl({ acceptedTerms = false } = {}) {
  logout();
  const expected = captureAuthSession();
  if (!acceptedTerms) throw new SpotifyAuthError("Agree to the App Terms before logging in.", "terms_required");
  const { clientId, redirectUri } = getSpotifyConfig();
  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = await codeChallenge(verifier);
  assertAuthSession(expected);
  try {
    write(STORAGE_KEYS.codeVerifier, verifier);
    write(STORAGE_KEYS.oauthState, state);
    write(STORAGE_KEYS.termsVersion, TERMS_VERSION);
  } catch (error) { logout(); error.authSession = session; throw error; }
  const params = new URLSearchParams({
    client_id: clientId, response_type: "code", redirect_uri: redirectUri,
    code_challenge_method: "S256", code_challenge: challenge, state, scope: SCOPES,
  });
  return `${AUTH_ENDPOINT}?${params}`;
}
export function validateOAuthState(receivedState) {
  const expectedState = read(STORAGE_KEYS.oauthState);
  try { sessionStorage.removeItem(STORAGE_KEYS.oauthState); }
  catch (error) { throw storageError(error); }
  if (!receivedState || !expectedState || receivedState !== expectedState) {
    clearOAuthTransientState();
    throw new SpotifyAuthError("Spotify login could not be verified. Please try authorizing again.", "oauth_state_mismatch");
  }
  if (read(STORAGE_KEYS.termsVersion) !== TERMS_VERSION) {
    clearOAuthTransientState();
    throw new SpotifyAuthError("Please accept the current App Terms and authorize again.", "terms_required");
  }
}
function storeTokenResponse(data, expected) {
  assertAuthSession(expected);
  if (typeof data.access_token !== "string" || !data.access_token ||
      !Number.isFinite(data.expires_in) || data.expires_in <= 0 ||
      (data.refresh_token !== undefined && (typeof data.refresh_token !== "string" || !data.refresh_token))) {
    throw new SpotifyAuthError("Spotify returned an incomplete token response.", "invalid_token_response");
  }
  try {
    write(STORAGE_KEYS.accessToken, data.access_token);
    write(STORAGE_KEYS.expiresAt, String(Date.now() + data.expires_in * 1000));
    write(STORAGE_KEYS.sessionVersion, AUTH_SESSION_VERSION);
    if (data.refresh_token) write(STORAGE_KEYS.refreshToken, data.refresh_token);
  } catch (error) { logout(); error.authSession = session; throw error; }
}
async function tokenRequest(body, expected, signal) {
  const result = await requestJson(TOKEN_ENDPOINT, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  }, [expected.controller.signal, signal]);
  assertAuthSession(expected, signal);
  return result;
}
function tokenError(body, fallback) {
  return new SpotifyAuthError(
    typeof body.error_description === "string" ? body.error_description : fallback,
    typeof body.error === "string" ? body.error : "token_request_failed",
  );
}
export async function exchangeCodeForToken(code, { signal } = {}) {
  const expected = captureAuthSession();
  const { clientId, redirectUri } = getSpotifyConfig();
  const verifier = read(STORAGE_KEYS.codeVerifier);
  if (read(STORAGE_KEYS.termsVersion) !== TERMS_VERSION) throw new SpotifyAuthError("Accept the current App Terms and authorize again.", "terms_required");
  if (!verifier) throw new SpotifyAuthError("The Spotify login session has expired. Please authorize again.", "missing_code_verifier");
  try {
    const { response, body } = await tokenRequest({
      client_id: clientId, grant_type: "authorization_code", code,
      redirect_uri: redirectUri, code_verifier: verifier,
    }, expected, signal);
    if (!response.ok) throw tokenError(body, "Spotify token exchange failed. Please authorize again.");
    storeTokenResponse(body, expected);
    return body;
  } finally { clearOAuthTransientState(expected); }
}
async function performRefresh(expected, signal) {
  const refreshToken = read(STORAGE_KEYS.refreshToken);
  if (!refreshToken) throw new ReauthorizationRequiredError("Authorize with Spotify to continue.");
  const { clientId } = getSpotifyConfig();
  const { response, body } = await tokenRequest({
    client_id: clientId, grant_type: "refresh_token", refresh_token: refreshToken,
  }, expected, signal);
  if (!response.ok) {
    if (body.error === "invalid_grant") {
      logout();
      throw new ReauthorizationRequiredError();
    }
    throw tokenError(body, "Spotify token refresh failed. Please try again.");
  }
  storeTokenResponse(body, expected);
  return body;
}
export function refreshAccessToken({ signal } = {}) {
  const expected = captureAuthSession();
  assertAuthSession(expected, signal);
  if (!refreshInFlight || refreshInFlight.session !== expected || refreshInFlight.signal?.aborted) {
    const entry = { session: expected, signal };
    entry.promise = performRefresh(expected, signal).finally(() => {
      if (refreshInFlight === entry) refreshInFlight = null;
    });
    refreshInFlight = entry;
  }
  return refreshInFlight.promise;
}
export function hasValidAccessToken() {
  const expiresAt = Number(read(STORAGE_KEYS.expiresAt));
  return Boolean(read(STORAGE_KEYS.accessToken) && expiresAt && Date.now() + TOKEN_EXPIRY_BUFFER_MS < expiresAt);
}
export function hasRefreshToken() { return Boolean(read(STORAGE_KEYS.refreshToken)); }
function hasCurrentConsent() {
  return read(STORAGE_KEYS.sessionVersion) === AUTH_SESSION_VERSION && read(STORAGE_KEYS.termsVersion) === TERMS_VERSION;
}
export async function restoreSession({ signal } = {}) {
  removeLegacyCredentials();
  const expected = captureAuthSession();
  assertAuthSession(expected, signal);
  if (!hasCurrentConsent()) { logout(); return false; }
  if (hasValidAccessToken()) return true;
  if (!hasRefreshToken()) { logout(); return false; }
  await refreshAccessToken({ signal });
  assertAuthSession(expected, signal);
  return true;
}
export async function getAccessToken({ forceRefresh = false, authSession = session, signal } = {}) {
  assertAuthSession(authSession, signal);
  if (!hasCurrentConsent()) throw new ReauthorizationRequiredError();
  if (forceRefresh || !hasValidAccessToken()) await refreshAccessToken();
  assertAuthSession(authSession, signal);
  const token = read(STORAGE_KEYS.accessToken);
  if (!token) throw new ReauthorizationRequiredError("Authorize with Spotify to continue.");
  return token;
}
