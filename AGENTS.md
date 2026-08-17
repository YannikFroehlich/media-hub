# Repository Guidelines

## Project Structure & Module Organization

Media Hub is an Angular 21 standalone SPA. Application bootstrap files live in `src/main.ts` and `src/app/app.config.ts`. The primary dashboard component is split across `src/app/app.ts`, `app.html`, and global styling in `src/styles.scss`. Domain models, validation, persistence, URL handling, defaults, and signal-based state belong in `src/app/core/`. Keep unit tests beside their implementation as `*.spec.ts`. Static brand assets and favicons live under `public/`; Windows installation and local-server utilities live in `scripts/windows/`. Production output is generated in `dist/media-hub/browser/` and must not be committed.

## Build, Test, and Development Commands

Use Node.js 24 LTS and npm 11.

- `npm ci` installs the exact lockfile dependencies.
- `npm start` runs the development server at `http://localhost:4200`.
- `npm test -- --watch=false` runs the Vitest suite once.
- `npm run build` creates an optimized production build and enforces Angular budgets.
- `npm run serve:prod` serves the latest production build at `http://127.0.0.1:4173`.

## Coding Style & Naming Conventions

Use strict TypeScript, Angular signals for shared reactive state, and Reactive Forms for editors. Indent with two spaces, use single quotes in TypeScript, and keep lines near the Prettier limit of 100 characters. Run `npx prettier --write <files>` before submitting broad formatting changes. Use kebab-case filenames, PascalCase classes/interfaces, camelCase members, and descriptive suffixes such as `Store`, `Repository`, or `Resolver`. Keep user-provided values validated through Zod or focused resolver methods; never inject user HTML or SVG.

## Testing Guidelines

Tests use Angular's test builder, Vitest, and jsdom. Name tests `*.spec.ts` and describe observable behavior, for example URL rejection, persistence recovery, or rendered controls. No coverage threshold is configured; every bug fix should include a focused regression test when practical. Run both the test suite and production build after UI or state changes. Visually verify panel scrolling and both themes for layout-sensitive changes.

## Commit & Pull Request Guidelines

The history currently contains only `initial commit`, so no established convention exists. Use concise, imperative commits; optional scoped prefixes are encouraged, for example `fix(panel): keep footer anchored`. Pull requests should explain the user-visible change, list verification performed, link related issues, and include before/after screenshots for visual work. Call out local-storage schema changes and keep unrelated refactors separate.
