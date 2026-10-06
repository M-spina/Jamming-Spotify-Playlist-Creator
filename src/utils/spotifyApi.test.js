import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./spotifyAuth", async importOriginal => ({ ...await importOriginal(), getAccessToken: vi.fn() }));
import { getAccessToken, logout } from "./spotifyAuth";
import { addItemsToPlaylist, createPlaylist, searchTracks, getSpotifyRetryDelay } from "./spotifyApi";
import { deferred, jsonResponse, realTracks } from "../test/fixtures";

describe("Spotify API contracts and failures", () => {
  beforeEach(() => { logout(); getAccessToken.mockResolvedValue("access-token"); vi.stubGlobal("fetch", vi.fn()); });
  afterEach(() => vi.useRealTimers());
  it("creates an explicitly public playlist with its content link", async () => {
    const id = "a".repeat(22);
    fetch.mockResolvedValue(jsonResponse({ id, name: "Road Trip", external_urls: { spotify: "https://open.spotify.com/playlist/" + id } }, 201));
    const playlist = await createPlaylist("Road Trip");
    expect(fetch).toHaveBeenCalledWith("https://api.spotify.com/v1/me/playlists", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Road Trip", public: true }) }));
    expect(playlist.spotifyUrl).toBe("https://open.spotify.com/playlist/" + id);
  });
  it("uses the playlist items endpoint and preserves item order", async () => {
    fetch.mockResolvedValue(jsonResponse({ snapshot_id: "snapshot" }, 201));
    const uris = realTracks(2).map(track => track.uri);
    await addItemsToPlaylist("playlist/with spaces", uris);
    expect(fetch).toHaveBeenCalledWith("https://api.spotify.com/v1/playlists/playlist%2Fwith%20spaces/items", expect.objectContaining({ method: "POST", body: JSON.stringify({ uris }) }));
  });
  it.each([0,101])("rejects invalid batch size %s before a request", async count => {
    await expect(addItemsToPlaylist("playlist", Array(count).fill("spotify:track:item"))).rejects.toMatchObject({ code: "invalid_items" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retries just once after an explicit 401", async () => {
    fetch.mockResolvedValueOnce(jsonResponse({},401)).mockResolvedValueOnce(jsonResponse({ tracks: { items: [] } }));
    await searchTracks("test");
    expect(getAccessToken).toHaveBeenNthCalledWith(1, expect.objectContaining({ forceRefresh: false }));
    expect(getAccessToken).toHaveBeenNthCalledWith(2, expect.objectContaining({ forceRefresh: true }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("requires fresh authorization after repeated 401", async () => {
    fetch.mockResolvedValue(jsonResponse({},401));
    await expect(searchTracks("test")).rejects.toMatchObject({ code: "reauthorization_required" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("explains a 403 without asserting allowlisting is the only cause", async () => {
    fetch.mockResolvedValue(jsonResponse({},403));
    await expect(searchTracks("test")).rejects.toMatchObject({ code: "access_denied", status: 403, message: expect.stringMatching(/permissions or app availability.*Try demo/) });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("honours Retry-After without issuing more requests", async () => {
    vi.useFakeTimers();
    fetch.mockResolvedValueOnce(jsonResponse({},429,{ "Retry-After": "3" })).mockResolvedValue(jsonResponse({ tracks: { items: [] } }));
    await expect(searchTracks("test")).rejects.toMatchObject({ retryAfterSeconds: 3 });
    expect(getSpotifyRetryDelay()).toBe(3);
    await expect(createPlaylist("Mix")).rejects.toMatchObject({ status: 429 });
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    await searchTracks("test");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([null,"nonsense"])("handles missing or invalid Retry-After (%s)", async value => {
    fetch.mockResolvedValue(jsonResponse({},429,value === null ? {} : {"Retry-After":value}));
    await expect(searchTracks("test")).rejects.toMatchObject({ code: "rate_limited", retryAfterSeconds: null, message: expect.stringMatching(/try again later/i) });
    expect(getSpotifyRetryDelay()).toBe(0);
  });
  it("recognizes Spotify quota failures", async () => {
    fetch.mockResolvedValue(jsonResponse({error:{reason:"QUOTA_EXCEEDED"}},429));
    await expect(searchTracks("test")).rejects.toMatchObject({ message: expect.stringMatching(/quota.*Try demo/) });
  });
  it("retains track URLs and skips unavailable items", async () => {
    const id = "a".repeat(22);
    fetch.mockResolvedValue(jsonResponse({tracks:{items:[null,{id,name:"Song",uri:"spotify:track:"+id,artists:[{name:"Artist"}],album:{name:"Album"},external_urls:{spotify:"https://open.spotify.com/track/"+id}}]}}));
    await expect(searchTracks("Song")).resolves.toEqual([{source:"spotify",id,name:"Song",uri:"spotify:track:"+id,artist:"Artist",album:"Album",spotifyUrl:"https://open.spotify.com/track/"+id}]);
  });
  it.each([500,502,503])("does not retry a write with an uncertain %s result", async status => {
    fetch.mockResolvedValue(jsonResponse({},status));
    await expect(createPlaylist("Mix")).rejects.toMatchObject({outcomeUnknown:true});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("treats a lost creation response as uncertain", async () => {
    fetch.mockRejectedValue(new TypeError("Lost response"));
    await expect(createPlaylist("Mix")).rejects.toMatchObject({code:"network_error",outcomeUnknown:true});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each(["body","id"])("treats an unreadable creation %s as uncertain", async kind => {
    fetch.mockResolvedValue(kind === "body" ? new Response("unreadable",{status:201}) : jsonResponse({},201));
    await expect(createPlaylist("Mix")).rejects.toMatchObject({code:"invalid_response",outcomeUnknown:true});
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("reports a write timeout and does not retry", async () => {
    vi.useFakeTimers();
    fetch.mockReturnValue(new Promise(() => {}));
    const check=expect(createPlaylist("Mix")).rejects.toMatchObject({code:"request_timeout",outcomeUnknown:true});
    await vi.advanceTimersByTimeAsync(15_000);
    await check;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("cancels a 401 response after logout before refresh or retry", async () => {
    const pending=deferred();
    fetch.mockReturnValue(pending.promise);
    const task=searchTracks("old");
    await Promise.resolve();
    const check=expect(task).rejects.toMatchObject({code:"operation_cancelled"});
    logout();
    pending.resolve(jsonResponse({},401));
    await check;
    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
