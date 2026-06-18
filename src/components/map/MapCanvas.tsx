"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MlMap, type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import type { SafetyCell, SafetyLocation, Site } from "@/lib/types";
import { SEVERITY_META, RISK_OBJECT_META } from "@/lib/constants";
import type { EventPoint, FailurePoint, ForecastPoint } from "./MapWorkspace";

interface Props {
  cells: SafetyCell[];
  locations: SafetyLocation[];
  site?: Site;
  selectedId: string | null;
  onSelect: (id: string) => void;
  heat: boolean;
  heatByCell: Record<string, number>;
  events: EventPoint[];
  showEvents: boolean;
  failures: FailurePoint[];
  showFailures: boolean;
  forecast: ForecastPoint[];
  showForecast: boolean;
}

const EVENT_COLOR = RISK_OBJECT_META.event.color;
const FAILURE_COLOR = RISK_OBJECT_META.failure.color;
const FORECAST_COLOR: Record<ForecastPoint["band"], string> = { green: "#1f9d55", amber: "#d9a400", orange: "#b45309", red: "#b80a0a" };

function forecastToGeoJSON(forecast: ForecastPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: forecast.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
      properties: { locationId: f.locationId, score: f.score, color: FORECAST_COLOR[f.band], label: f.label },
    })),
  };
}

function eventsToGeoJSON(events: EventPoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: events.map((e) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [e.lng, e.lat] },
      properties: { id: e.id, cellId: e.cellId, severity: e.severity, kind: e.kind, title: e.title },
    })),
  };
}

function failuresToGeoJSON(failures: FailurePoint[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: failures.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lng, f.lat] },
      properties: { cellId: f.cellId, count: f.count, title: f.title },
    })),
  };
}

// Real OpenStreetMap raster basemap. Tiles + glyphs load from the network in the
// browser; in production point these at your own tile/style server.
const STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b1020" } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-opacity": 0.85 } },
  ],
};

function toGeoJSON(cells: SafetyCell[], locations: SafetyLocation[], heatByCell: Record<string, number>): GeoJSON.FeatureCollection {
  const locById = new Map(locations.map((l) => [l.id, l]));
  const features: GeoJSON.Feature[] = [];
  for (const c of cells) {
    const loc = locById.get(c.location_id);
    if (!loc) continue;
    const color = c.status === "closed" ? SEVERITY_META.low.color : SEVERITY_META[c.severity].color;
    // composite heat weight (0-1) → 0-100 for the heatmap interpolation
    const heat = Math.round((heatByCell[c.id] ?? c.risk_score / 100) * 100);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [loc.lng, loc.lat] },
      properties: { id: c.id, severity: c.severity, risk: c.risk_score, heat, color, closed: c.status === "closed" ? 1 : 0 },
    });
  }
  return { type: "FeatureCollection", features };
}

