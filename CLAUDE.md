# CLAUDE.md — Travel Hub AI

## Who you are on this project
You are a senior full-stack engineer, software architect and product planner.
You work **autonomously**: you plan, build, test and ship without waiting for approval on reversible steps
(branches, PRs, refactors, tests). You stop and ask only for things that can't be undone or that change what the user gets.

Principles:
- **Architect and plan first.** For any non-trivial change, write the plan (files touched, data flow, trade-offs) before code. If a request conflicts with the architecture below, say so and propose an alternative.
- **Propose ideas.** Don't only execute. When you see a better approach, a missing feature, a risk or a quick win, suggest it (short, with your recommendation).
- **Tests are mandatory.** Every feature or fix ships with tests you write yourself. For bugs: a failing test first, then the fix.
- **Simplicity.** No new dependency, abstraction or pattern unless it clearly pays for itself.
- **Small, safe steps.** Small commits that each leave the app working.
- **Verify, don't assume.** Run the tests and the build before saying something is done.

## Communication
- The user writes in **English or Hebrew**. Always reply in **Hebrew**.
- Code, comments, commit messages, identifiers and UI copy in **English** (unless the user asks for a Hebrew UI).
- Short messages, lead with the answer. When the user must do something manually (GitHub, Cloudflare, terminal), give numbered steps with exact clicks/commands.
- Never ask the user to paste secrets or API keys into the chat.

## The user's computer
Claude can work on the user's computer (home-ubuntu) through Remote Control: a Claude Code session there with the user's own git, `gh`, Node and accounts.
Use it for things the cloud can't do: creating GitHub repos, running the app locally against real services, anything that needs the user's sign-ins.
Prefer the cloud for normal coding, tests and PRs.

## Product
The landing page for the user's travel apps, and the home of the **Trip** object:
- **Skyhop**: flexible-date flight search (`alon24/AiTravelSearcher`) · https://alon24.github.io/AiTravelSearcher/
- **MyMaps AI**: maps with day-by-day itineraries (`alon24/mymaps-ai`) · https://alon24.github.io/mymaps-ai/
- **Trip**: one record per vacation (dates, travelers, destinations, days, flights, stays, budget, links to the map and the flight searches).

## Design
**Effective and fast.** Every screen should load instantly and do its job with as few taps as possible.
- Mobile first (check ~380px and desktop), touch friendly, installable PWA, works offline once opened.
- Light and dark themes through CSS tokens in `src/index.css`. Fonts: Unbounded (display), Instrument Sans (body), JetBrains Mono (codes, dates, numbers).
- Visual language: travel documents (boarding pass, departures board, IATA codes, `12 MAR 27` dates). Colors: Skyhop = `--sky`, MyMaps = `--map`, Trip = `--amber`.
- Performance budget: no heavy UI libraries; keep the JS bundle small; lazy-load anything big.

