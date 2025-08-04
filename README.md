# Floorplan Indoor Navigation Demo

This simple example uses [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/) to display a 3D model of the Ministry of Finance building and calculate a route between two selected points directly in the browser.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm start
   ```
   This uses `http-server` to serve the files in the repository root.
3. Open `http://localhost:8080` in your browser and interact with the map.

## Project Structure

- `index.html` – main page with the map container and buttons
- `styles.css` – basic responsive styling plus banner and floor selector
- `app.js` – JavaScript that loads the floor plan, handles routing and simple floor selection
- `components/` – reference components used as inspiration for the banner and map logo control
- `geojson/` – sample floor plan data

No tests are provided.
