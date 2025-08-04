// Indoor multi-floor navigation using MapLibre
let map;
const floorGraphs = {};
let currentFloor = 1;
let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;
let adminMode = false;
let drawnData = { type: 'FeatureCollection', features: [] };
let draw;

function saveToStorage() {
  localStorage.setItem('oim-drawn', JSON.stringify(drawnData));
}

function loadFromStorage() {
  try {
    const data = JSON.parse(localStorage.getItem('oim-drawn'));
    if (data && Array.isArray(data.features)) {
      drawnData = data;
    }
  } catch (_) {
    // ignore malformed data
  }
}

function haversine(a, b) {
  const R = 6371000;
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function addEdge(graph, from, to) {
  const f = JSON.stringify(from);
  const t = JSON.stringify(to);
  const w = haversine(from, to);
  if (!graph[f]) graph[f] = [];
  if (!graph[t]) graph[t] = [];
  graph[f].push({ to: t, weight: w });
  graph[t].push({ to: f, weight: w });
}

function buildGraph(data) {
  const graph = {};
  data.features.forEach(f => {
    if (f.geometry.type === 'LineString') {
      const coords = f.geometry.coordinates;
      for (let i = 0; i < coords.length - 1; i++) {
        addEdge(graph, coords[i], coords[i + 1]);
      }
    }
  });
  return graph;
}

function nearestNode(coord, graph) {
  let nearest = null;
  let min = Infinity;
  for (const key of Object.keys(graph)) {
    const node = JSON.parse(key);
    const dist = haversine(coord, node);
    if (dist < min) {
      min = dist;
      nearest = key;
    }
  }
  return nearest;
}

function dijkstra(graph, startKey, endKey) {
  const dist = {};
  const prev = {};
  const nodes = Object.keys(graph);
  nodes.forEach(k => (dist[k] = Infinity));
  dist[startKey] = 0;
  while (nodes.length) {
    nodes.sort((a, b) => dist[a] - dist[b]);
    const smallest = nodes.shift();
    if (smallest === endKey) break;
    if (dist[smallest] === Infinity) break;
    for (const edge of graph[smallest]) {
      const alt = dist[smallest] + edge.weight;
      if (alt < dist[edge.to]) {
        dist[edge.to] = alt;
        prev[edge.to] = smallest;
      }
    }
  }
  const path = [];
  let cur = endKey;
  if (!prev[cur] && cur !== startKey) return [];
  while (cur) {
    path.unshift(JSON.parse(cur));
    cur = prev[cur];
    if (cur === startKey) {
      path.unshift(JSON.parse(cur));
      break;
    }
  }
  return path;
}

function drawRoute(coords) {
  const data = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }]
  };
  if (map.getSource('route')) {
    map.getSource('route').setData(data);
  } else {
    map.addSource('route', { type: 'geojson', data });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      paint: { 'line-color': '#ff0000', 'line-width': 4 }
    });
  }
}

function applyDrawnFeatures() {
  if (!draw || !adminMode) return;
  draw.deleteAll();
  const visible = drawnData.features.filter(f => f.properties.floor === currentFloor);
  if (visible.length) draw.add(visible);
}

async function loadWalkways() {
  const floors = [1, 2, 3, 4];
  for (const f of floors) {
    const data = await fetch(`geojson/floor${f}.geojson`).then(r => r.json());
    const walkways = {
      type: 'FeatureCollection',
      features: data.features.filter(ft => ft.geometry.type === 'LineString')
    };
    floorGraphs[f] = buildGraph(walkways);
    map.addSource(`walkway-${f}`, { type: 'geojson', data: walkways });
    map.addLayer({
      id: `walkway-${f}`,
      type: 'line',
      source: `walkway-${f}`,
      layout: { visibility: f === currentFloor ? 'visible' : 'none' },
      paint: { 'line-color': '#555', 'line-width': 2 }
    });
  }
}

async function loadBuilding() {
  const data = await fetch('geojson/demo-map-mf.geojson').then(r => r.json());
  const polygon = data.features[0].geometry;
  const floors = [1, 2, 3, 4];
  const features = floors.map(f => ({ type: 'Feature', properties: { floor: f }, geometry: polygon }));
  map.addSource('building', { type: 'geojson', data: { type: 'FeatureCollection', features } });
  floors.forEach(f => {
    map.addLayer({
      id: `floor-${f}`,
      type: 'fill-extrusion',
      source: 'building',
      filter: ['==', ['get', 'floor'], f],
      paint: {
        'fill-extrusion-color': f === currentFloor ? '#3388ff' : '#bbbbbb',
        'fill-extrusion-height': f * 3,
        'fill-extrusion-base': (f - 1) * 3,
        'fill-extrusion-opacity': 0.8
      }
    });
  });
}

