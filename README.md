# Jammming — Playlist Builder

Jammming is a responsive React portfolio app. **Try demo** works immediately without a Spotify account, using clearly labelled fictional tracks and simulated saving. Allowlisted testers can also search Spotify and create public, shareable playlists.

## Features

- Account-free demo with local search by track, artist, or album, duplicate-safe selection, removal, and a simulated playlist summary
- Spotify Authorization Code flow with PKCE, one-use OAuth state, and explicit acceptance of versioned App Terms
- Tokens stored in sessionStorage, same-tab reload recovery, and refresh-token rotation
- Logout invalidates pending authentication, search, and save operations
- Public playlist creation through `POST /me/playlists` and ordered item uploads through `POST /playlists/{id}/items`, in batches of up to 100
- Spotify attribution and links beside real track metadata
- Actionable access-denied, rate-limit, timeout, and uncertain-save messages
- Public privacy, terms, and disconnect pages; keyboard-friendly controls and status announcements

## Requirements and setup

Use **Node.js 24** (the CI runtime) and npm. Node 22.13+ is also compatible with the dependency engine requirements.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:5173` and choose **Try demo**. Spotify environment configuration is optional for demo-only use.

For real Spotify integration:

1. Create a Spotify Developer application and register the exact local callback `http://127.0.0.1:5173/callback`. Spotify accepts explicit loopback IPs for local HTTP redirects; do not substitute `localhost`.
2. Copy `.env.example` to `.env` and set your public client ID and redirect URI:
   ```dotenv
   VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
   VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
   ```
3. Add testers in the Developer Dashboard allowlist. Development Mode normally allows up to five authenticated users and requires the app owner to maintain Premium. Existing grandfathered allowances may differ. A user can complete OAuth login and still receive a 403 from the API.
4. Read the policy pages, check agreement to App Terms, and choose **Login with Spotify — allowlisted testers**.

The client ID is a public OAuth identifier. **Never configure a client secret in this browser application.**

## Demo and real saves

Demo tracks, artists, and albums are invented, with no copied Spotify catalogue data, playback, or fabricated Spotify links. Search and simulated save operate entirely in memory, without Spotify requests. Reloading or leaving demo resets its draft and summary. Entering demo logs out the local Spotify session.

Real saving explicitly creates a public, shareable playlist. Track insertion is a separate request and can use several batches. Only confirmed completion clears the draft. A timeout, lost response, or server failure can mean Spotify processed a write without the app receiving confirmation; check Spotify before retrying. A known playlist link is shown when available. Logging out or leaving during a save stops later requests but cannot undo those already processed.

## Commands and checks

```bash
npm test
npm run lint
npm run build
npm audit
npm audit --omit=dev
npm run preview -- --host 127.0.0.1
```

CI runs a clean `npm ci`, tests, lint, build, and both audits on Node 24 for pull requests and pushes to main. Its GitHub token has read-only repository permissions.

The test suite covers authentication generations and delayed responses after logout/new login, stale search/save completions, ordered batching and cancellation, current terms acceptance, legacy storage removal, blocked storage, deadlines including body reading, rate-limit cooldowns, safe links, and the end-to-end fictional demo.

## Authentication, privacy, and disconnecting

Tokens, expiry, authorization version, terms version, and temporary OAuth state/PKCE verifier are stored in **sessionStorage**, never newly written to localStorage. Known legacy localStorage keys are deleted on startup, with fresh authorization required. State/verifier are consumed during callbacks. A terms or authorization version change requires fresh agreement and login.

Session storage is readable by JavaScript on this origin; it does not provide HttpOnly protection. Browser session restoration can retain it. Logout and authorization invalidation cancel old work before clearing credentials and account-derived UI data. If storage is blocked, the app reports the problem and directs users to browser site-data controls.

