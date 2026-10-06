import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_SESSION_VERSION, TERMS_VERSION, exchangeCodeForToken, getAuthUrl,
  logout, refreshAccessToken, restoreSession, SpotifyConfigurationError, validateOAuthState,
} from "./spotifyAuth";
import { deferred, jsonResponse, seedSession } from "../test/fixtures";

describe("Spotify authentication utilities", () => {
  beforeEach(() => {
    logout();
    vi.stubEnv("VITE_SPOTIFY_CLIENT_ID", "client-id");
    vi.stubEnv("VITE_SPOTIFY_REDIRECT_URI", "http://127.0.0.1:5173/callback");
    vi.stubGlobal("fetch", vi.fn());
  });
  it("builds a verified PKCE login with required scopes and current terms", async () => {
    const url = new URL(await getAuthUrl({ acceptedTerms: true }));
    expect(url.searchParams.get("scope")).toBe("user-read-private playlist-modify-public");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(sessionStorage.getItem("spotify_oauth_state")).toBe(url.searchParams.get("state"));
    expect(sessionStorage.getItem("jammming_terms_version")).toBe(TERMS_VERSION);
    expect(localStorage.length).toBe(0);
  });
  it("requires explicit terms acceptance before starting OAuth", async () => {
    await expect(getAuthUrl()).rejects.toMatchObject({ code: "terms_required" });
    expect(sessionStorage.length).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects missing configuration", async () => {
    vi.stubEnv("VITE_SPOTIFY_CLIENT_ID", "");
    await expect(getAuthUrl({ acceptedTerms: true })).rejects.toBeInstanceOf(SpotifyConfigurationError);
  });
  it("consumes matching state and rejects replay", async () => {
    const url = new URL(await getAuthUrl({ acceptedTerms: true }));
    validateOAuthState(url.searchParams.get("state"));
    expect(sessionStorage.getItem("spotify_oauth_state")).toBeNull();
    expect(() => validateOAuthState(url.searchParams.get("state"))).toThrow(/could not be verified/i);
  });
  it("rejects mismatched state and clears PKCE", async () => {
    await getAuthUrl({ acceptedTerms: true });
    expect(() => validateOAuthState("wrong")).toThrow(/could not be verified/i);
    expect(sessionStorage.getItem("spotify_code_verifier")).toBeNull();
  });
  it("requires current consent on callbacks", async () => {
    const url = new URL(await getAuthUrl({ acceptedTerms: true }));
    sessionStorage.setItem("jammming_terms_version", "old");
    expect(() => validateOAuthState(url.searchParams.get("state"))).toThrow(/current App Terms/i);
    expect(sessionStorage.getItem("spotify_code_verifier")).toBeNull();
  });
  it("restores the same-tab session without refreshing", async () => {
    seedSession();
    await expect(restoreSession()).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["expired", "missing"])("clears an unrecoverable %s session on startup", async state => {
    seedSession({ expiresAt: 0 });
    sessionStorage.removeItem("spotify_refresh_token");
    if (state === "missing") sessionStorage.removeItem("spotify_access_token");
    await expect(restoreSession()).resolves.toBe(false);
    expect(sessionStorage.length).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refreshes and rotates tokens only in sessionStorage", async () => {
    seedSession({ expiresAt: 0 });
    fetch.mockResolvedValue(jsonResponse({ access_token: "new-access", refresh_token: "rotated", expires_in: 3600 }));
    await expect(restoreSession()).resolves.toBe(true);
    expect(sessionStorage.getItem("spotify_refresh_token")).toBe("rotated");
    expect(sessionStorage.getItem("spotify_access_token")).toBe("new-access");
    expect(sessionStorage.getItem("spotify_auth_session_version")).toBe(AUTH_SESSION_VERSION);
    expect(localStorage.length).toBe(0);
  });
  it("retains an unrotated refresh token", async () => {
    seedSession({ expiresAt: 0 });
    fetch.mockResolvedValue(jsonResponse({ access_token: "new-access", expires_in: 3600 }));
    await restoreSession();
    expect(sessionStorage.getItem("spotify_refresh_token")).toBe("refresh-token");
  });
  it("clears authorization on invalid_grant", async () => {
    seedSession({ expiresAt: 0 });
    fetch.mockResolvedValue(jsonResponse({ error: "invalid_grant" }, 400));
    await expect(restoreSession()).rejects.toMatchObject({ code: "reauthorization_required" });
    expect(sessionStorage.getItem("spotify_refresh_token")).toBeNull();
  });
  it("keeps refresh credentials after a transient failure", async () => {
    seedSession({ expiresAt: 0 });
    fetch.mockResolvedValue(jsonResponse({ error: "temporarily_unavailable" }, 503));
    await expect(restoreSession()).rejects.toMatchObject({ code: "temporarily_unavailable" });
    expect(sessionStorage.getItem("spotify_refresh_token")).toBe("refresh-token");
  });
  it("deletes legacy persistent credentials without migrating them", async () => {
    localStorage.setItem("spotify_access_token", "legacy");
    localStorage.setItem("spotify_refresh_token", "legacy-refresh");
    localStorage.setItem("spotify_code_verifier", "legacy-verifier");
    await expect(restoreSession()).resolves.toBe(false);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires fresh agreement when the terms version changes", async () => {
    seedSession();
    sessionStorage.setItem("jammming_terms_version", "old");
    await expect(restoreSession()).resolves.toBe(false);
    expect(sessionStorage.length).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("prevents a delayed refresh from restoring logout credentials", async () => {
    seedSession({ expiresAt: 0 });
    const response = deferred();
    fetch.mockReturnValue(response.promise);
    const pending = refreshAccessToken();
    const check = expect(pending).rejects.toMatchObject({ code: "operation_cancelled" });
    logout();
    response.resolve(jsonResponse({ access_token: "stale", refresh_token: "stale-refresh", expires_in: 3600 }));
    await check;
    expect(sessionStorage.length).toBe(0);
    await expect(restoreSession()).resolves.toBe(false);
  });
  it.each([200, 400])("ignores an old refresh response (%s) after a new login", async status => {
    seedSession({ expiresAt: 0 });
    const response = deferred();
    fetch.mockReturnValue(response.promise);
    const check = expect(refreshAccessToken()).rejects.toMatchObject({ code: "operation_cancelled" });
    await getAuthUrl({ acceptedTerms: true });
    seedSession({ token: "new-session", refresh: "new-refresh" });
    response.resolve(jsonResponse(status === 200 ? { access_token: "stale", expires_in: 3600 } : { error: "invalid_grant" }, status));
    await check;
    expect(sessionStorage.getItem("spotify_access_token")).toBe("new-session");
    expect(sessionStorage.getItem("spotify_refresh_token")).toBe("new-refresh");
  });
  it("does not let old refresh cleanup clear a new in-flight refresh", async () => {
    seedSession({ expiresAt: 0 });
    const old = deferred(), fresh = deferred();
    fetch.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const oldCheck = expect(refreshAccessToken()).rejects.toMatchObject({ code: "operation_cancelled" });
    logout();
    seedSession({ expiresAt: 0 });
    const current = refreshAccessToken();
    await oldCheck;
    expect(refreshAccessToken()).toBe(current);
    fresh.resolve(jsonResponse({ access_token: "fresh", expires_in: 3600 }));
    await current;
    old.resolve(jsonResponse({ access_token: "old", expires_in: 3600 }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not let old code-exchange cleanup erase new PKCE state", async () => {
    await getAuthUrl({ acceptedTerms: true });
    const old = deferred();
    fetch.mockReturnValue(old.promise);
    const check = expect(exchangeCodeForToken("old-code")).rejects.toMatchObject({ code: "operation_cancelled" });
    const next = new URL(await getAuthUrl({ acceptedTerms: true }));
    await check;
    old.resolve(jsonResponse({ access_token: "old", expires_in: 3600 }));
    expect(sessionStorage.getItem("spotify_oauth_state")).toBe(next.searchParams.get("state"));
    expect(sessionStorage.getItem("spotify_code_verifier")).toBeTruthy();
    expect(sessionStorage.getItem("spotify_access_token")).toBeNull();
  });
  it("rejects a pending login challenge after logout", async () => {
    const challenge = deferred();
    vi.spyOn(window.crypto.subtle, "digest").mockReturnValue(challenge.promise);
    const check = expect(getAuthUrl({ acceptedTerms: true })).rejects.toMatchObject({ code: "operation_cancelled" });
    logout();
    challenge.resolve(new Uint8Array(32).buffer);
    await check;
    expect(sessionStorage.length).toBe(0);
  });
  it("reports blocked storage actionably", async () => {
    vi.spyOn(sessionStorage, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    await expect(restoreSession()).rejects.toMatchObject({ code: "storage_unavailable", message: expect.stringMatching(/Try demo/) });
  });
});
