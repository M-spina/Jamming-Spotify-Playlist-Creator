import { useEffect, useRef, useState } from "react";
import { playlistProviders, PlaylistSaveError } from "../utils/playlistProviders";
import { demoTracks } from "../utils/demoApi";
import { getSpotifyRetryDelay } from "../utils/spotifyApi";
import { ReauthorizationRequiredError } from "../utils/spotifyAuth";
import { assertNotCancelled, isCancellation, OperationCancelledError } from "../utils/request";
export { PlaylistSaveError } from "../utils/playlistProviders";

export function useSpotify(mode, onAuthInvalidated) {
  const [searchResults, setSearchResults] = useState(() => mode === "demo" ? demoTracks.slice(0, 10) : []);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [retryDelay, setRetryDelay] = useState(0);
  const operations = useRef({ search: null, save: null });
  useEffect(() => {
    const active = operations.current;
    return () => {
      active.search?.abort();
      active.save?.abort();
      active.search = null;
      active.save = null;
    };
  }, [mode]);
  useEffect(() => {
    if (!retryDelay) return;
    const timer = setTimeout(() => setRetryDelay(getSpotifyRetryDelay()), 1000);
    return () => clearTimeout(timer);
  }, [retryDelay]);

  function invalidate(error) {
    if (!(error instanceof ReauthorizationRequiredError)) return false;
    resetSpotifyState();
    onAuthInvalidated(error);
    return true;
  }
  function updateCooldown(error) {
    const cause = error.cause || error;
    if (cause.retryAfterSeconds != null) setRetryDelay(getSpotifyRetryDelay());
  }
  const provider = playlistProviders[mode];
  async function handleSearch(query) {
    if (!provider || !query.trim() || operations.current.search || operations.current.save || (mode === "spotify" && getSpotifyRetryDelay())) return [];
    const controller = new AbortController();
    operations.current.search = controller;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await provider.searchTracks(query, { signal: controller.signal });
      assertNotCancelled(controller.signal);
      setSearchResults(results);
      return results;
    } catch (error) {
      if (controller.signal.aborted || isCancellation(error)) return [];
      if (!invalidate(error)) {
        updateCooldown(error);
        setSearchError(error.message || "Search failed. Please try again.");
      }
      return [];
    } finally {
      if (operations.current.search === controller) {
        operations.current.search = null;
        setIsSearching(false);
      }
    }
  }
  async function createPlaylistFromTracks(name, tracks) {
    if (!provider) throw new ReauthorizationRequiredError();
    if (operations.current.save || operations.current.search) throw new Error("Wait for the current operation to finish.");
    if (mode === "spotify" && getSpotifyRetryDelay()) throw new Error("Wait for Spotify's retry delay before saving.");
    const controller = new AbortController();
    operations.current.save = controller;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const playlist = await provider.savePlaylist(name, tracks.map(track => ({ ...track })), { signal: controller.signal });
      assertNotCancelled(controller.signal);
      if (operations.current.save !== controller) throw new OperationCancelledError();
      setSaveStatus({
        type: "success", playlist,
        message: mode === "demo"
          ? `Simulated save: "${playlist.name}". Nothing was sent to Spotify.`
          : `"${playlist.name || name.trim()}" was saved to Spotify.`,
      });
      if (mode === "spotify") setSearchResults([]);
      return playlist;
    } catch (error) {
      if (controller.signal.aborted || isCancellation(error)) throw new OperationCancelledError();
      if (invalidate(error)) throw error;
      updateCooldown(error);
      const cause = error.cause || error;
      let message = cause.message || "Saving failed. Please try again.";
      if (error instanceof PlaylistSaveError) {
        if (error.stage === "add-items") {
          message = `Spotify created the playlist, but not every track was confirmed added. ${message} Check Spotify before retrying because another playlist may be created.`;
        } else if (error.outcomeUnknown) {
          message = "We couldn’t confirm whether Spotify created the playlist. Check Spotify before retrying. " + message;
        } else {
          message = "Spotify could not create the playlist. " + message;
        }
      }
      setSaveStatus({ type: "error", message, playlist: error.playlist || null });
      throw error;
    } finally {
      if (operations.current.save === controller) {
        operations.current.save = null;
        setIsSaving(false);
      }
    }
  }
  function resetSpotifyState() {
    operations.current.search?.abort();
    operations.current.save?.abort();
    operations.current.search = null;
    operations.current.save = null;
    setSearchResults([]);
    setSearchError(null);
    setSaveStatus(null);
    setIsSearching(false);
    setIsSaving(false);
    setRetryDelay(0);
  }
  return { searchResults, isSearching, isSaving, searchError, saveStatus, retryDelay, handleSearch, createPlaylistFromTracks, resetSpotifyState };
}
