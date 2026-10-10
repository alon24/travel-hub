# Travel Hub AI

One place to plan a vacation. The landing page for the travel apps, and the home of the **Trip** object.

- **Skyhop**: flexible-date flight search · https://alon24.github.io/AiTravelSearcher/
- **MyMaps AI**: maps with day-by-day itineraries · https://alon24.github.io/mymaps-ai/
- **Trip** (new): one record per vacation holding its dates, travelers, destinations, days, flights, stays, budget and links to the map and the flight searches. Type: [`src/model/types.ts`](src/model/types.ts), validation: [`src/model/schema.ts`](src/model/schema.ts), example: [`src/data/example-trip.json`](src/data/example-trip.json).

Built and deployed the same way as MyMaps AI: React + TypeScript + Vite + vite-plugin-pwa, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## One-time setup
GitHub → **Settings → Pages → Source: GitHub Actions**. The next push to `main` (or **Actions → Test and deploy → Run workflow**) publishes the site at `https://alon24.github.io/<repo>/`.

## Development
```bash
npm ci
npm run dev        # http://localhost:5173
npm test           # unit + component tests (Vitest)
npm run test:e2e   # Playwright, desktop + phone
npm run build
npm run icons      # re-render the PWA PNG icons after editing public/favicon.svg
```

## AI (OpenRouter)
AI calls go through a Cloudflare Worker (same `POST /ai` contract as MyMaps AI), so the OpenRouter key never reaches the browser or the repo. Set the Worker's address as the `VITE_WORKER_URL` Actions variable (or in `.env.local`, see `.env.example`). Without it, AI features stay hidden.