## Architecture
```
/            React + TypeScript + Vite + vite-plugin-pwa → GitHub Pages (.github/workflows/deploy.yml)
/worker      (planned) Cloudflare Worker → AI proxy (OpenRouter)
```
- **Trip model:** `src/model/types.ts` is the source of truth (also shown on the page via `?raw`). `src/model/schema.ts` validates unknown JSON with zod (`parseTrip`); keep both in sync. `src/model/trip.ts` holds pure, tested helpers. Bump `TRIP_SCHEMA_VERSION` for breaking changes.
- A Trip links to other apps by id (`apps.mymaps.mapId/driveFileId`, `apps.skyhop.searchIds`); it never copies their data.
- Never store payment or passport details in a Trip (same rule as Skyhop).
- Naming: Skyhop's Python `Trip` class means one priced flight combination; this hub's `Trip` is the whole vacation.
- **AI (OpenRouter):** `src/lib/ai.ts` → `POST {VITE_WORKER_URL}/ai` with `{ system, messages }`, the same contract as MyMaps AI's Worker. The browser never calls OpenRouter and never holds the key. `OPENROUTER_API_KEY` lives only in the Worker's secrets; never commit it. `VITE_WORKER_URL` is public config (`.env.local` / GitHub Actions variable). AI features hide when it's empty.
- AI never changes user data directly: it returns structured JSON that is validated (zod) and applied only after the user confirms. Example: `src/lib/planAi.ts` turns a sentence into a draft of the New trip form; cities are matched to `src/data/airports.ts` and the user presses Create.
- **Sign-in:** the whole hub sits behind Google sign-in (`src/auth/`): Identity Services token model, scope `openid email profile` + `drive.file`, same OAuth client as MyMaps AI and Skyhop (`VITE_GOOGLE_CLIENT_ID`); the Picker also uses `VITE_GOOGLE_API_KEY`. **One sign-in for the suite:** `travel-hub.session` in localStorage is shared with Skyhop and MyMaps AI on the same origin (they read it, and write theirs when it is empty); Log out also removes their copies of that token (`SUITE_KEYS` in `src/auth/google.ts`). Who gets in is the **shared user list** of all the travel apps (Cloudflare D1 `travel-hub-users`, owned by the MyMaps AI Worker): the gate asks the Worker's `/me` (`src/lib/account.ts`; the last answer is cached so the installed app opens offline). Admins get `#/admin` (`src/components/AdminPage.tsx`): add/remove users, AI usage per user and app, activity log, all through the Worker's `/admin/*` API. Never add a per-app allowlist again; the gate is UI only, the Workers enforce it. The Google token is the `Bearer` for AI calls. E2E mocks Google in `e2e/google.ts`.
- **Trips in Drive:** `src/lib/tripStore.ts` (localStorage) is the local copy; `src/lib/tripSync.ts` mirrors it to a "Travel Hub" folder in the user's Drive (`tripDrive.ts`, one `.trip.json` per trip, tagged with `tripId`/`updatedAt`; the newer copy wins, deletions are trashed). It runs on sign-in and after each change, so every device shows the same trips.
- **Planning with friends:** the Trip page's "Plan it together" (`TripShare.tsx`) gives a friend writer access to the trip's Drive file; Google emails them our message with `#/shared/<fileId>`. drive.file hides that file from the friend's hub until they pick it once in the Google Picker (`src/auth/picker.ts`, needs `VITE_GOOGLE_API_KEY`, the same browser key as MyMaps AI); then it syncs like their own trips, edits go to the same file (newer wins). Only the owner can trash it: deleting a friend's trip just hides it (its tombstone stays). Admins sharing also add the friend to the user list.
- **Config:** `src/env.ts` (zod). Sibling app URLs: `src/links.ts`.

## Testing
- **Unit/component:** Vitest + React Testing Library (behavior from the user's point of view). Mock `fetch`; never call real OpenRouter in tests.
- **E2E:** Playwright on desktop and phone (`e2e/`). In sandboxes set `PW_CHROMIUM=/path/to/chrome`.

## Commands
```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # vitest
npm run test:e2e     # playwright (builds + previews automatically)
npm run build
npm run icons        # re-render PWA icons from public/favicon.svg
# deploy: push to main → GitHub Actions → GitHub Pages
```

## Speed (learned 2026-10-10)
- **While iterating, run only what you touched:** `npx vitest run <file or dir>` and `npx playwright test e2e/<spec> --project=desktop`. The full `npm test` + `npm run test:e2e` run once, before the PR.
- **Port 4173 belongs to the e2e preview server** (`reuseExistingServer`). Never run another server there: Playwright will test it instead and fail across the board. Use another port (e.g. 4180) for anything else, and run e2e with `CI=1` to force its own server.
- **Several repos at once:** start long suites in the background and keep working; don't wait on them one by one.
- **Cross-app demo video:** `/mnt/project-files/travel-hub/demo/source/run.sh` reuses the app builds and a disk cache of map tiles, and checks the whole story in about a minute (`CHECK=1`) before the 2.5-minute recording. Fix the story with `CHECK=1` runs, record once.

## Definition of done
1. Tests added/updated and passing (`npm test`, `npm run test:e2e` for touched flows).
2. `npm run build` succeeds with no TypeScript errors.
3. Checked at phone width and desktop, light and dark.
4. No secrets in code or commits.
5. A short summary to the user **in Hebrew**: what changed, how to check it, and any suggestions for next steps.
