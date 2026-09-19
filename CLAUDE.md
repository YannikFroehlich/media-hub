# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Media Hub is a local, TV-friendly dashboard (Angular 22 standalone SPA) for media, websites, and frequently used tools. Users create groups and shortcuts, customize colors/icons/layout, and everything is persisted client-side only (localStorage) — there is no backend.

Coding-style conventions (naming, formatting, commit style) are documented in [AGENTS.md](AGENTS.md) — read it alongside this file.

## Commands

Requires Node.js 24 LTS and npm 11 (enforced by `engines` in `package.json`).

```bash
npm ci                        # install exact lockfile dependencies
npm start                     # dev server at http://localhost:4200
npm test -- --watch=false     # run the full Vitest suite once
npm run build                 # production build (enforces Angular budgets)
npm run serve:prod            # serve dist/media-hub/browser at http://127.0.0.1:4173
npm run electron:dev          # build + launch the Windows tray app locally
npm run electron:pack         # build + package a portable Windows .exe (release/)
npm run electron:smoke        # launch the packaged .exe headlessly and verify it boots
```

- Tests use Angular's `@angular/build:unit-test` builder with Vitest and jsdom. There is no separate lint script or `ng lint`. The one exception is `scripts/windows/server.mjs`, covered by `scripts/windows/server.test.mjs` via Node's built-in test runner (`node --test scripts/windows/server.test.mjs`) since that script lives outside `src/` and isn't part of the Angular/Vitest project.
- To run a single spec file: `ng test -- src/app/core/url-resolver.spec.ts` (or open Vitest watch mode with `npm test` and filter interactively).
- Format before submitting broad changes: `npx prettier --write <files>` (100-char print width, single quotes, Angular parser for `*.html`, configured in `.prettierrc`).
- `scripts/windows/server.mjs` is a small dependency-free static file server (`/health` endpoint, path-traversal guard, SPA fallback) exposing `startServer`/`stopServer`. It's used two ways: directly via `npm run serve:prod` for a local production preview, and as an importable module consumed by the Electron tray app in `electron/main.mjs`. Cache-control is asset-aware, not blanket: hashed build files (`main-*.js`, `styles-*.css`, …) get a year-long immutable cache, but fixed-name entry points listed in `NEVER_CACHE_LONG` (`index.html`, `ngsw.json`, `ngsw-worker.js`, `manifest.webmanifest`) always get `no-cache` — required for the service worker's update detection (and even initial registration) to work at all. Keep any new fixed-name entry point in that set.
- The Windows deployment path is an Electron tray application (`electron/main.mjs`), not PowerShell scripts. It has no visible window — a tray icon offers "Dashboard öffnen" (opens the system default browser at the served URL), an autostart checkbox backed by `app.setLoginItemSettings`, and "Beenden" (stops the embedded server gracefully, then quits). Packaging config lives in `electron-builder.yml` (portable, no-admin `.exe` target). These are user-facing deployment tools, not part of the normal dev loop.

## Architecture

