import React, { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import type { Feature, FeatureCollection } from "geojson";

interface EvacuationEditorProps {
  /** List of available floor identifiers */
  floors: string[];
  /** Optional initial GeoJSON data */
  data?: FeatureCollection;
  /** maplibre style url */
  mapStyle?: string;
}

interface EvacuationFeature extends Feature {
  properties: {
    /** floor id the feature belongs to */
    floor: string;
    /** type of feature: room, corridor, exit, path */
    featureType: string;
    [key: string]: any;
  };
}

/**
 * React based visual editor for creating indoor evacuation maps.
 * Users can draw rooms, corridors, exits and evacuation paths on top of
 * a MapLibre map. Data is persisted to localStorage in GeoJSON format and
 * can be exported by clicking the save button.
 */
export default function EvacuationEditor({
  floors,
  data,
  mapStyle = "https://demotiles.maplibre.org/style.json",
}: EvacuationEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [currentFloor, setCurrentFloor] = useState(floors[0]);
  const [fc, setFc] = useState<FeatureCollection>(
    data || { type: "FeatureCollection", features: [] }
  );
  // undo/redo stacks
  const undoStack = useRef<FeatureCollection[]>([]);
  const redoStack = useRef<FeatureCollection[]>([]);

  // init map
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [8.54, 47.37],
      zoom: 18,
    });
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        line_string: true,
        point: true,
        trash: true,
      },
    });
    drawRef.current = draw;
    map.addControl(draw as any);

    // load saved data
    const saved = window.localStorage.getItem("evacuation-geojson");
    if (saved) {
      const parsed: FeatureCollection = JSON.parse(saved);
      setFc(parsed);
      const toShow = (parsed.features as EvacuationFeature[]).filter(
        (f) => f.properties.floor === currentFloor
      );
      if (toShow.length) draw.add(toShow as any);
    }

    const updateData = () => {
      if (!drawRef.current) return;
      const all = drawRef.current.getAll();
      // assign floor property to all features drawn in this session
      const withFloor = (all.features as EvacuationFeature[]).map((f) => ({
        ...f,
        properties: { ...f.properties, floor: currentFloor },
      }));
      const next: FeatureCollection = {
        type: "FeatureCollection",
        features: [
          ...fc.features.filter(
            (f: any) => (f.properties && f.properties.floor) !== currentFloor
          ),
          ...withFloor,
        ],
      };
      undoStack.current.push(fc);
      redoStack.current = [];
      setFc(next);
      window.localStorage.setItem("evacuation-geojson", JSON.stringify(next));
    };

    map.on("draw.create", updateData);
    map.on("draw.update", updateData);
    map.on("draw.delete", updateData);

    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // whenever floor changes show only its features
  useEffect(() => {
    if (!drawRef.current) return;
    drawRef.current.deleteAll();
    const toShow = (fc.features as EvacuationFeature[]).filter(
      (f) => f.properties.floor === currentFloor
    );
    if (toShow.length) drawRef.current.add(toShow as any);
  }, [currentFloor, fc]);

  const handleUndo = () => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(fc);
    setFc(prev);
    window.localStorage.setItem("evacuation-geojson", JSON.stringify(prev));
  };

  const handleRedo = () => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop()!;
    undoStack.current.push(fc);
    setFc(next);
    window.localStorage.setItem("evacuation-geojson", JSON.stringify(next));
  };

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(fc, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evacuation-map.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  const changeMode = (mode: string) => {
    if (!drawRef.current) return;
    drawRef.current.changeMode(mode);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex space-x-2 mb-2">
        {floors.map((fl) => (
          <button
            key={fl}
            className={`px-2 py-1 border ${
              currentFloor === fl ? "bg-blue-500 text-white" : "bg-white"
            }`}
            onClick={() => setCurrentFloor(fl)}
          >
            {fl}
          </button>
        ))}
        <button onClick={() => changeMode("draw_polygon")}>Room</button>
        <button onClick={() => changeMode("draw_line_string")}>Corridor</button>
        <button onClick={() => changeMode("draw_point")}>Exit</button>
        <button onClick={() => changeMode("draw_line_string")}>Path</button>
        <button onClick={handleUndo}>Undo</button>
        <button onClick={handleRedo}>Redo</button>
        <button onClick={handleSave}>Save</button>
      </div>
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
