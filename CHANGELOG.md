# Changelog

## [0.8.2] - 2026-09-18

### Added
- **Globe Imagery Switcher:** New `src/lib/basemaps.ts` defines 5 free tile
  providers (no API key required). New `BasemapSwitcher` component renders a
  floating **MAP** button at the bottom-left of the globe that expands into a
  5-icon style grid — identical UX to Google Maps' layer toggle.
  - 🌑 **Dark** — Esri World Dark Gray Base (default, intel HUD style)
  - 🛰️ **Satellite** — Esri World Imagery (true-colour)
  - 🗺️ **Street** — OpenStreetMap standard
  - ⛰️ **Terrain** — Esri World Topo (topographic + labels)
  - 🌃 **Night** — NASA VIIRS Black Marble city lights

### Fixed
- **Globe transparency (back-of-globe bleed-through):** Four primitives in
  `layers.tsx` used `disableDepthTestDistance={Infinity}`, which disabled
  Cesium depth testing entirely — causing camera icons, event dots, report
  dots, and labels to render through the globe from the opposite side.
  Replaced `Infinity` with finite near-surface thresholds:
  - Points and billboards: `1500 m` (prevents z-fighting when zoomed to
    street level; globe is opaque at continental/global view)
  - Labels: `3000 m` (labels float slightly above anchor points)
- **Globe basemap was always transparent on fresh load:** When
  `VITE_CESIUM_ION_TOKEN` is empty, Cesium's default Bing imagery fails
  silently, leaving a black/transparent globe. Fixed by providing a proper
  free fallback basemap via `UrlTemplateImageryProvider` (Esri Dark) and
  wiring it through the new basemap switcher state.

### Changed
- **`Dashboard.tsx`:** Replaced the single hardcoded `baseLayer` useMemo with
  stateful `basemapId` + a `useEffect` that calls
  `viewer.imageryLayers.removeAll()` + `add()` on style change, enabling
  live basemap switching without remounting the Viewer.
- **Cesium imagery imports cleaned up:** `ImageryLayer`,
  `UrlTemplateImageryProvider`, and `Credit` moved out of `Dashboard.tsx`
  into `basemaps.ts` where they belong.

