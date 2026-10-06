import { useCallback, useEffect, useState } from "react";
import {
  assertAuthSession, captureAuthSession, clearOAuthTransientState,
  exchangeCodeForToken, getAuthUrl, isCurrentAuthSession, logout,
  removeLegacyCredentials, restoreSession, SpotifyAuthError, validateOAuthState,
} from "../utils/spotifyAuth";
import { isCancellation } from "../utils/request";

export function useAuth() {
  const [authState, setAuthState] = useState({ status: "loading", error: null });
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function initialize() {
      let expected = captureAuthSession();
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorParam = params.get("error");
      const hasCallback = Boolean(code || errorParam);
      // Remove authorization codes before subsequent external navigation.
      if (hasCallback) window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      try {
        removeLegacyCredentials();
        if (hasCallback) {
          validateOAuthState(params.get("state"));
          if (errorParam) {
            clearOAuthTransientState();
            throw new SpotifyAuthError("Spotify authorization was not completed. You can try again or use Try demo.", "authorization_denied");
          }
          await exchangeCodeForToken(code, { signal: controller.signal });
        } else {
          const restored = await restoreSession({ signal: controller.signal });
          if (!restored) expected = captureAuthSession();
          assertAuthSession(expected, controller.signal);
          if (!cancelled) setAuthState({ status: restored ? "authenticated" : "unauthenticated", error: null });
          return;
        }
        assertAuthSession(expected, controller.signal);
        if (!cancelled) setAuthState({ status: "authenticated", error: null });
      } catch (error) {
        if (cancelled || isCancellation(error)) return;
        // invalid_grant deliberately invalidates the generation itself.
        if (!isCurrentAuthSession(expected) && error.authSession !== captureAuthSession()) return;
        logout();
        setAuthState({ status: "unauthenticated", error: error.message || "Spotify authentication failed." });
      }
    }
    void initialize();
    return () => { cancelled = true; controller.abort(); };
  }, []);

  const login = useCallback(async (acceptedTerms) => {
    setAuthState({ status: "loading", error: null });
    const pending = getAuthUrl({ acceptedTerms });
    const expected = captureAuthSession();
    try {
      const url = await pending;
      assertAuthSession(expected);
      window.location.assign(url);
    } catch (error) {
      if (isCancellation(error) || (!isCurrentAuthSession(expected) && error.authSession !== captureAuthSession())) return;
      setAuthState({ status: "unauthenticated", error: error.message || "Spotify login failed." });
    }
  }, []);
  const handleLogout = useCallback(() => {
    const cleared = logout();
    setAuthState({
      status: "unauthenticated",
      error: cleared ? null : "Browser storage is unavailable. Clear this site's browser data to remove stored credentials.",
    });
  }, []);
  const invalidateSession = useCallback((error) => {
    logout();
    setAuthState({ status: "unauthenticated", error: error.message || "Authorize with Spotify again to continue." });
  }, []);
  return {
    status: authState.status, isAuthenticated: authState.status === "authenticated",
    error: authState.error, login, logout: handleLogout, invalidateSession,
  };
}
