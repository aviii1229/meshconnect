/**
 * Google Maps Configuration & Dynamic Loader Module
 * Centralizes Google Maps API loading, presets, dark theme styles, and runtime config.
 */
(function (global) {
  'use strict';

  // High-contrast tactical dark styling for Google Maps roadmap mode
  const tacticalDarkStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0b1326' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#060b14' }, { weight: 3 }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#38bdf8' }]
    },
    {
      featureType: 'poi',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#00d4aa' }]
    },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [{ color: '#0d1f33' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#1a2744' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#0a1529' }]
    },
    {
      featureType: 'road',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#cbd5e1' }]
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry',
      stylers: [{ color: '#2563eb' }, { lightness: -20 }]
    },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [{ color: '#1e3a8a' }]
    },
    {
      featureType: 'road.highway',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#93c5fd' }]
    },
    {
      featureType: 'transit',
      elementType: 'geometry',
      stylers: [{ color: '#1e293b' }]
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#020617' }]
    },
    {
      featureType: 'water',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#38bdf8' }]
    },
    {
      featureType: 'water',
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#020617' }]
    }
  ];

  let googleMapsPromise = null;
  let authFailureTriggered = false;

  const MapConfig = {
    // Default coordinates in { lat, lng } for Google Maps
    defaultCenter: { lat: 36.1069, lng: -112.1129 },
    defaultZoom: 12,
    minZoom: 2,
    maxZoom: 21,

    // Runtime configuration populated from /api/config
    apiKey: '',
    mapId: '',
    currentPresetId: 'terrain',

    // Styles
    tacticalDarkStyle: tacticalDarkStyle,

    // Map style presets matching existing UI switcher buttons
    presets: {
      topo: {
        id: 'topo',
        mapTypeId: 'terrain',
        label: '⛰️ Topo Relief',
        name: 'Google Maps Topographic Terrain (Contours & Elevation)',
        styles: null
      },
      tactical: {
        id: 'tactical',
        mapTypeId: 'roadmap',
        label: '🌙 Dark Mode',
        name: 'Tactical High-Contrast Dark Navigation',
        styles: tacticalDarkStyle
      },
      vivid: {
        id: 'vivid',
        mapTypeId: 'roadmap',
        label: '🗺️ Vivid Road',
        name: 'Google Maps Road & City Navigation',
        styles: null
      },
      satellite: {
        id: 'satellite',
        mapTypeId: 'hybrid',
        label: '🛰️ Satellite',
        name: 'High-Resolution Satellite Imagery & Labels',
        styles: null
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
          if (data.google_maps_api_key) {
            this.apiKey = data.google_maps_api_key.trim();
          }
          if (data.google_maps_map_id) {
            this.mapId = data.google_maps_map_id.trim();
          }
          if (data.map_style_url) {
            // Map legacy 'topo' or style names to presets
            const s = data.map_style_url.toLowerCase();
            if (s === 'topo' || s === 'terrain') this.currentPresetId = 'topo';
            else if (s === 'tactical' || s === 'dark') this.currentPresetId = 'tactical';
            else if (s === 'satellite' || s === 'hybrid') this.currentPresetId = 'satellite';
            else if (s === 'vivid' || s === 'roadmap') this.currentPresetId = 'vivid';
          }
        }
      } catch (err) {
        console.warn('MapConfig: Could not fetch /api/config:', err.message);
      }
      return this;
    },

    /**
     * Dynamically load the Google Maps JavaScript API script
     */
    loadGoogleMapsApi: function (apiKey) {
      const key = apiKey || this.apiKey;

      if (global.google && global.google.maps) {
        return Promise.resolve(global.google.maps);
      }

      if (googleMapsPromise) {
        return googleMapsPromise;
      }

      if (!key) {
        return Promise.reject(new Error('MISSING_API_KEY'));
      }

      googleMapsPromise = new Promise((resolve, reject) => {
        // Intercept Google Maps authentication error
        const prevAuthFailure = global.gm_authFailure;
        global.gm_authFailure = function () {
          authFailureTriggered = true;
          console.error('Google Maps API Authentication Failed: Check your API key, billing, and referrer restrictions.');
          if (typeof prevAuthFailure === 'function') prevAuthFailure();
          reject(new Error('AUTH_FAILURE'));
        };

        const callbackName = `__meshGoogleMapsInit_${Date.now()}`;
        global[callbackName] = function () {
          delete global[callbackName];
          if (authFailureTriggered) {
            reject(new Error('AUTH_FAILURE'));
          } else {
            resolve(global.google.maps);
          }
        };

        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.async = true;
        script.defer = true;
        // Load places, geometry, and marker libraries
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places,geometry,marker&callback=${callbackName}&v=weekly`;

        script.onerror = function () {
          delete global[callbackName];
          reject(new Error('SCRIPT_LOAD_ERROR'));
        };

        document.head.appendChild(script);
      });

      return googleMapsPromise;
    },

    isAuthFailure: function () {
      return authFailureTriggered;
    }
  };

  global.MapConfig = MapConfig;
})(window);