**Shell plus a few leaf components.** `App` (`src/app/app.ts`, `app.html`) is the shell: search bar, group/shortcut grid, edit-mode drag-and-drop, global keyboard handling, timers, the side-panel frame (`aside`, backdrop, focus trap, header) and the confirm dialog. The panel bodies are child components in `src/app/panels/` — `ShortcutPanel`, `GroupPanel`, `SettingsPanel` — each owning its own Reactive Form, validation and error message; `src/app/screensaver/` holds the `Screensaver` overlay. Children are `OnPush` and use `display: contents` as host so the global panel CSS (`src/styles/`) still applies unchanged; `App` stays `Eager`. Panels talk back through outputs only: `closed(force)` (force skips the dirty check), `GroupPanel.deleteRequested` (deletion is shared with the dashboard's delete button, so `App` owns it) and `SettingsPanel.applied` (App re-runs weather/sun-time/visual-effect refreshes). `App` reads each panel's public `form` via `viewChild` for the unsaved-changes check. Shared icon/color presets and helpers live in `core/icons.ts`; the inline confirmation dialog is driven by `ConfirmService` (`core/confirm.service.ts`) — use `confirm.request(message, label)` instead of `window.confirm`.

**State flows one way through `MediaHubStore`** (`src/app/core/media-hub.store.ts`), a signal-based store (`providedIn: 'root'`):

- `configState` is the single source of truth (`MediaHubConfig`: `activeProfileId` + a list of `Profile`s, each with its own settings + groups + shortcuts). All mutations go through `commit()`, which stamps `updatedAt`, persists via `ConfigRepository`, and updates the signal.
- `activeProfile` is a computed that resolves `activeProfileId` against `profiles`; `groups` and `settings` are computed from `activeProfile()` rather than straight off `configState()`. Group/shortcut mutators (`addGroup`, `upsertShortcut`, `reorderGroups`, etc.) go through a private `updateActiveProfile()` helper so they always write into the currently active profile. Profile management itself (`switchProfile`, `addProfile`, `renameProfile`, `deleteProfile`) lives entirely in the Settings panel — there's no separate topbar switcher, since the settings `aside` already traps focus while open.
- `groups`, `settings`, `profiles`, `activeProfileId`, `editMode`, `toast` are derived/exposed as readonly signals/computed values.
- `effectiveTheme` is a computed that returns `settings().theme` normally, or — when `settings().autoTheme` is on — derives light/dark from an internal `clockTick` signal (ticking every 60s) against today's sunrise/sunset (`sunTimesState`, epoch ms, fed by `app.ts`'s `refreshSunTimes()` via `setSunTimes()` whenever a geocoded location — `weatherLat`/`weatherLon` — is available), falling back to a fixed 7–20-Uhr window when no location is set. An `effect()` in the constructor syncs `effectiveTheme()` (not the raw setting) to the `data-theme` attribute on `<html>`, along with `visualStyle`/`displayMode`/liquid-glass CSS vars, for CSS theming.
- Every mutating method (`addGroup`, `upsertShortcut`, `reorderGroups`, etc.) also calls `notify()` to surface a transient toast message (auto-clears after ~3.2s) and drives the ARIA live region.

**Persistence and validation** (`src/app/core/`):

- `config-repository.ts` reads/writes `localStorage` under `media-hub.config`, keeping a `media-hub.config.backup` copy on every save. On load, if the primary value fails schema validation it falls back to the backup, then to `createDefaultConfig()` — surfacing a "recovered" flag the store turns into a toast.
- `config-schema.ts` defines the Zod schemas (`mediaHubConfigSchema`, `exportEnvelopeSchema`) that are the actual contract for what a valid config/export file looks like — this is the place to change when the data model evolves, and both `ConfigRepository.save()` and JSON import (`parseExport`) re-validate through it. Duplicate group/shortcut IDs are rejected via `superRefine`.
- `models.ts` holds the plain TypeScript types (`MediaHubConfig`, `HubGroup`, `Shortcut`, `IconConfig`, `ExportEnvelope`, etc.) — keep these in sync with the Zod schema by hand, they are not derived from it.
- `default-config.ts` builds the seed configuration (4 default groups) shown on first run or after "reset".
- `url-resolver.ts` centralizes all URL trust decisions: `resolve()` decides whether free-form input is a URL or a search query (a leading `SEARCH_PREFIXES` keyword such as `yt`, `wiki`, `ddg`, `g`, `maps` routes the rest of the input to that engine), `safeHttpUrl()`/`normalizeHttpUrl()` reject anything except `http:`/`https:` with no embedded credentials. This is the only place shortcut/search navigation targets get built — never construct navigation URLs elsewhere.
- `website-icon-resolver.ts` builds Google's favicon-proxy URL for the "use website icon" option, routed through `UrlResolver` so it inherits the same safety checks.

**Config versioning:** `MediaHubConfig.schemaVersion` is currently pinned to `2` (v1 had a single `settings`+`groups` pair at the top level; v2 wraps one or more named `Profile`s, each with its own `settings`+`groups`, behind `activeProfileId`). Import/export wraps the config in an `ExportEnvelope` (`format`, `exportVersion`, `exportedAt`, `config`) validated by `exportEnvelopeSchema` — the envelope format itself hasn't changed, only what's nested inside `config`. `mediaHubConfigSchema` in `config-schema.ts` is a `z.discriminatedUnion('schemaVersion', [v2Schema, v1Schema])` followed by a `.transform()` that wraps a v1 config into a single `'Standard'` profile, so old exports/backups keep loading. Bumping either version number again requires the same treatment: update the Zod schema and the corresponding type in `models.ts`, and add another migration branch here.

