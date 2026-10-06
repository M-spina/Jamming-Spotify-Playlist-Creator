import { describe, expect, it } from "vitest";
import { safeSpotifyUrl } from "./spotifyLinks";
describe("Spotify content links", () => {
  it.each(["javascript:alert(1)", "https://open.spotify.com.evil.test/track/abc", "http://open.spotify.com/track/abc", "https://user@open.spotify.com/track/abc", "https://open.spotify.com:8080/track/abc", "/track/abc"])("rejects unsafe URL %s", value => expect(safeSpotifyUrl(value)).toBeNull());
  it("accepts a Spotify HTTPS track link", () => expect(safeSpotifyUrl("https://open.spotify.com/track/abc")).toBe("https://open.spotify.com/track/abc"));
});
