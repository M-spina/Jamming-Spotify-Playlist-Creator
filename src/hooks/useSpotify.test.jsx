import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../utils/spotifyApi", async importOriginal => ({
  ...await importOriginal(), searchTracks: vi.fn(), createPlaylist: vi.fn(), addItemsToPlaylist: vi.fn(),
}));
import { searchTracks, createPlaylist, addItemsToPlaylist, SpotifyApiError } from "../utils/spotifyApi";
import { logout, ReauthorizationRequiredError } from "../utils/spotifyAuth";
import { realTracks, deferred } from "../test/fixtures";
import { useSpotify } from "./useSpotify";

describe("playlist operations and cancellation", () => {
  beforeEach(() => {
    logout();
    searchTracks.mockResolvedValue([]);
    createPlaylist.mockResolvedValue({ id: "playlist-1", name: "Test Mix" });
    addItemsToPlaylist.mockResolvedValue({ snapshot_id: "snapshot" });
  });
  it("confirms success only after ordered 100-item batches finish", async () => {
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    await act(async () => { await result.current.createPlaylistFromTracks(" Mix ", realTracks(101)); });
    expect(createPlaylist.mock.calls[0][0]).toBe("Mix");
    expect(addItemsToPlaylist.mock.calls.map(call => call[1].length)).toEqual([100, 1]);
    expect(result.current.saveStatus.type).toBe("success");
  });
  it("reports explicit rejection without claiming an unknown response succeeded", async () => {
    createPlaylist.mockRejectedValue(new SpotifyApiError("create playlist", 403, "Denied"));
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    await act(async () => { await expect(result.current.createPlaylistFromTracks("Mix", realTracks())).rejects.toMatchObject({ stage: "create" }); });
    expect(result.current.saveStatus.message).toMatch(/could not create/);
    expect(addItemsToPlaylist).not.toHaveBeenCalled();
  });
  it("reports uncertain creation without asserting nothing was created", async () => {
    createPlaylist.mockRejectedValue(new SpotifyApiError("create playlist", 0, "Timed out", { outcomeUnknown: true }));
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    await act(async () => { await expect(result.current.createPlaylistFromTracks("Mix", realTracks())).rejects.toMatchObject({ outcomeUnknown: true }); });
    expect(result.current.saveStatus.message).toMatch(/couldn’t confirm whether Spotify created/);
    expect(result.current.saveStatus.message).not.toMatch(/not created/);
  });
  it("reports a partial upload with the known playlist", async () => {
    addItemsToPlaylist.mockRejectedValue(new Error("Upload failed"));
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    await act(async () => { await expect(result.current.createPlaylistFromTracks("Mix", realTracks())).rejects.toMatchObject({ stage: "add-items" }); });
    expect(result.current.saveStatus.playlist.id).toBe("playlist-1");
    expect(result.current.saveStatus.message).toMatch(/Check Spotify before retrying/);
  });
  it("invalidates expired authorization", async () => {
    const error = new ReauthorizationRequiredError(), invalidated = vi.fn();
    createPlaylist.mockRejectedValue(error);
    const { result } = renderHook(() => useSpotify("spotify", invalidated));
    await act(async () => { await expect(result.current.createPlaylistFromTracks("Mix", realTracks())).rejects.toBe(error); });
    expect(invalidated).toHaveBeenCalledWith(error);
    expect(result.current.saveStatus).toBeNull();
  });
  it.each(["success", "failure"])("ignores stale search %s after resetting", async outcome => {
    const pending = deferred();
    searchTracks.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    let task;
    act(() => { task = result.current.handleSearch("old"); });
    act(() => result.current.resetSpotifyState());
    await act(async () => {
      if (outcome === "success") pending.resolve(realTracks());
      else pending.reject(new Error("Old failure"));
      await task;
    });
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchError).toBeNull();
    expect(result.current.isSearching).toBe(false);
  });
  it("does not let an old search's cleanup finish a new search", async () => {
    const old = deferred(), fresh = deferred();
    searchTracks.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    let oldTask, freshTask;
    act(() => { oldTask = result.current.handleSearch("old"); });
    act(() => result.current.resetSpotifyState());
    act(() => { freshTask = result.current.handleSearch("fresh"); });
    await act(async () => { old.resolve(realTracks()); await oldTask; });
    expect(result.current.isSearching).toBe(true);
    await act(async () => { fresh.resolve([]); await freshTask; });
    expect(result.current.isSearching).toBe(false);
  });
  it.each(["create", "batch"])("stops all later batches after logout during %s", async stage => {
    const pending = deferred();
    if (stage === "create") createPlaylist.mockReturnValue(pending.promise);
    else addItemsToPlaylist.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    let task;
    await act(async () => { task = result.current.createPlaylistFromTracks("Mix", realTracks(201)); await Promise.resolve(); });
    const check = expect(task).rejects.toMatchObject({ code: "operation_cancelled" });
    act(() => { result.current.resetSpotifyState(); logout(); });
    await act(async () => { pending.resolve(stage === "create" ? { id: "old" } : { snapshot_id: "old" }); await check; });
    expect(addItemsToPlaylist).toHaveBeenCalledTimes(stage === "create" ? 0 : 1);
    expect(result.current.saveStatus).toBeNull();
    expect(result.current.isSaving).toBe(false);
  });
  it("cancels save on unmount and rejects its stale completion", async () => {
    const pending = deferred();
    createPlaylist.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useSpotify("spotify", vi.fn()));
    let task;
    act(() => { task = result.current.createPlaylistFromTracks("Mix", realTracks()); });
    const check = expect(task).rejects.toMatchObject({ code: "operation_cancelled" });
    unmount();
    pending.resolve({ id: "old" });
    await check;
    expect(addItemsToPlaylist).not.toHaveBeenCalled();
  });
  it("prevents same-tick double saving", async () => {
    const pending = deferred();
    createPlaylist.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    let first;
    act(() => { first = result.current.createPlaylistFromTracks("Mix", realTracks()); });
    await expect(result.current.createPlaylistFromTracks("Mix", realTracks())).rejects.toThrow(/current operation/);
    await act(async () => { pending.resolve({ id: "playlist" }); await first; });
    expect(createPlaylist).toHaveBeenCalledTimes(1);
  });
  it("rejects fictional tracks before contacting Spotify", async () => {
    const { result } = renderHook(() => useSpotify("spotify", vi.fn()));
    await act(async () => { await expect(result.current.createPlaylistFromTracks("Mix", [{ source: "demo", id: "demo-1" }])).rejects.toThrow(/real Spotify tracks/); });
    expect(createPlaylist).not.toHaveBeenCalled();
  });
});
