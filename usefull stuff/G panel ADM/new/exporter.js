export function downloadGeoJSON(data) {
  if (!data.features.length) {
    alert('No features to export');
    return;
  }
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'features.geojson';
  link.click();
  URL.revokeObjectURL(url);
}
