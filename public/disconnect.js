const keys = ["spotify_access_token", "spotify_refresh_token", "spotify_token_expires_at", "spotify_token_expires_in", "spotify_auth_session_version", "spotify_code_verifier", "spotify_oauth_state", "jammming_terms_version"];
document.getElementById("local-logout").addEventListener("click", () => {
  let cleared = true;
  for (const key of keys) {
    try { sessionStorage.removeItem(key); } catch { cleared = false; }
    try { localStorage.removeItem(key); } catch { cleared = false; }
  }
  document.getElementById("logout-status").textContent = cleared
    ? "Local credentials cleared in this tab. Use Spotify's Apps page to remove account-level permission."
    : "Browser storage could not be cleared. Clear this site's data in your browser settings.";
});
