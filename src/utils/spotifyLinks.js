export function safeSpotifyUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "open.spotify.com" &&
      !url.username && !url.password && !url.port &&
      /^\/(?:intl-[a-z-]+\/)?(?:track|album|playlist)\/[A-Za-z0-9]+\/?$/.test(url.pathname)
      ? url.href : null;
  } catch { return null; }
}
export function spotifyContentUrl(type, id, providedUrl) {
  return safeSpotifyUrl(providedUrl) ||
    (/^[A-Za-z0-9]{22}$/.test(id || "") ? `https://open.spotify.com/${type}/${id}` : null);
}
