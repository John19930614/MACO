// Minimal type stub for maplibre-gl.
// The real package is loaded dynamically; these stubs satisfy TypeScript's
// module-resolution check at build time only.
declare module "maplibre-gl" {
  export interface StyleSpecification {
    version: 8;
    glyphs?: string;
    sprite?: string;
    sources: Record<string, unknown>;
    layers: unknown[];
    [key: string]: unknown;
  }

  export interface MapMouseEvent {
    features?: Array<{
      properties: Record<string, unknown> | null;
      geometry: GeoJSON.Geometry;
    }>;
    lngLat: { lng: number; lat: number };
    point: { x: number; y: number };
  }

  export interface GeoJSONSource {
    setData(data: GeoJSON.FeatureCollection): void;
    getClusterExpansionZoom(clusterId: number): Promise<number>;
  }

  export interface MapOptions {
    container: HTMLElement | string;
    style: StyleSpecification | string;
    center?: [number, number];
    zoom?: number;
  }

  export class NavigationControl {
    constructor(options?: { showCompass?: boolean; showZoom?: boolean });
  }

  export class Map {
    constructor(options: MapOptions);
    addControl(control: unknown, position?: string): this;
    on(event: string, handler: (e: MapMouseEvent) => void): this;
    on(event: string, layerId: string, handler: (e: MapMouseEvent) => void): this;
    off(event: string, handler: (e: MapMouseEvent) => void): this;
    off(event: string, layerId: string, handler: (e: MapMouseEvent) => void): this;
    addSource(id: string, source: unknown): this;
    getSource(id: string): GeoJSONSource | undefined;
    addLayer(layer: unknown): this;
    getLayer(id: string): unknown;
    setPaintProperty(layerId: string, name: string, value: unknown): this;
    setLayoutProperty(layerId: string, name: string, value: unknown): this;
    setFilter(layerId: string, filter: unknown): this;
    getCanvas(): HTMLCanvasElement;
    queryRenderedFeatures(point?: unknown, options?: unknown): unknown[];
    easeTo(options: { center?: [number, number] | { lng: number; lat: number }; zoom?: number; bearing?: number; pitch?: number; duration?: number }): this;
    flyTo(options: { center?: [number, number] | { lng: number; lat: number }; zoom?: number; speed?: number; curve?: number; duration?: number }): this;
    remove(): void;
  }

  const maplibregl: {
    Map: typeof Map;
    NavigationControl: typeof NavigationControl;
  };
  export default maplibregl;
}

declare namespace GeoJSON {
  interface Point {
    type: "Point";
    coordinates: number[];
  }
  interface LineString {
    type: "LineString";
    coordinates: number[][];
  }
  interface Polygon {
    type: "Polygon";
    coordinates: number[][][];
  }
  interface MultiPoint {
    type: "MultiPoint";
    coordinates: number[][];
  }
  interface MultiLineString {
    type: "MultiLineString";
    coordinates: number[][][];
  }
  interface MultiPolygon {
    type: "MultiPolygon";
    coordinates: number[][][][];
  }
  interface GeometryCollection {
    type: "GeometryCollection";
    geometries: Geometry[];
  }
  type Geometry = Point | LineString | Polygon | MultiPoint | MultiLineString | MultiPolygon | GeometryCollection;

  interface Feature<G extends Geometry = Geometry> {
    type: "Feature";
    geometry: G;
    properties: Record<string, unknown> | null;
    id?: string | number;
  }

  interface FeatureCollection<G extends Geometry = Geometry> {
    type: "FeatureCollection";
    features: Feature<G>[];
  }
}
