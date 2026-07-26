import { useCallback, useEffect, useState } from "react";
import {
    clearOAuthTransientState,
    exchangeCodeForToken,
    getAuthUrl,
    logout,
    restoreSession,
    SpotifyAuthError,
    validateOAuthState,
} from "../utils/spotifyAuth";

const INITIAL_AUTH_STATE = {
    status: "loading",
    error: null,
};

function clearAuthCallbackParams() {
    const url = new URL(window.location.href);
    window.history.replaceState(
        {},
        document.title,
        `${url.pathname}${url.hash}`,
    );
}

export function useAuth() {
    const [authState, setAuthState] = useState(INITIAL_AUTH_STATE);

    useEffect(() => {
        let cancelled = false;

        async function initializeAuth() {
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");
            const errorParam = params.get("error");
            const returnedState = params.get("state");
            const hasCallback = Boolean(code || errorParam);

            try {
                if (hasCallback) {
                    validateOAuthState(returnedState);

                    if (errorParam) {
                        clearOAuthTransientState();
                        throw new SpotifyAuthError(
                            `Spotify authorization was not completed: ${errorParam}.`,
                            errorParam,
                        );
                    }

                    await exchangeCodeForToken(code);
                    if (!cancelled) {
                        setAuthState({ status: "authenticated", error: null });
                    }
                    return;
                }

                const restored = await restoreSession();
                if (!cancelled) {
                    setAuthState({
                        status: restored ? "authenticated" : "unauthenticated",
                        error: null,
                    });
                }
            } catch (error) {
                if (!cancelled) {
                    setAuthState({
                        status: "unauthenticated",
                        error: error instanceof Error
                            ? error.message
                            : "Spotify authentication failed.",
                    });
                }
            } finally {
                if (hasCallback) clearAuthCallbackParams();
            }
        }

        void initializeAuth();

        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async () => {
        setAuthState({ status: "loading", error: null });

        try {
            const url = await getAuthUrl();
            window.location.assign(url);
        } catch (error) {
            setAuthState({
                status: "unauthenticated",
                error: error instanceof Error ? error.message : "Spotify login failed.",
            });
        }
    }, []);

    const handleLogout = useCallback(() => {
        logout();
        setAuthState({ status: "unauthenticated", error: null });
    }, []);

    const invalidateSession = useCallback((error) => {
        logout();
        setAuthState({
            status: "unauthenticated",
            error: error instanceof Error
                ? error.message
                : "Your Spotify authorization has expired. Authorize again to continue.",
        });
    }, []);

    return {
        status: authState.status,
        isAuthenticated: authState.status === "authenticated",
        error: authState.error,
        login,
        logout: handleLogout,
        invalidateSession,
    };
}
