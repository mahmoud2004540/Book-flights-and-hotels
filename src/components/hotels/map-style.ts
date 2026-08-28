import type { StyleSpecification } from "maplibre-gl";

/**
 * Map tiles.
 *
 * MapLibre rather than Mapbox GL so the map works with no access token — the
 * brief names Mapbox, and MapLibre is API-compatible with it, so supplying
 * NEXT_PUBLIC_MAPBOX_TOKEN later swaps the style without touching component code.
 *
 * OpenStreetMap's public tiles are fine for development but have a usage
 * policy that rules out production traffic; a token is the answer before launch.
 */
export function mapStyle(): StyleSpecification | string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (token) {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${token}`;
  }

  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}
