# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Media Hub is a local, TV-friendly dashboard (Angular 21 standalone SPA) for media, websites, and frequently used tools. Users create groups and shortcuts, customize colors/icons/layout, and everything is persisted client-side only (localStorage) — there is no backend.

Coding-style conventions (naming, formatting, commit style) are documented in [AGENTS.md](AGENTS.md) — read it alongside this file.

## Commands

Requires Node.js 24 LTS and npm 11 (enforced by `engines` in `package.json`).

```bash
npm ci                        # install exact lockfile dependencies
npm start                     # dev server at http://localhost:4200
npm test -- --watch=false     # run the full Vitest suite once
npm run build                 # production build (enforces Angular budgets)
npm run serve:prod            # serve dist/media-hub/browser at http://127.0.0.1:4173
```

- Tests use Angular's `@angular/build:unit-test` builder with Vitest and jsdom. There is no separate lint script or `ng lint`.
- To run a single spec file: `ng test -- src/app/core/url-resolver.spec.ts` (or open Vitest watch mode with `npm test` and filter interactively).
- Format before submitting broad changes: `npx prettier --write <files>` (100-char print width, single quotes, Angular parser for `*.html`, configured in `.prettierrc`).
- Windows install/uninstall scripts (`scripts/windows/install.ps1`, `uninstall.ps1`) build the app, copy it to `%LOCALAPPDATA%\MediaHub`, and register autostart via `start-media-hub.ps1` + `server.mjs` (a small static file server with a `/health` endpoint and path-traversal guard). These are user-facing deployment tools, not part of the normal dev loop.

## Architecture

**Single-component app.** There is effectively one Angular component, `App` (`src/app/app.ts`, `app.html`, `app.scss`), that renders the entire dashboard: search bar, group/shortcut grid, edit-mode drag-and-drop, and all side panels (add/edit shortcut, add/edit group, settings). It is intentionally not decomposed into child components — forms, keyboard handling, drag-and-drop, and rendering all live here. When making UI changes, expect to work in this one large file/template pair rather than hunting for sub-components.

**State flows one way through `MediaHubStore`** (`src/app/core/media-hub.store.ts`), a signal-based store (`providedIn: 'root'`):
- `configState` is the single source of truth (`MediaHubConfig`: settings + groups + shortcuts). All mutations go through `commit()`, which stamps `updatedAt`, persists via `ConfigRepository`, and updates the signal.
- `groups`, `settings`, `editMode`, `toast` are derived/exposed as readonly signals/computed values.
- An `effect()` in the constructor syncs `settings().theme` to the `data-theme` attribute on `<html>` for CSS theming.
- Every mutating method (`addGroup`, `upsertShortcut`, `reorderGroups`, etc.) also calls `notify()` to surface a transient toast message (auto-clears after ~3.2s) and drives the ARIA live region.

**Persistence and validation** (`src/app/core/`):
- `config-repository.ts` reads/writes `localStorage` under `media-hub.config`, keeping a `media-hub.config.backup` copy on every save. On load, if the primary value fails schema validation it falls back to the backup, then to `createDefaultConfig()` — surfacing a "recovered" flag the store turns into a toast.
- `config-schema.ts` defines the Zod schemas (`mediaHubConfigSchema`, `exportEnvelopeSchema`) that are the actual contract for what a valid config/export file looks like — this is the place to change when the data model evolves, and both `ConfigRepository.save()` and JSON import (`parseExport`) re-validate through it. Duplicate group/shortcut IDs are rejected via `superRefine`.
- `models.ts` holds the plain TypeScript types (`MediaHubConfig`, `HubGroup`, `Shortcut`, `IconConfig`, `ExportEnvelope`, etc.) — keep these in sync with the Zod schema by hand, they are not derived from it.
- `default-config.ts` builds the seed configuration (4 default groups) shown on first run or after "reset".
- `url-resolver.ts` centralizes all URL trust decisions: `resolve()` decides whether free-form input is a URL or a search query, `safeHttpUrl()`/`normalizeHttpUrl()` reject anything except `http:`/`https:` with no embedded credentials. This is the only place shortcut/search navigation targets get built — never construct navigation URLs elsewhere.
- `website-icon-resolver.ts` builds Google's favicon-proxy URL for the "use website icon" option, routed through `UrlResolver` so it inherits the same safety checks.

**Config versioning:** `MediaHubConfig.schemaVersion` is currently pinned to `1`. Import/export wraps the config in an `ExportEnvelope` (`format`, `exportVersion`, `exportedAt`, `config`) validated by `exportEnvelopeSchema`. Bumping either version number requires updating both the Zod schema and the corresponding type in `models.ts`, plus migration/back-compat handling in `ConfigRepository`/import — there is none today because there's only ever been one version.

**Everything client-side, security-conscious by design:** no backend, no user HTML/SVG injection, colors/icons are constrained enums or regex-validated hex/Font Awesome classes, and URLs are always funneled through `UrlResolver`. Treat any new user-controlled input the same way — validate through Zod in `config-schema.ts` and never bypass `UrlResolver` for anything that becomes an `href`/`window.location`/`window.open` target.

**Editing UX conventions worth knowing:**
- Edit mode (toggled with `E`) enables drag-and-drop reordering (`@angular/cdk/drag-drop`) for both groups and shortcuts, plus keyboard reordering via arrow keys on the drag handles.
- `/` focuses the search bar; `Esc` closes open side panels (with an unsaved-changes confirm via `window.confirm` if the active form is dirty).
- Arrow-key spatial navigation (`spatialNavigate` in `app.ts`) moves focus between `[data-focusable]` elements based on geometric position, independent of DOM order — needed for the grid layout's non-linear tab order.
- Side panels (shortcut/group/settings) share one `panel` signal (`PanelKind`) and one focus-return mechanism (`lastTrigger`) rather than being separate components/routes.

## Testing conventions

Tests live beside their implementation as `*.spec.ts` (e.g. `src/app/core/url-resolver.spec.ts`). Describe observable behavior — URL rejection, persistence recovery, rendered DOM — rather than implementation details. Every bug fix should include a focused regression test when practical. Since there's no separate component tree, most UI-behavior tests exercise `App` directly through its rendered template (see `app.spec.ts`). Visually verify panel scrolling and both themes (dark/light) for any layout-sensitive change — run both `npm test` and `npm run build` after UI or state changes.