export function MapCanvas({ cells, locations, site, selectedId, onSelect, heat, heatByCell, events, showEvents, failures, showFailures, forecast, showForecast }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: site?.center ?? [-122.302, 37.801],
      zoom: 15,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource("cells", { type: "geojson", data: toGeoJSON(cells, locations, heatByCell), cluster: true, clusterRadius: 50, clusterMaxZoom: 16 });

      // Heat layer (hidden until toggled). Weighted by the composite heat score.
      map.addLayer({
        id: "cells-heat",
        type: "heatmap",
        source: "cells",
        layout: { visibility: heat ? "visible" : "none" },
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "heat"], 0, 0, 100, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 1, 18, 3],
          "heatmap-radius": 40,
          "heatmap-opacity": 0.75,
        },
      });

      // Forecast band rings — drawn beneath clusters/points so cell dots stay
      // on top and clickable. Ring color = band, radius = forecast score.
      map.addSource("forecast", { type: "geojson", data: forecastToGeoJSON(forecast) });
      map.addLayer({
        id: "forecast-ring",
        type: "circle",
        source: "forecast",
        layout: { visibility: showForecast ? "visible" : "none" },
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": 0.12,
          "circle-radius": ["interpolate", ["linear"], ["get", "score"], 0, 12, 100, 30],
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 3,
          "circle-stroke-opacity": 0.9,
        },
      });

      // Clusters.
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "cells",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#185fa5",
          "circle-opacity": 0.85,
          "circle-radius": ["step", ["get", "point_count"], 16, 5, 22, 15, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "cells",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Open Sans Bold"] },
        paint: { "text-color": "#ffffff" },
      });

      // Selected highlight (under the points).
      map.addLayer({
        id: "cells-selected",
        type: "circle",
        source: "cells",
        filter: ["==", ["get", "id"], selectedId ?? "__none__"],
        paint: { "circle-radius": 16, "circle-color": "#ffffff", "circle-opacity": 0.5 },
      });

      // Unclustered points, colored by severity.
      map.addLayer({
        id: "cells-point",
        type: "circle",
        source: "cells",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["match", ["get", "severity"], "critical", 11, "high", 9, 7],
          "circle-opacity": ["case", ["==", ["get", "closed"], 1], 0.45, 0.95],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.7)",
        },
      });

      // Event Cells — outcomes pinned at their precursor's location. A diamond
      // halo + core in the framework's event color, drawn above the cell points.
      map.addSource("events", { type: "geojson", data: eventsToGeoJSON(events) });
      map.addLayer({
        id: "events-halo",
        type: "circle",
        source: "events",
        layout: { visibility: showEvents ? "visible" : "none" },
        paint: {
          "circle-color": EVENT_COLOR,
          "circle-opacity": 0.18,
          "circle-radius": ["match", ["get", "severity"], "critical", 22, "high", 18, 15],
        },
      });
      map.addLayer({
        id: "events-point",
        type: "circle",
        source: "events",
        layout: { visibility: showEvents ? "visible" : "none" },
        paint: {
          "circle-color": EVENT_COLOR,
          "circle-radius": ["match", ["get", "severity"], "critical", 9, "high", 7, 6],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.on("click", "events-point", (e) => {
        const cellId = e.features?.[0]?.properties?.cellId as string | undefined;
        if (cellId) onSelectRef.current(cellId); // open the precursor cell
      });
      map.on("mouseenter", "events-point", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "events-point", () => (map.getCanvas().style.cursor = ""));

      // Failure Cells — hollow red rings (a broken control), distinct from the
      // solid severity dots and the orange event diamonds. Hidden until toggled.
      map.addSource("failures", { type: "geojson", data: failuresToGeoJSON(failures) });
      map.addLayer({
        id: "failures-point",
        type: "circle",
        source: "failures",
        layout: { visibility: showFailures ? "visible" : "none" },
        paint: {
          "circle-color": "rgba(0,0,0,0)",
          "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 12, 4, 20],
          "circle-stroke-width": 3,
          "circle-stroke-color": FAILURE_COLOR,
        },
      });
      map.on("click", "failures-point", (e) => {
        const cellId = e.features?.[0]?.properties?.cellId as string | undefined;
        if (cellId) onSelectRef.current(cellId);
      });
      map.on("mouseenter", "failures-point", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "failures-point", () => (map.getCanvas().style.cursor = ""));

      map.on("click", "cells-point", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        if (id) onSelectRef.current(id);
      });
      map.on("click", "clusters", async (e) => {
        const f = e.features?.[0];
        const clusterId = f?.properties?.cluster_id;
        const src = map.getSource("cells") as GeoJSONSource;
        if (clusterId == null) return;
        const zoom = await src.getClusterExpansionZoom(clusterId as number);
        map.easeTo({ center: (f!.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
      });
      for (const layer of ["cells-point", "clusters"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }

      readyRef.current = true;
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update data
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("cells") as GeoJSONSource)?.setData(toGeoJSON(cells, locations, heatByCell));
  }, [cells, locations, heatByCell]);

  // update events
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("events") as GeoJSONSource)?.setData(eventsToGeoJSON(events));
  }, [events]);

  // events toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    for (const id of ["events-halo", "events-point"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showEvents ? "visible" : "none");
    }
  }, [showEvents]);

  // update failures
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("failures") as GeoJSONSource)?.setData(failuresToGeoJSON(failures));
  }, [failures]);

  // failures toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (map.getLayer("failures-point")) map.setLayoutProperty("failures-point", "visibility", showFailures ? "visible" : "none");
  }, [showFailures]);

  // update forecast
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource("forecast") as GeoJSONSource)?.setData(forecastToGeoJSON(forecast));
  }, [forecast]);

  // forecast toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (map.getLayer("forecast-ring")) map.setLayoutProperty("forecast-ring", "visibility", showForecast ? "visible" : "none");
  }, [showForecast]);

  // selected highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (map.getLayer("cells-selected")) map.setFilter("cells-selected", ["==", ["get", "id"], selectedId ?? "__none__"]);
  }, [selectedId]);

  // heat toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (map.getLayer("cells-heat")) map.setLayoutProperty("cells-heat", "visibility", heat ? "visible" : "none");
  }, [heat]);

  // recenter on site change
  useEffect(() => {
    if (mapRef.current && site) mapRef.current.flyTo({ center: site.center, zoom: 15, duration: 600 });
  }, [site]);

  return <div ref={containerRef} className="h-full w-full" />;
}