Local logout does not revoke account-level Spotify permission. Read **Disconnect Spotify** and remove the developer app from [Spotify's Apps page](https://www.spotify.com/account/apps/). Use Logout in any other open Jammming tabs too. These actions do not delete playlists already created in Spotify.

Public pages are available without login:

- `/privacy.html`
- `/terms.html`
- `/disconnect.html`

Jammming has no application backend, analytics, or application cookies. Privacy contact uses [public project issues](https://github.com/M-spina/Jamming-Spotify-Playlist-Creator/issues); never post credentials or personal account information.

## Deployment checklist

This change prepares a static application and includes Netlify build settings, the /callback rewrite, and basic response headers. Creating the Netlify project and verifying its actual settings remain deployment steps.

1. Require passing checks and zero current full/production audit findings.
2. Publish only the built `dist` directory through an HTTPS static host. Keep Vite development servers bound locally; `vite preview` is a local verification tool, not a production server.
3. Set `VITE_SPOTIFY_CLIENT_ID` and the exact production HTTPS `VITE_SPOTIFY_REDIRECT_URI` at build time; rebuild when they change. Never set a client secret.
4. Register that exact HTTPS callback in Spotify and configure the host to serve the application for `/callback`, preserving the OAuth query string. Direct requests to the three policy pages must serve their actual HTML files.
5. Register public policy/website URLs in Spotify settings where supported.
6. **Before public deployment**, verify the Privacy Policy's Netlify section against the actual project settings, logs, retention arrangements, cookies, and contact practices.
7. Set suitable hosting headers, including `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and a tested Content Security Policy. Do not export or record OAuth query strings in your own analytics or logs. Netlify infrastructure can receive the callback URL before the app removes its query string; do not promise that browser cleanup erases hosting logs.
8. Verify demo on desktop/mobile with no Spotify account/configuration, and perform real login/search/save/logout with an allowlisted account. Inspect Spotify for partial playlists when testing failed saves.

## Netlify setup after merge

1. Import this GitHub repository into a new Netlify project and choose `main` as the production branch. The committed `netlify.toml` sets Node 24, build command `npm run build`, and publish directory `dist`. It rewrites only `/callback` to the app with HTTP 200; the public policy pages and assets remain real files.
2. Choose a stable production site name or custom domain before configuring Spotify. For example, if the site is `https://your-site.netlify.app`, the callback is **`https://your-site.netlify.app/callback`**. Replace `your-site` with your real site name everywhere.
3. In Netlify's project environment variables, set `VITE_SPOTIFY_CLIENT_ID` to the Spotify app's client ID and `VITE_SPOTIFY_REDIRECT_URI` to that exact callback. Scope them to production/builds where the UI supports it. Both are public build-time configuration; **never add a client secret or Spotify tokens**. Rebuild/redeploy after changing them. Demo works without either value.
4. In Spotify's developer dashboard, add the same exact callback to **Redirect URIs**, and the root URL as **Website** where available. Register `/privacy.html` and `/terms.html` as public policy URLs where supported. Spotify redirects the user's browser here after authorization; this is not an inbound Spotify API server.
5. Keep Deploy Previews and branch deploys demo-only by withholding production Spotify configuration in those contexts. OAuth uses origin-specific session storage: start login on the exact production origin that matches the callback, not a preview URL, domain alias, or HTTP variant.
6. Before publishing, verify optional Web Analytics, Real User Monitoring, snippet injection, split testing, Forms, Identity, and Log Drains are not enabled for this app. Inspect actual browser requests/cookies after deployment. If you enable any optional service, update `public/privacy.html` to name it, describe the data/purpose, recipients, retention, and deletion/contact practices. Standard hosting request processing still exists even with optional analytics disabled.
7. Review Netlify's applicable [data-processing arrangements](https://www.netlify.com/gdpr-ccpa/) and confirm infrastructure-log retention with Netlify when needed. Do not copy an old “30 days” claim without current evidence. The policy distinguishes hosting logs from sessionStorage and explains that Logout cannot remove host logs.
8. After deployment, confirm `/callback` serves the app without a 404 or query-dropping redirect; check `/privacy.html`, `/terms.html`, `/disconnect.html`, response headers, demo, and allowlisted login/search/save/logout. Test with a fresh tab and the exact production URL. Check Spotify before retrying any unconfirmed save.

Netlify Git deployments build automatically after pushes; they do not automatically wait for this repository's GitHub checks. Require passing checks before merging to `main` using GitHub branch protection. `.netlify/` is ignored so future CLI linkage does not enter commits.

References: [Netlify Vite builds](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/), [rewrites](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/), [Web Analytics processing](https://docs.netlify.com/manage/monitoring/web-analytics/how-web-analytics-works/), and [traffic log fields](https://docs.netlify.com/manage/monitoring/log-drains/#traffic-log-output).

## Spotify compatibility

The app retains `user-read-private playlist-modify-public`, a ten-result search limit, `POST /v1/me/playlists`, and `POST /v1/playlists/{id}/items`. Playlist visibility/access should be managed in Spotify; the Web API `public` field is not a confidentiality guarantee.

See [Spotify quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [2026 migration guidance](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [Developer Terms](https://developer.spotify.com/terms), [attribution policy](https://developer.spotify.com/policy), and [redirect requirements](https://developer.spotify.com/documentation/web-api/concepts/redirect_uri).

The white full Spotify logo is the unmodified `Full_Logo_White_RGB.svg` from Spotify's [official logo archive](https://developer.spotify.com/images/guidelines/design/2024-spotify-full-logo.zip). Brand usage follows [Spotify's guidelines](https://developer.spotify.com/documentation/design).

## Technology

React 19, Vite 7, JavaScript, CSS, Spotify Web API, Vitest, and React Testing Library. This is an educational portfolio project using Spotify under its applicable developer terms.
