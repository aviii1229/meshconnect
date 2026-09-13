/**
 * Map Utilities & Geometry Helpers for Leaflet Integration
 */
(function (global) {
  'use strict';

  const MapUtils = {
    /**
     * Validate latitude and longitude values
     */
    isValidCoordinate: function (lat, lng) {
      if (typeof lat !== 'number' || typeof lng !== 'number') return false;
      if (isNaN(lat) || isNaN(lng)) return false;
      return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    },

    /**
     * Normalize coordinate to Leaflet [lat, lng] array
     */
    toLatLngArray: function (coord) {
      if (!coord) return null;

      // Leaflet LatLng object or object with lat/lng
      if (typeof coord === 'object') {
        const lat = coord.lat !== undefined ? Number(coord.lat) : (coord.latitude !== undefined ? Number(coord.latitude) : undefined);
        const lng = coord.lng !== undefined ? Number(coord.lng) : (coord.longitude !== undefined ? Number(coord.longitude) : (coord.lon !== undefined ? Number(coord.lon) : undefined));
        if (lat !== undefined && lng !== undefined && this.isValidCoordinate(lat, lng)) {
          return [lat, lng];
        }
      }

      // Array [lng, lat] or [lat, lng]
      if (Array.isArray(coord) && coord.length >= 2) {
        let v0 = Number(coord[0]);
        let v1 = Number(coord[1]);
        // If v0 is clearly longitude (> 90 or < -90) and v1 is valid lat:
        if (Math.abs(v0) > 90 && Math.abs(v1) <= 90) {
          return [v1, v0]; // return [lat, lng]
        }
        // If v1 is clearly longitude (> 90 or < -90) and v0 is valid lat:
        if (Math.abs(v1) > 90 && Math.abs(v0) <= 90) {
          return [v0, v1]; // return [lat, lng]
        }
        // Default assumption: [lat, lng]
        return [v0, v1];
      }

      return null;
    },

    /**
     * Normalize coordinate to { lat, lng } object
     */
    toLatLngObj: function (coord) {
      const arr = this.toLatLngArray(coord);
      return arr ? { lat: arr[0], lng: arr[1] } : null;
    },

    /**
     * Generate Google Maps URL for coordinates
     */
    toGoogleMapsUrl: function (coord) {
      const arr = this.toLatLngArray(coord);
      if (!arr) return '#';
      return `https://www.google.com/maps?q=${arr[0]},${arr[1]}`;
    },

    /**
     * Compute Leaflet LatLngBounds for an array of points
     */
    computeBounds: function (points) {
      if (!Array.isArray(points) || points.length === 0) return null;
      const validPoints = [];

      for (const pt of points) {
        const arr = this.toLatLngArray(pt);
        if (arr) validPoints.push(arr);
      }

      if (validPoints.length === 0) return null;
      if (global.L && global.L.latLngBounds) {
        return global.L.latLngBounds(validPoints);
      }

      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;

      for (const [lat, lng] of validPoints) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }

      return [[minLat, minLng], [maxLat, maxLng]];
    },

    /**
     * Calculate Great Circle distance (Haversine formula in meters)
     */
    computeDistanceMeters: function (coord1, coord2) {
      const p1 = this.toLatLngArray(coord1);
      const p2 = this.toLatLngArray(coord2);
      if (!p1 || !p2) return 0;

      const R = 6371000; // Earth radius in meters
      const dLat = (p2[0] - p1[0]) * Math.PI / 180;
      const dLon = (p2[1] - p1[1]) * Math.PI / 180;
      const lat1 = p1[0] * Math.PI / 180;
      const lat2 = p2[0] * Math.PI / 180;

      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },

    /**
     * Safe HTML escaping
     */
    escapeHtml: function (str) {
      if (str === null || str === undefined) return '';
      const div = document.createElement('div');
      div.textContent = String(str);
      return div.innerHTML;
    }
  };

  global.MapUtils = MapUtils;
})(window);
