/**
 * Map Utilities & Geometry Helpers for Google Maps Integration
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
     * Normalize various coordinate formats to Google Maps { lat, lng } literal
     */
    toGoogleLatLng: function (coord) {
      if (!coord) return null;
      if (typeof coord === 'object') {
        if (typeof coord.lat === 'function' && typeof coord.lng === 'function') {
          return { lat: coord.lat(), lng: coord.lng() };
        }
        const lat = coord.latitude !== undefined ? Number(coord.latitude) : (coord.lat !== undefined ? Number(coord.lat) : undefined);
        const lng = coord.longitude !== undefined ? Number(coord.longitude) : (coord.lng !== undefined ? Number(coord.lng) : (coord.lon !== undefined ? Number(coord.lon) : undefined));
        if (lat !== undefined && lng !== undefined && this.isValidCoordinate(lat, lng)) {
          return { lat, lng };
        }
      }
      if (Array.isArray(coord) && coord.length >= 2) {
        // Check whether first value is lat or lng:
        // By convention in GeoJSON it's [lng, lat], but some APIs provide [lat, lng].
        // If coord[0] is within -90 to 90 and coord[1] is within -180 to 180:
        // We support [lng, lat] (standard GIS) and [lat, lng]
        let lng = Number(coord[0]);
        let lat = Number(coord[1]);
        if (Math.abs(lng) > 90 && Math.abs(lat) <= 90) {
          // Definitely [lng, lat]
          return { lat, lng };
        }
        if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
          // [lat, lng]
          return { lat: lng, lng: lat };
        }
        // Default to [lng, lat] as previously used in the system
        return { lat, lng };
      }
      return null;
    },

    /**
     * Normalize various coordinate formats to [lng, lat] array
     */
    toLngLat: function (coord) {
      const g = this.toGoogleLatLng(coord);
      return g ? [g.lng, g.lat] : null;
    },

    /**
     * Compute google.maps.LatLngBounds for an array of coordinates
     */
    computeBounds: function (points) {
      if (!Array.isArray(points) || points.length === 0) return null;

      if (global.google && global.google.maps && global.google.maps.LatLngBounds) {
        const bounds = new global.google.maps.LatLngBounds();
        let count = 0;
        for (const pt of points) {
          const latLng = this.toGoogleLatLng(pt);
          if (latLng) {
            bounds.extend(latLng);
            count++;
          }
        }
        return count > 0 ? bounds : null;
      }

      // Fallback coordinate rectangle
      let minLng = Infinity, maxLng = -Infinity;
      let minLat = Infinity, maxLat = -Infinity;
      let validCount = 0;

      for (const pt of points) {
        const latLng = this.toGoogleLatLng(pt);
        if (!latLng) continue;
        if (latLng.lng < minLng) minLng = latLng.lng;
        if (latLng.lng > maxLng) maxLng = latLng.lng;
        if (latLng.lat < minLat) minLat = latLng.lat;
        if (latLng.lat > maxLat) maxLat = latLng.lat;
        validCount++;
      }

      if (validCount === 0) return null;
      return {
        south: minLat,
        west: minLng,
        north: maxLat,
        east: maxLng
      };
    },

    /**
     * Safe HTML escape
     */
    escapeHtml: function (str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * Create DOM element with class and HTML
     */
    createElement: function (tag, className, innerHTML) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (innerHTML) el.innerHTML = innerHTML;
      return el;
    }
  };

  global.MapUtils = MapUtils;
})(window);
