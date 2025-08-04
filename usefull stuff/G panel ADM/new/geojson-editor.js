export class GeoJsonEditor {
  constructor() {
    this.data = { type: 'FeatureCollection', features: [] };
  }

  add(feature) {
    this.data.features.push(feature);
  }

  update(feature) {
    const idx = this.data.features.findIndex(f => f.id === feature.id);
    if (idx !== -1) this.data.features[idx] = feature;
  }

  remove(ids) {
    this.data.features = this.data.features.filter(f => !ids.includes(f.id));
  }

  byFloor(floor) {
    return {
      type: 'FeatureCollection',
      features: this.data.features.filter(f => f.properties.floor === floor)
    };
  }

  collection() {
    return this.data;
  }
}
