export async function loadFloors(map, files) {
  const layers = {};
  for (const [floor, url] of Object.entries(files)) {
    const res = await fetch(url);
    const data = await res.json();
    layers[floor] = L.geoJSON(data, { style: { color: '#3388ff' } }).addTo(map);
  }
  return layers;
}

export function highlightFloor(layers, floor) {
  Object.entries(layers).forEach(([f, layer]) => {
    layer.setStyle({
      fillOpacity: f == floor ? 0.5 : 0.1,
      opacity: f == floor ? 1 : 0.3
    });
    if (f == floor) {
      layer.bringToFront();
    }
  });
}
