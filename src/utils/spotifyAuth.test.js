import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAuthUrl,
  ReauthorizationRequiredError,
  restoreSession,
  SpotifyConfigurationError,
  validateOAuthState,
} from "./spotifyAuth";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Spotify authentication utilities", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SPOTIFY_CLIENT_ID", "client-id");
    vi.stubEnv("VITE_SPOTIFY_REDIRECT_URI", "http://127.0.0.1:5173/callback");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("builds a PKCE URL with state and the minimum required scopes", async () => {
    const authUrl = new URL(await getAuthUrl());

    expect(authUrl.searchParams.get("client_id")).toBe("client-id");
    expect(authUrl.searchParams.get("state")).toBeTruthy();
    expect(authUrl.searchParams.get("code_challenge")).toBeTruthy();
    expect(authUrl.searchParams.get("scope")).toBe(
      "user-read-private playlist-modify-public",
    );
    expect(authUrl.searchParams.get("scope")).not.toContain("playlist-modify-private");
    expect(sessionStorage.getItem("spotify_oauth_state")).toBe(
      authUrl.searchParams.get("state"),
    );
    expect(sessionStorage.getItem("spotify_code_verifier")).toBeTruthy();
  });

  it("rejects missing environment configuration", async () => {
    vi.stubEnv("VITE_SPOTIFY_CLIENT_ID", "");

    await expect(getAuthUrl()).rejects.toBeInstanceOf(SpotifyConfigurationError);
  });

  it("accepts and consumes a matching OAuth state", () => {
    sessionStorage.setItem("spotify_oauth_state", "expected");

    expect(() => validateOAuthState("expected")).not.toThrow();
    expect(sessionStorage.getItem("spotify_oauth_state")).toBeNull();
  });

  it("rejects a mismatched OAuth state and clears transient PKCE data", () => {
    sessionStorage.setItem("spotify_oauth_state", "expected");
    sessionStorage.setItem("spotify_code_verifier", "verifier");

    expect(() => validateOAuthState("wrong")).toThrow(/could not be verified/i);
    expect(sessionStorage.getItem("spotify_oauth_state")).toBeNull();
    expect(sessionStorage.getItem("spotify_code_verifier")).toBeNull();
  });

  it("restores a session from an unexpired access token without refreshing", async () => {
    localStorage.setItem("spotify_access_token", "current-token");
    localStorage.setItem("spotify_token_expires_at", String(Date.now() + 120_000));
    localStorage.setItem("spotify_auth_session_version", "2026-public-playlist-v1");

    await expect(restoreSession()).resolves.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes an expired session and stores a rotated refresh token", async () => {
    localStorage.setItem("spotify_refresh_token", "old-refresh");
    localStorage.setItem("spotify_auth_session_version", "2026-public-playlist-v1");
    fetch.mockResolvedValue(jsonResponse({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires_in: 3600,
    }));

    await expect(restoreSession()).resolves.toBe(true);

    expect(localStorage.getItem("spotify_access_token")).toBe("new-access");
    expect(localStorage.getItem("spotify_refresh_token")).toBe("new-refresh");
    expect(Number(localStorage.getItem("spotify_token_expires_at"))).toBeGreaterThan(Date.now());
  });

  it("clears credentials and requires reauthorization for invalid_grant", async () => {
    localStorage.setItem("spotify_access_token", "expired");
    localStorage.setItem("spotify_refresh_token", "expired-refresh");
    localStorage.setItem("spotify_auth_session_version", "2026-public-playlist-v1");
    fetch.mockResolvedValue(jsonResponse({
      error: "invalid_grant",
      error_description: "Refresh token expired",
    }, 400));

    await expect(restoreSession()).rejects.toBeInstanceOf(ReauthorizationRequiredError);

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("spotify_access_token")).toBeNull();
    expect(localStorage.getItem("spotify_refresh_token")).toBeNull();
  });

  it("keeps the refresh token for a transient token-endpoint failure", async () => {
    localStorage.setItem("spotify_refresh_token", "still-valid");
    localStorage.setItem("spotify_auth_session_version", "2026-public-playlist-v1");
    fetch.mockResolvedValue(jsonResponse({
      error: "temporarily_unavailable",
      error_description: "Try again later",
    }, 503));

    await expect(restoreSession()).rejects.toMatchObject({
      code: "temporarily_unavailable",
      message: "Try again later",
    });
    expect(localStorage.getItem("spotify_refresh_token")).toBe("still-valid");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("clears a stored session that predates the required public-playlist scope", async () => {
    localStorage.setItem("spotify_access_token", "old-scope-token");
    localStorage.setItem("spotify_refresh_token", "old-scope-refresh");
    localStorage.setItem("spotify_token_expires_at", String(Date.now() + 120_000));

    await expect(restoreSession()).resolves.toBe(false);

    expect(localStorage.getItem("spotify_access_token")).toBeNull();
    expect(localStorage.getItem("spotify_refresh_token")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
