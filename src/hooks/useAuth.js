import { useState, useEffect } from "react";
import { getAuthUrl, exchangeCodeForToken, isAuthenticated, logout } from "../utils/spotifyAuth";

export function useAuth() {
    const [isAuth, setIsAuth] = useState(isAuthenticated());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

     // Handle callback on mount
    useEffect(() =>{
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const errorParam = params.get('error');

        if (errorParam) {
            setError(`Authentication Error: ${errorParam}`);
        }
        if (code && !isAuth) {
            setLoading(true);
            exchangeCodeForToken(code)
                .then(() => {
                    setIsAuth(true);
                    setError(null);
                    // Clear URL params
                    window.history.replaceState({}, document.title, window.location.pathname);
                })
                .catch((err) => {
                    setError(`Token Exchange Error: ${err.message}`);
                })
                .finally(() => {
                    setLoading(false);
                });

        }

    },[isAuth]);

    const login = async () =>{
        setLoading(true);
        try {
            const url = await getAuthUrl();
            window.location.href = url; // Redirect to Spotify
        } catch (err) {
            setError(`Login Error: ${err.message}`);
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        setIsAuth(false);
        setError(null);
    };

    return { isAuth, loading, error, login, logout: handleLogout };
}