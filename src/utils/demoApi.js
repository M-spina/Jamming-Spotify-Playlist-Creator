import { assertNotCancelled } from "./request";

export const demoTracks = [
  ["Glass Horizon", "Signal Bloom", "Afterglow"],
  ["City Lanterns", "Night Harbour", "Midnight Maps"],
  ["Paper Satellites", "Juniper Arcade", "Small Worlds"],
  ["Slow Orbit", "Signal Bloom", "Afterglow"],
  ["Last Train Home", "Night Harbour", "Midnight Maps"],
  ["Garden Radio", "Juniper Arcade", "Small Worlds"],
  ["Blue Hour", "Signal Bloom", "Afterglow"],
  ["Tidal Streets", "Night Harbour", "Midnight Maps"],
  ["Polaroid Summer", "Juniper Arcade", "Small Worlds"],
  ["Northern Lights", "Signal Bloom", "Afterglow"],
  ["Window Seat", "Night Harbour", "Midnight Maps"],
  ["Sunday Static", "Juniper Arcade", "Small Worlds"],
].map(([name, artist, album], index) => ({ source: "demo", id: `demo-${index + 1}`, name, artist, album }));

export const demoProvider = {
  async searchTracks(query, { signal } = {}) {
    assertNotCancelled(signal);
    const term = query.trim().toLowerCase();
    return demoTracks.filter(track => [track.name, track.artist, track.album].some(value => value.toLowerCase().includes(term))).slice(0, 10);
  },
  async savePlaylist(name, tracks, { signal } = {}) {
    assertNotCancelled(signal);
    await Promise.resolve();
    assertNotCancelled(signal);
    if (!name.trim() || !tracks.length || tracks.some(track => track.source !== "demo")) throw new Error("Choose fictional demo tracks and a playlist name.");
    return { source: "demo", name: name.trim(), tracks: tracks.map(track => ({ ...track })), simulated: true };
  },
};
