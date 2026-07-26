import { useCallback, useState } from "react";
import {
    addItemsToPlaylist,
    createPlaylist,
    searchTracks,
} from "../utils/spotifyApi";
import { ReauthorizationRequiredError } from "../utils/spotifyAuth";

const PLAYLIST_BATCH_SIZE = 100;

export class PlaylistSaveError extends Error {
    constructor(stage, playlist, cause) {
        let message = "Spotify could not create the playlist.";
        if (stage === "add-items") {
            message = "The playlist was created, but Spotify could not add every selected track.";
        }

        super(message, { cause });
        this.name = "PlaylistSaveError";
        this.stage = stage;
        this.playlist = playlist;
    }
}

function getErrorMessage(error, fallbackMessage) {
    return error instanceof Error && error.message ? error.message : fallbackMessage;
}

export function useSpotify(isAuthenticated, onAuthInvalidated) {
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null);

    const invalidateExpiredAuth = useCallback((error) => {
        if (!(error instanceof ReauthorizationRequiredError)) return false;

        setSearchResults([]);
        setSearchError(null);
        setSaveStatus(null);
        onAuthInvalidated(error);
        return true;
    }, [onAuthInvalidated]);

    const handleSearch = async (query) => {
        if (!isAuthenticated || !query.trim() || isSearching) return [];

        setIsSearching(true);
        setSearchError(null);

        try {
            const results = await searchTracks(query);
            setSearchResults(results);
            return results;
        } catch (error) {
            if (!invalidateExpiredAuth(error)) {
                setSearchError(getErrorMessage(error, "Spotify search failed. Please try again."));
            }
            return [];
        } finally {
            setIsSearching(false);
        }
    };

    const createPlaylistFromTracks = async (playlistName, selectedTracks) => {
        if (!isAuthenticated) {
            throw new ReauthorizationRequiredError("Authorize with Spotify to save a playlist.");
        }

        if (!playlistName.trim() || !selectedTracks?.length) {
            throw new PlaylistSaveError("create", null, new Error("A name and tracks are required."));
        }

        if (isSaving) {
            throw new PlaylistSaveError("create", null, new Error("A playlist save is already running."));
        }

        setIsSaving(true);
        setSaveStatus(null);
        let playlist = null;

        try {
            try {
                playlist = await createPlaylist(playlistName.trim());
            } catch (error) {
                if (invalidateExpiredAuth(error)) throw error;
                throw new PlaylistSaveError("create", null, error);
            }

            const uris = selectedTracks.map((track) => track.uri);
            try {
                for (let index = 0; index < uris.length; index += PLAYLIST_BATCH_SIZE) {
                    await addItemsToPlaylist(
                        playlist.id,
                        uris.slice(index, index + PLAYLIST_BATCH_SIZE),
                    );
                }
            } catch (error) {
                if (invalidateExpiredAuth(error)) throw error;
                throw new PlaylistSaveError("add-items", playlist, error);
            }

            setSearchResults([]);
            setSaveStatus({
                type: "success",
                message: `"${playlist.name || playlistName.trim()}" was saved to Spotify.`,
            });
            return playlist;
        } catch (error) {
            if (error instanceof ReauthorizationRequiredError) {
                throw error;
            }

            const causeMessage = getErrorMessage(error.cause, "Please try again.");
            const failureStage = error instanceof PlaylistSaveError ? error.stage : null;
            setSaveStatus({
                type: "error",
                message: failureStage === "add-items"
                    ? `Spotify created the playlist, but not every track was added. ${causeMessage} Check Spotify before retrying because another playlist may be created.`
                    : `The playlist was not created. ${causeMessage}`,
            });
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    const resetSpotifyState = () => {
        setSearchResults([]);
        setSearchError(null);
        setSaveStatus(null);
        setIsSearching(false);
        setIsSaving(false);
    };

    return {
        searchResults,
        isSearching,
        isSaving,
        searchError,
        saveStatus,
        handleSearch,
        createPlaylistFromTracks,
        resetSpotifyState,
    };
}