**Everything client-side, security-conscious by design:** no backend, no user HTML/SVG injection, colors/icons are constrained enums or regex-validated hex/Font Awesome classes, and URLs are always funneled through `UrlResolver`. Treat any new user-controlled input the same way — validate through Zod in `config-schema.ts` and never bypass `UrlResolver` for anything that becomes an `href`/`window.location`/`window.open` target.

**Editing UX conventions worth knowing:**

- Edit mode (toggled with `E`) enables drag-and-drop reordering (`@angular/cdk/drag-drop`) for both groups and shortcuts, plus keyboard reordering via arrow keys on the drag handles.
- `/` focuses the search bar; `Esc` closes open side panels (with an unsaved-changes confirm via `ConfirmService` if the active form is dirty), the keyboard-help overlay, and the weather forecast popover.
- Arrow-key spatial navigation (`spatialNavigate` in `app.ts`) moves focus between `[data-focusable]` elements based on geometric position, independent of DOM order — needed for the grid layout's non-linear tab order.
- Side panels (shortcut/group/settings) share one `panel` signal (`PanelKind`) and one focus-return mechanism (`lastTrigger`) in `App`; the panel components are recreated on every open and initialise their form from the store in `ngOnInit`.
- `1`–`9` open the n-th enabled shortcut of `visibleGroups` (so they follow the search filter); disabled while the search input is focused and in edit mode.
- Gamepads (`core/gamepad.ts`, standard mapping) are replayed as synthetic `keydown` events on the focused element — D-pad/left stick = arrows, A = Enter (clicks if nothing handled it), B = Escape — so they reuse all keyboard handling. Arrows are ignored inside side panels.
- Typing in the search bar live-filters the dashboard via `visibleGroups` (a computed in `app.ts`), matching group or shortcut names. It's intentionally bypassed whenever `editMode()` is true, returning the full, unfiltered `store.groups()` — that's what keeps `cdkDrag`/`cdkDropList` index-based reordering correct. Never let a filtered/derived array reach the drag-and-drop bindings.
- A single `armCursorIdleTimer()` in `app.ts` is the one place "the user is active" gets handled: on every call it resets the 3s cursor-hide timer _and_ re-arms a 5-minute screensaver timer (`screensaverActive`, a full-screen clock/weather overlay, dismissed by any click/keydown/mousemove). Keyboard/gamepad input only re-arms the screensaver timer (`armScreensaverTimer()`), so it never un-hides the cursor. Add new activity-driven behavior here rather than introducing a parallel timer. Optional `settings.screensaverImages` (≤ 20 http(s) URLs, Zod-validated) are cycled every 30s behind the clock, only fetched while the overlay is visible, and skipped once they fail to load.

**Weather** (`src/app/core/weather.service.ts`, `WeatherService`): wraps Open-Meteo's free, keyless geocoding + forecast endpoints with plain `fetch` (no `HttpClient` anywhere in the app). A city name is geocoded when settings are saved and either the weather widget or auto-theme is enabled (`weatherLat`/`weatherLon` persisted in `GlobalSettings`, shared by both features); `app.ts` refreshes the current-plus-5-day forecast periodically and on save. `getSunTimes()` is a separate, lightweight Open-Meteo call (`daily=sunrise,sunset` only) so auto-theme's sunrise/sunset can be resolved independently of the weather widget being on. Weather data is intentionally _not_ covered by the service worker — see PWA below.

**PWA / offline app shell:** scaffolded via `ng add @angular/pwa` — `ngsw-config.json`, `public/manifest.webmanifest`, `public/icons/`, and `provideServiceWorker(...)` in `app.config.ts` (disabled via `isDevMode()`, so exercise it through `npm run serve:prod`/the packaged Electron app, not `npm start`). It precaches the app shell (JS/CSS/HTML) for offline use; it deliberately does not cache the Open-Meteo weather responses, which stay live-network-only. See the `scripts/windows/server.mjs` cache-control note above — it's the other half of making the service worker actually work.

## Testing conventions

Tests live beside their implementation as `*.spec.ts` (e.g. `src/app/core/url-resolver.spec.ts`). Describe observable behavior — URL rejection, persistence recovery, rendered DOM — rather than implementation details. Every bug fix should include a focused regression test when practical. Most UI-behavior tests exercise `App` (with its child panels) through the rendered template (see `app.spec.ts`), so keep panel CSS classes stable. Visually verify panel scrolling and both themes (dark/light) for any layout-sensitive change — run both `npm test` and `npm run build` after UI or state changes.