function highlightFloor(floor) {
  currentFloor = floor;
  [1, 2, 3, 4].forEach(f => {
    map.setPaintProperty(`floor-${f}`, 'fill-extrusion-color', f === floor ? '#3388ff' : '#bbbbbb');
    map.setLayoutProperty(`walkway-${f}`, 'visibility', f === floor ? 'visible' : 'none');
  });
  if (map.getSource('route')) {
    map.removeLayer('route-line');
    map.removeSource('route');
  }
  applyDrawnFeatures();
}

document.addEventListener('DOMContentLoaded', async () => {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://demotiles.maplibre.org/style.json',
    center: [21.0160, 52.23795],
    zoom: 18,
    pitch: 45
  });
  map.addControl(new maplibregl.NavigationControl());

  draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: { polygon: true, point: true, line_string: true, trash: true }
  });

  loadFromStorage();

  await loadBuilding();
  await loadWalkways();

  highlightFloor(currentFloor);

  const floorSelect = document.getElementById('floor-select');
  floorSelect.addEventListener('change', e => {
    highlightFloor(Number(e.target.value));
  });

  const startBtn = document.getElementById('start-btn');
  const endBtn = document.getElementById('end-btn');
  const navBtn = document.getElementById('nav-btn');
  const adminToggle = document.getElementById('admin-toggle');
  const exportBtn = document.getElementById('export-btn');

  let selecting = null;
  map.on('click', e => {
    if (adminMode) return;
    if (selecting === 'start') {
      startPoint = e.lngLat;
      if (startMarker) startMarker.remove();
      startMarker = new maplibregl.Marker({ color: 'green' }).setLngLat(e.lngLat).addTo(map);
      selecting = null;
      startBtn.classList.remove('active');
    } else if (selecting === 'end') {
      endPoint = e.lngLat;
      if (endMarker) endMarker.remove();
      endMarker = new maplibregl.Marker({ color: 'red' }).setLngLat(e.lngLat).addTo(map);
      selecting = null;
      endBtn.classList.remove('active');
    }
  });

  startBtn.addEventListener('click', () => {
    selecting = 'start';
    startBtn.classList.add('active');
    endBtn.classList.remove('active');
  });
  endBtn.addEventListener('click', () => {
    selecting = 'end';
    endBtn.classList.add('active');
    startBtn.classList.remove('active');
  });

  function setAdmin(state) {
    adminMode = state;
    if (adminMode) {
      map.addControl(draw);
      applyDrawnFeatures();
      startBtn.disabled = true;
      endBtn.disabled = true;
      navBtn.disabled = true;
      adminToggle.textContent = 'Exit Admin';
      selecting = null;
    } else {
      if (draw) map.removeControl(draw);
      startBtn.disabled = false;
      endBtn.disabled = false;
      navBtn.disabled = false;
      adminToggle.textContent = 'Admin Mode';
      selecting = null;
    }
  }

  adminToggle.addEventListener('click', () => {
    setAdmin(!adminMode);
  });

  map.on('draw.create', e => {
    e.features.forEach(f => {
      f.properties = f.properties || {};
      f.properties.floor = currentFloor;
      drawnData.features.push(f);
    });
    saveToStorage();
  });

  map.on('draw.update', e => {
    e.features.forEach(f => {
      const idx = drawnData.features.findIndex(d => d.id === f.id);
      if (idx !== -1) drawnData.features[idx] = f;
    });
    saveToStorage();
  });

  map.on('draw.delete', e => {
    drawnData.features = drawnData.features.filter(d => !e.features.some(f => f.id === d.id));
    saveToStorage();
  });

  exportBtn.addEventListener('click', () => {
    if (drawnData.features.length === 0) {
      alert('No features to export');
      return;
    }
    const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(drawnData));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = 'features.geojson';
    link.click();
  });

  navBtn.addEventListener('click', () => {
    if (!startPoint || !endPoint) {
      alert('Please select both start and end points');
      return;
    }
    const graph = floorGraphs[currentFloor];
    const startKey = nearestNode([startPoint.lng, startPoint.lat], graph);
    const endKey = nearestNode([endPoint.lng, endPoint.lat], graph);
    if (!startKey || !endKey) {
      alert('Could not find nearby route nodes');
      return;
    }
    const coords = dijkstra(graph, startKey, endKey);
    if (coords.length === 0) {
      alert('No route found');
      return;
    }
    drawRoute(coords);
  });
});
