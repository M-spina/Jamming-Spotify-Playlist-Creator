const CLIENT_ID = "d9f0cd887da5421495a9ab3b9ebecdcd";
const REDIRECT_URI = "http://127.0.0.1:5173/callback";
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SCOPES = 'playlist-modify-public playlist-modify-private user-read-private';

// Generate a random code verifier (43-128 chars, URL-safe)
function generateCodeVerifier() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

}

// Generate code challenge from verifier (SHA256 hash, base64url encoded)
async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Build the authorization URL
async function getAuthUrl() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store verifier in localStorage for later use
    localStorage.setItem('spotify_code_verifier', codeVerifier);

    const params = new URLSearchParams({
        client_id:CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        scope: SCOPES
    })
    return `${AUTH_ENDPOINT}?${params.toString()}`;
}

// Exchange authorization code for access token
async function exchangeCodeForToken(code) {
    const verifier = localStorage.getItem('spotify_code_verifier');

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier
        }),
    });

    if (!response.ok) {
        throw new Error('Token exchange failed');
    };

    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
    localStorage.setItem('spotify_token_expires_in', Date.now() + (data.expires_in * 1000)); 
    localStorage.removeItem('spotify_code_verifier');


    return data
}

// Refresh the access token using the refresh token
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) {
        throw new Error('No refresh token available');
    }

    const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        }),
    });

    if (!response.ok) {
        throw new Error('Token refresh failed');
    }

    const data = await response.json();
    localStorage.setItem('spotify_access_token', data.access_token);
    localStorage.setItem('spotify_token_expires_in', Date.now() + (data.expires_in * 1000));
    if(data.refresh_token) {
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
    }

    return data;
}

// Get the current access token, refreshing if expired
async function getAccessToken() {
    const token = localStorage.getItem('spotify_access_token');
    const expiresIn = localStorage.getItem('spotify_token_expires_in');

    if(!token || !expiresIn || Date.now() > parseInt(expiresIn)) {
        await refreshAccessToken();
        return localStorage.getItem('spotify_access_token');
    }
    return token;
}

// Check if user is authenticated (has valid token)
function isAuthenticated() {
    const token = localStorage.getItem('spotify_access_token');
    const expiresIn = localStorage.getItem('spotify_token_expires_in');
    
    return token && expiresIn && Date.now() < parseInt(expiresIn);
}

// Logout: Clear all stored auth data
function logout() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    localStorage.removeItem('spotify_token_expires_in');
    localStorage.removeItem('spotify_code_verifier');
}


export { getAuthUrl, exchangeCodeForToken, refreshAccessToken, getAccessToken, isAuthenticated, logout };