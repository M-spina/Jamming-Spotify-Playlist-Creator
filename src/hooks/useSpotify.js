import { useState } from "react";
import { searchTracks, getUserProfile, createPlaylist, addTracksToPlaylist } from "../utils/spotifyApi";

export function useSpotify(isAuth) {
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (query) => {
        if (!isAuth || !query.trim()) return;
        setLoading(true);
        setError(null);
        try{
            const results = await searchTracks(query);
            setSearchResults(results);
        } catch (err) {
            setError(`Search Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const createPlaylistFromTracks = async (playlistName, selectedTracks) => {
        if (!isAuth || !selectedTracks || selectedTracks.length === 0) return;
        setLoading(true);
        setError(null);
        try{
            const user = await getUserProfile();
            const playlist = await createPlaylist(user.id, playlistName);
            const uris = selectedTracks.map(track => track.uri);
            await addTracksToPlaylist(playlist.id, uris);
            setSearchResults([]); // Clear search results after creating playlist
        } catch (err) {
            setError(`Playlist Creation Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return {
        searchResults,
        loading,
        error,
        handleSearch,
        createPlaylistFromTracks
    };
}