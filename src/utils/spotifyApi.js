import { getAccessToken } from "./spotifyAuth";

const API_BASE_URL = "https://api.spotify.com/v1";

export class SpotifyApiError extends Error {
    constructor(operation, status, message) {
        super(message);
        this.name = "SpotifyApiError";
        this.operation = operation;
        this.status = status;
    }
}

async function getApiErrorMessage(response, fallbackMessage) {
    try {
        const body = await response.json();
        return body.error?.message || fallbackMessage;
    } catch {
        return fallbackMessage;
    }
}

async function spotifyFetch(path, options, operation) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const token = await getAccessToken({ forceRefresh: attempt === 1 });
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...options?.headers,
            },
        });

        if (response.status === 401 && attempt === 0) {
            continue;
        }

        if (!response.ok) {
            const message = await getApiErrorMessage(
                response,
                `Spotify ${operation} request failed.`,
            );
            throw new SpotifyApiError(operation, response.status, message);
        }

        return response;
    }

    throw new SpotifyApiError(operation, 401, "Spotify authorization failed.");
}

export async function searchTracks(query) {
    if (!query.trim()) return [];

    const response = await spotifyFetch(
        `/search?type=track&q=${encodeURIComponent(query)}&limit=10`,
        {},
        "search",
    );
    const data = await response.json();

    return (data.tracks?.items ?? []).map((track) => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map((artist) => artist.name).join(", "),
        album: track.album.name,
        uri: track.uri,
    }));
}

export async function createPlaylist(name) {
    const response = await spotifyFetch(
        "/me/playlists",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name,
                public: true,
            }),
        },
        "create playlist",
    );

    return response.json();
}

export async function addItemsToPlaylist(playlistId, itemUris) {
    if (!Array.isArray(itemUris) || itemUris.length === 0) {
        throw new SpotifyApiError("add playlist items", 0, "No Spotify item URIs were provided.");
    }

    if (itemUris.length > 100) {
        throw new SpotifyApiError(
            "add playlist items",
            0,
            "Spotify accepts at most 100 playlist items per request.",
        );
    }

    const response = await spotifyFetch(
        `/playlists/${encodeURIComponent(playlistId)}/items`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: itemUris }),
        },
        "add playlist items",
    );

    return response.json();
}
