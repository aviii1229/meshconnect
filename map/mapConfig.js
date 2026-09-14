/**
 * Leaflet Map Configuration & Tile Providers Module
 * Optimized with exact maxNativeZoom limits per tile provider to prevent blank tiles,
 * and smooth zooming parameters.
 */
(function (global) {
  'use strict';

  const MapConfig = {
    // Default coordinates in [lat, lng] for Leaflet
    defaultCenter: [36.1069, -112.1129],
    defaultZoom: 12,
    minZoom: 2,
    maxZoom: 20,

    // Smoothness and interaction defaults
    zoomSnap: 0.5,
    zoomDelta: 0.5,
    wheelPxPerZoomLevel: 100,

    // Runtime configuration
    mapEngine: 'leaflet',
    currentPresetId: 'tactical',

    // Tile layer presets with exact native zoom limits
    presets: {
      tactical: {
        id: 'tactical',
        name: 'Tactical Dark Mode',
        label: '🌙 Dark Mode',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        subdomains: '',
        maxNativeZoom: 16,
        maxZoom: 20,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
      },
      topo: {
        id: 'topo',
        name: 'OpenTopoMap Relief',
        label: '⛰️ Topo Relief',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        subdomains: 'abc',
        maxNativeZoom: 17, // OpenTopoMap limit is 17; Leaflet upscales to maxZoom smoothly
        maxZoom: 20,
        attribution: 'Map: &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a>, <a href="http://viewfinderpanoramas.org" target="_blank">SRTM</a> | Style: &copy; <a href="https://opentopomap.org" target="_blank">OpenTopoMap</a>'
      },
      vivid: {
        id: 'vivid',
        name: 'OpenStreetMap Standard',
        label: '🗺️ Vivid OSM',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: 'abc',
        maxNativeZoom: 19,
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
      },
      satellite: {
        id: 'satellite',
        name: 'Esri Satellite Imagery',
        label: '🛰️ Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        subdomains: '',
        maxNativeZoom: 18, // Esri imagery limit is 18; upscaled past 18 smoothly
        maxZoom: 20,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community'
      }
    },

    /**
     * Fetch runtime config from backend (/api/config)
     */
    loadRuntimeConfig: async function () {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.map_style_url) {
            const s = data.map_style_url.toLowerCase();
            if (s === 'topo' || s === 'terrain') this.currentPresetId = 'topo';
            else if (s === 'tactical' || s === 'dark') this.currentPresetId = 'tactical';
            else if (s === 'satellite' || s === 'hybrid') this.currentPresetId = 'satellite';
            else if (s === 'vivid' || s === 'osm' || s === 'roadmap') this.currentPresetId = 'vivid';
          }
        }
      } catch (err) {
        console.warn('MapConfig: Could not fetch /api/config:', err.message);
      }
      return this;
    }
  };

  global.MapConfig = MapConfig;
})(window);
