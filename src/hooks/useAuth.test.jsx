import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "./useAuth";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useAuth startup flow", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SPOTIFY_CLIENT_ID", "client-id");
    vi.stubEnv("VITE_SPOTIFY_REDIRECT_URI", "http://127.0.0.1:5173/callback");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("exchanges a verified callback and removes OAuth parameters", async () => {
    sessionStorage.setItem("spotify_oauth_state", "matching-state");
    sessionStorage.setItem("spotify_code_verifier", "code-verifier");
    window.history.replaceState(
      {},
      "",
      "/callback?code=code-1&state=matching-state&ubi=spotify-transient-data",
    );
    fetch.mockResolvedValue(jsonResponse({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
    }));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(window.location.pathname).toBe("/callback");
    expect(window.location.search).toBe("");
    expect(localStorage.getItem("spotify_access_token")).toBe("access-token");
    expect(sessionStorage.getItem("spotify_code_verifier")).toBeNull();
  });

  it("rejects a callback with mismatched state and cleans the URL", async () => {
    sessionStorage.setItem("spotify_oauth_state", "expected");
    sessionStorage.setItem("spotify_code_verifier", "code-verifier");
    window.history.replaceState({}, "", "/callback?code=code-1&state=wrong");

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.error).toMatch(/could not be verified/i);
    expect(window.location.search).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("prompts for reauthorization after startup refresh returns invalid_grant", async () => {
    localStorage.setItem("spotify_refresh_token", "expired-refresh");
    localStorage.setItem("spotify_auth_session_version", "2026-public-playlist-v1");
    fetch.mockResolvedValue(jsonResponse({
      error: "invalid_grant",
      error_description: "Refresh token expired",
    }, 400));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.error).toMatch(/authorization has expired/i);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("spotify_refresh_token")).toBeNull();
  });
});
