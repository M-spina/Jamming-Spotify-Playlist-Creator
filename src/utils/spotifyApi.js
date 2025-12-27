import { getAccessToken } from "./spotifyAuth";
const API_BASE_URL = 'https://api.spotify.com/v1';

// Search for tracks
export async function searchTracks(query) {
    if (!query.trim()) return [];

    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/search?type=track&q=${encodeURIComponent(query)}&limit=10`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error('Search request failed');
    }

    const data = await response.json();
    return data.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map(artist => artist.name).join(', '),
        album: track.album.name,
        uri: track.uri
    }));
}
// Get user profile (for playlist creation)
export async function getUserProfile() {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/me`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user profile');
    }

    return await response.json();
}

// Create a new playlist
export async function createPlaylist(userId, name) {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/users/${userId}/playlists`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            public: false
        })
    });

    if (!response.ok) {
        throw new Error('Failed to create playlist');
    }

    return await response.json();
}

// Add tracks to a playlist
export async function addTracksToPlaylist(playlistId, trackUris) {
    if(!Array.isArray(trackUris) || trackUris.length === 0) {
        throw new Error('No track URIs provided');
    }
    
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uris: trackUris
        })
    });

    if (!response.ok) {
        throw new Error('Failed to add tracks to playlist');
    }

    return await response.json();
}