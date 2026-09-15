# pia-ui

React + Vite + Cesium dashboard for the [PIA](https://github.com/sebastian420-hub/pia) intelligence engine.

## Run

```bash
cp .env.example .env.local     # set VITE_API_URL and VITE_API_TOKEN (= PIA_API_TOKEN on the API)
npm ci
npm run dev                    # http://localhost:5173
```

The API bridge (`pia-api`) must be running and its `FRONTEND_ORIGINS` must include the dev URL.

## Pages

- `/` — live globe: last 100 records on load, live WebSocket feed, clusters, watched entities, document upload, AI co-pilot, agent terminal.
- `/archive` — paginated records and entities, semantic search, 3D relationship graph with 👍/👎 feedback on inferred links.
- `/landing` — marketing page.

## Configuration

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | API base, default `http://localhost:8001` |
| `VITE_API_TOKEN` | Bearer token sent on every request and on the WebSocket handshake |
| `VITE_CESIUM_ION_TOKEN` | Optional. Without it the globe uses OpenStreetMap tiles (fine for development; check OSM tile usage policy before heavy use). |

Records whose headline starts with `[SIM]` come from the simulated aviation/maritime agents and are marked `SIM` in the ticker.

## Checks

```bash
npx tsc -b && npx eslint . && npx vite build
```
