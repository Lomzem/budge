# What can an iOS PWA do in 2026?

Type: research
Status: resolved
Blocked by: 

## Question

What can a PWA installed from Safari on iOS do as of 2026: home-screen install and standalone display, web push, storage limits and eviction, service worker behaviour, safe-area and viewport handling, and known quirks? What is the recommended SvelteKit PWA tooling (for example @vite-pwa/sveltekit or SvelteKit's built-in service worker) and how does it interact with Convex's live connection?

## Answer

**An installed Safari web app is a viable iPhone client with no Mac or Apple Developer account.**

- **Install:** Safari → Share → Add to Home Screen → Open as Web App. There's no install prompt API, so Budge shows brief in-app instructions. Since iOS 26 any site can open as a web app; Budge still ships a manifest (`id`, `name`, `start_url`, `scope`, `display: standalone`, colors) plus 192/512 PNG icons and a 180×180 `apple-touch-icon`.
- **Service worker:** not needed for an online-only v1. Start with the manifest only, and add a minimal SvelteKit `src/service-worker` only for push or deliberate asset caching. Never cache Convex or Clerk traffic, replay mutations, or serve stale budget data. `@vite-pwa/sveltekit` is unnecessary.
- **Push:** Web Push works for Home Screen apps on iOS 16.4+ (VAPID; no Apple membership), with permission requested from a user gesture. Delivery isn't guaranteed.
- **Storage:** installed apps get browser-level quotas and are exempt from the 7-day ITP purge, but local storage is disposable. Convex stays the only real copy.
- **Auth:** the installed app has its own cookie jar, separate from Safari after install. Clerk session persistence and token refresh after the app has been in the background must be tested on a real iPhone against the production domain.
- **Layout:** use `viewport-fit=cover` with `env(safe-area-inset-*)`, and a status-bar style chosen with dark mode in mind.

Findings: `docs/research/ios-pwa.md` on branch `research/ios-pwa` (commit `ec9b247`).
