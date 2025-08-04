import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";
import { useCallback, useEffect, useState } from "react";
import building from "~/mock/building.json";
// import { Building } from "~/types/building";
type Building = any; // Temporary fix: replace with actual Building type if available
import useMapStore from "~/stores/use-map-store";
import useDirections from "~/hooks/use-directions";
import { POI } from "~/types/poi";
import { Card, CardContent } from "../ui/card";
import DiscoveryView from "./discovery-view";
import LocationDetail from "./location-detail";
import poiMap from "~/utils/poi-map";
import { MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";

type UIMode = "discovery" | "detail" | "navigation";
export default function DiscoveryPanel() {
  const map = useMapStore((state) => state.mapInstance);
  const [mode, setMode] = useState<UIMode>("discovery");
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

  const { indoorDirections } = useDirections(building as Building);

  useEffect(() => {
    indoorDirections?.loadMapData?.(
      (building as Building).indoor_routes as GeoJSON.FeatureCollection,
    );
  }, [indoorDirections]);

  const navigateToPOI = useCallback(
    (coordinates: GeoJSON.Position) => {
      map?.flyTo({
        center: coordinates as [number, number],
        zoom: 20,
        duration: 1300,
      });
    },
    [map],
  );

  function handleSelectPOI(poi: POI) {
    setSelectedPOI(poi);
    setMode("detail");
    navigateToPOI(poi.coordinates);
  }

  function handleBackClick() {
    setSelectedPOI(null);
    indoorDirections?.clear?.();
    indoorDirections?.clear();
  }

  useEffect(() => {
    const handleMapClick = (
      event: MapMouseEvent & {
        features?: MapGeoJSONFeature[];
      },
    ) => {
      const { features } = event;
      if (!features?.length) return;

      const clickedFeature = features[0];
      const unitId = Number(clickedFeature.id);
      const relatedPOIs = poiMap.get(unitId);

      if (relatedPOIs && relatedPOIs[0]) {
        const firstPOI = relatedPOIs[0];

        //TODO: find cleaner way to convert GeoJSON.Feature to POI
        const poi: POI = {
          id: firstPOI.properties?.id as number,
          name: firstPOI.properties?.name as string,
          coordinates: firstPOI.geometry.coordinates,
        };
        setSelectedPOI(poi);
        if (mode === "discovery" || mode === "detail") {
          navigateToPOI(poi.coordinates);
          if (mode === "discovery") {
            setMode("detail");
          }
        }
      }
    };

    map?.on("click", "indoor-map-extrusion", handleMapClick);
    return () => {
      map?.off("click", "indoor-map-extrusion", handleMapClick);
    };
  }, [map, mode, navigateToPOI]);

  return (
    <Card className="absolute z-10 w-full rounded-xl shadow-lg md:absolute md:left-4 md:top-4 md:max-w-[23.5rem]">
      <CardContent className="p-4">
        {mode === "discovery" && (
          <DiscoveryView onSelectPOI={handleSelectPOI} />
        )}
        {mode === "detail" && selectedPOI && (
          <LocationDetail
            selectedPOI={selectedPOI}
            handleDirectionsClick={() => setMode("navigation")}
            handleBackClick={handleBackClick}
          />
        )}
      </CardContent>
    </Card>
  );
}
