/**
 * basemaps.ts — All free, no-API-key tile providers for the Cesium globe.
 * Add new entries here; Dashboard and BasemapSwitcher pick them up automatically.
 */
import { ImageryLayer, UrlTemplateImageryProvider, Credit } from 'cesium';

export type BasemapId = 'dark' | 'satellite' | 'street' | 'topo' | 'night';

export interface BasemapDef {
  id: BasemapId;
  label: string;
  icon: string;
  description: string;
  /** Factory — always creates a fresh ImageryLayer so Cesium can swap it in. */
  layer: () => ImageryLayer;
}

export const BASEMAPS: BasemapDef[] = [
  {
    id: 'dark',
    label: 'Dark',
    icon: '🌑',
    description: 'Esri Dark Gray Base — low-distraction intel style',
    layer: () =>
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
          credit: new Credit('Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community', true),
          maximumLevel: 16,
        }),
      ),
  },
  {
    id: 'satellite',
    label: 'Satellite',
    icon: '🛰️',
    description: 'Esri World Imagery — true-colour satellite',
    layer: () =>
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          credit: new Credit('Esri, Maxar, Earthstar Geographics, and the GIS User Community', true),
          maximumLevel: 19,
        }),
      ),
  },
  {
    id: 'street',
    label: 'Street',
    icon: '🗺️',
    description: 'OpenStreetMap — road network',
    layer: () =>
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          credit: new Credit('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', true),
          maximumLevel: 19,
        }),
      ),
  },
  {
    id: 'topo',
    label: 'Terrain',
    icon: '⛰️',
    description: 'Esri World Topo — topographic map with labels',
    layer: () =>
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          credit: new Credit('Esri, HERE, Garmin, NGA, USGS', true),
          maximumLevel: 19,
        }),
      ),
  },
  {
    id: 'night',
    label: 'Night',
    icon: '🌃',
    description: 'NASA Black Marble — city lights at night (VIIRS)',
    layer: () =>
      new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg',
          credit: new Credit(
            'Imagery provided by GIBS, operated by NASA/GSFC/ESDIS',
            true,
          ),
          maximumLevel: 8,
        }),
      ),
  },
];

export const DEFAULT_BASEMAP: BasemapId = 'dark';
