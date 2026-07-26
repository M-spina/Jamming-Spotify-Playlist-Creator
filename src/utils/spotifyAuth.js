const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SCOPES = "user-read-private playlist-modify-public";
const AUTH_SESSION_VERSION = "2026-public-playlist-v1";
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

const STORAGE_KEYS = {
    accessToken: "spotify_access_token",
    refreshToken: "spotify_refresh_token",
    expiresAt: "spotify_token_expires_at",
    legacyExpiresAt: "spotify_token_expires_in",
    sessionVersion: "spotify_auth_session_version",
    codeVerifier: "spotify_code_verifier",
    oauthState: "spotify_oauth_state",
};

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
    }
}

function getSpotifyConfig() {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim();
    const redirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI?.trim();
    const missingVariables = [];

    if (!clientId) missingVariables.push("VITE_SPOTIFY_CLIENT_ID");
    if (!redirectUri) missingVariables.push("VITE_SPOTIFY_REDIRECT_URI");

    if (missingVariables.length > 0) {
        throw new SpotifyConfigurationError(
            `Missing Spotify configuration: ${missingVariables.join(", ")}. Check your .env file.`,
        );
    }

    return { clientId, redirectUri };
}

function generateRandomString(byteLength) {
    const bytes = new Uint8Array(byteLength);
    window.crypto.getRandomValues(bytes);

    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);

    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function readResponseBody(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

function getTokenErrorMessage(body, fallbackMessage) {
    return body.error_description || body.error?.message || body.error || fallbackMessage;
}

function storeTokenResponse(data) {
    if (!data.access_token || !data.expires_in) {
        throw new SpotifyAuthError("Spotify returned an incomplete token response.", "invalid_token_response");
    }

    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
    localStorage.setItem(
        STORAGE_KEYS.expiresAt,
        String(Date.now() + data.expires_in * 1000),
    );
    localStorage.removeItem(STORAGE_KEYS.legacyExpiresAt);
    localStorage.setItem(STORAGE_KEYS.sessionVersion, AUTH_SESSION_VERSION);

    if (data.refresh_token) {
        localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
    }
}

export function clearOAuthTransientState() {
    sessionStorage.removeItem(STORAGE_KEYS.codeVerifier);
    sessionStorage.removeItem(STORAGE_KEYS.oauthState);
    localStorage.removeItem(STORAGE_KEYS.codeVerifier);
}

export function logout() {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.expiresAt);
    localStorage.removeItem(STORAGE_KEYS.legacyExpiresAt);
    localStorage.removeItem(STORAGE_KEYS.sessionVersion);
    clearOAuthTransientState();
}

export async function getAuthUrl() {
    const { clientId, redirectUri } = getSpotifyConfig();
    const codeVerifier = generateRandomString(64);
    const oauthState = generateRandomString(32);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // A fresh authorization replaces any stale or unusable stored session.
    logout();
    sessionStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);
    sessionStorage.setItem(STORAGE_KEYS.oauthState, oauthState);

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        code_challenge_method: "S256",
        code_challenge: codeChallenge,
        state: oauthState,
        scope: SCOPES,
    });

    return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export function validateOAuthState(receivedState) {
    const expectedState = sessionStorage.getItem(STORAGE_KEYS.oauthState);
    sessionStorage.removeItem(STORAGE_KEYS.oauthState);

    if (!receivedState || !expectedState || receivedState !== expectedState) {
        clearOAuthTransientState();
        throw new SpotifyAuthError(
            "Spotify login could not be verified. Please try authorizing again.",
            "oauth_state_mismatch",
        );
    }
}

export async function exchangeCodeForToken(code) {
    const { clientId, redirectUri } = getSpotifyConfig();
    const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.codeVerifier);

    if (!codeVerifier) {
        throw new SpotifyAuthError(
            "The Spotify login session has expired. Please authorize again.",
            "missing_code_verifier",
        );
    }

    try {
        const response = await fetch(TOKEN_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: clientId,
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier,
            }),
        });
        const body = await readResponseBody(response);

        if (!response.ok) {
            throw new SpotifyAuthError(
                getTokenErrorMessage(body, "Spotify token exchange failed."),
                body.error || "token_exchange_failed",
            );
        }

        storeTokenResponse(body);
        return body;
    } finally {
        clearOAuthTransientState();
    }
}

async function performRefresh() {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);

    if (!refreshToken) {
        throw new ReauthorizationRequiredError("Authorize with Spotify to continue.");
    }

    const { clientId } = getSpotifyConfig();
    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: clientId,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });
    const body = await readResponseBody(response);

    if (!response.ok) {
        if (body.error === "invalid_grant") {
            logout();
            throw new ReauthorizationRequiredError();
        }

        throw new SpotifyAuthError(
            getTokenErrorMessage(body, "Spotify token refresh failed."),
            body.error || "token_refresh_failed",
        );
    }

    storeTokenResponse(body);
    return body;
}

export async function refreshAccessToken() {
    if (!refreshInFlight) {
        refreshInFlight = performRefresh().finally(() => {
            refreshInFlight = null;
        });
    }

    return refreshInFlight;
}

export function hasValidAccessToken() {
    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.expiresAt));

    return Boolean(token && expiresAt && Date.now() + TOKEN_EXPIRY_BUFFER_MS < expiresAt);
}

export function hasRefreshToken() {
    return Boolean(localStorage.getItem(STORAGE_KEYS.refreshToken));
}

export async function restoreSession() {
    const hasStoredCredentials = Boolean(
        localStorage.getItem(STORAGE_KEYS.accessToken)
        || localStorage.getItem(STORAGE_KEYS.refreshToken),
    );
    const hasCurrentAuthorization = (
        localStorage.getItem(STORAGE_KEYS.sessionVersion) === AUTH_SESSION_VERSION
    );

    if (hasStoredCredentials && !hasCurrentAuthorization) {
        logout();
        return false;
    }

    if (hasValidAccessToken()) return true;
    if (!hasRefreshToken()) return false;

    await refreshAccessToken();
    return true;
}

export async function getAccessToken({ forceRefresh = false } = {}) {
    if (forceRefresh || !hasValidAccessToken()) {
        await refreshAccessToken();
    }

    const token = localStorage.getItem(STORAGE_KEYS.accessToken);
    if (!token) {
        throw new ReauthorizationRequiredError("Authorize with Spotify to continue.");
    }

    return token;
}
