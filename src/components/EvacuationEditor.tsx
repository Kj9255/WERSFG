import { useEffect, useRef, useState } from "react";
import maplibregl, { Map } from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
type MapboxDrawInstance = InstanceType<typeof MapboxDraw>;
import type { FeatureCollection } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

// MapboxDraw expects a global mapboxgl object even when using MapLibre
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).mapboxgl = maplibregl;

interface FloorState {
  features: FeatureCollection;
  history: FeatureCollection[];
  historyIndex: number;
}

interface EvacuationEditorProps {
  floors: number[];
  initialData?: Record<number, FeatureCollection>;
}

function createEmptyFeatureCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

const EvacuationEditor = ({ floors, initialData = {} }: EvacuationEditorProps) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const drawRef = useRef<MapboxDrawInstance | null>(null);
  const [currentFloor, setCurrentFloor] = useState(floors[0]);
  const [data, setData] = useState<Record<number, FloorState>>(() => {
    const obj: Record<number, FloorState> = {};
    floors.forEach((f) => {
      const fc = initialData[f] || createEmptyFeatureCollection();
      obj[f] = { features: fc, history: [fc], historyIndex: 0 };
    });
    return obj;
  });

  // automatically persist data whenever it changes
  useEffect(() => {
    const exportData: Record<number, FeatureCollection> = {};
    Object.keys(data).forEach((f) => {
      exportData[Number(f)] = data[Number(f)].features;
    });
    localStorage.setItem("evacuation-map", JSON.stringify(exportData));
  }, [data]);

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [0, 0],
      zoom: 17,
    });
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
    });

    map.addControl(draw);
    drawRef.current = draw;

    const update = () => updateGeoJSON();
    map.on("draw.create", update);
    map.on("draw.update", update);
    map.on("draw.delete", update);

    map.on("load", () => {
      loadFloor(currentFloor);
    });
  }, [currentFloor]);

  const loadFloor = (floor: number) => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    const fc = data[floor].features;
    if (fc.features.length) {
      draw.add(fc);
    }
  };

  const updateGeoJSON = () => {
    const draw = drawRef.current;
    if (!draw) return;
    const fc = draw.getAll();
    setData((prev) => {
      const floorState = prev[currentFloor];
      const history = floorState.history
        .slice(0, floorState.historyIndex + 1)
        .concat([fc]);
      return {
        ...prev,
        [currentFloor]: {
          features: fc,
          history,
          historyIndex: history.length - 1,
        },
      };
    });
  };

  const handleFloorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const floor = parseInt(e.target.value, 10);
    setCurrentFloor(floor);
    loadFloor(floor);
  };

  const setMode = (mode: string | null) => {
    const draw = drawRef.current;
    if (!draw) return;
    switch (mode) {
      case "room":
        draw.changeMode("draw_polygon", { featureProperties: { type: "room" } });
        break;
      case "corridor":
        draw.changeMode("draw_polygon", { featureProperties: { type: "corridor" } });
        break;
      case "exit":
        draw.changeMode("draw_point", { featureProperties: { type: "exit" } });
        break;
      case "path":
        draw.changeMode("draw_line_string", { featureProperties: { type: "path" } });
        break;
      default:
        draw.changeMode("simple_select");
    }
  };

  const undo = () => {
    const draw = drawRef.current;
    if (!draw) return;
    setData((prev) => {
      const floorState = prev[currentFloor];
      const newIndex = Math.max(0, floorState.historyIndex - 1);
      const fc = floorState.history[newIndex];
      draw.deleteAll();
      if (fc.features.length) draw.add(fc);
      return {
        ...prev,
        [currentFloor]: {
          ...floorState,
          historyIndex: newIndex,
          features: fc,
        },
      };
    });
  };

  const redo = () => {
    const draw = drawRef.current;
    if (!draw) return;
    setData((prev) => {
      const floorState = prev[currentFloor];
      const newIndex = Math.min(
        floorState.history.length - 1,
        floorState.historyIndex + 1,
      );
      const fc = floorState.history[newIndex];
      draw.deleteAll();
      if (fc.features.length) draw.add(fc);
      return {
        ...prev,
        [currentFloor]: {
          ...floorState,
          historyIndex: newIndex,
          features: fc,
        },
      };
    });
  };

  const save = () => {
    const exportData: Record<number, FeatureCollection> = {};
    Object.keys(data).forEach((f) => {
      exportData[Number(f)] = data[Number(f)].features;
    });
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "evacuation-map.geojson";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full">
      <div className="flex gap-2 p-2 flex-wrap">
        <select
          className="border p-1 rounded"
          value={currentFloor}
          onChange={handleFloorChange}
        >
          {floors.map((f) => (
            <option key={f} value={f}>
              Floor {f}
            </option>
          ))}
        </select>
        <button
          className="px-2 py-1 border rounded"
          onClick={() => setMode("room")}
        >
          Room
        </button>
        <button
          className="px-2 py-1 border rounded"
          onClick={() => setMode("corridor")}
        >
          Corridor
        </button>
        <button
          className="px-2 py-1 border rounded"
          onClick={() => setMode("exit")}
        >
          Exit
        </button>
        <button
          className="px-2 py-1 border rounded"
          onClick={() => setMode("path")}
        >
          Path
        </button>
        <button
          className="px-2 py-1 border rounded"
          onClick={() => setMode(null)}
        >
          Select
        </button>
        <button className="px-2 py-1 border rounded" onClick={undo}>
          Undo
        </button>
        <button className="px-2 py-1 border rounded" onClick={redo}>
          Redo
        </button>
        <button className="px-2 py-1 border rounded" onClick={save}>
          Save
        </button>
      </div>
      <div ref={mapContainer} className="w-full h-[80vh]" />
    </div>
  );
};

export default EvacuationEditor;

