/**
 * Route & Geometry Rendering Manager for Leaflet
 * Renders high-contrast emergency polylines with casing, glowing accents,
 * and multi-hop mesh trajectory vectors.
 */
(function (global) {
  'use strict';

  function RouteManager(mapView) {
    this.mapView = mapView;
    this.map = null;
    this.routePolyline = null;
    this.casingPolyline = null;
    this.currentRoute = null;
  }

  RouteManager.prototype.init = function (mapInstance) {
    this.map = mapInstance;
  };

  /**
   * Render a route path on Leaflet map
   * @param {Array<Object|Array>} routeData Array of coordinates [lat, lng] or { lat, lng }
   * @param {Object} options Visual styling options
   */
  RouteManager.prototype.setRoute = function (routeData, options = {}) {
    if (!this.map || !global.L || !routeData) return;

    this.clearRoute();

    const {
      color = '#00d4aa',
      casingColor = '#060b14',
      width = 4,
      casingWidth = 7,
      opacity = 0.9,
      fitBounds = true
    } = options;

    const path = this.normalizeCoordinates(routeData);
    if (!path || path.length < 2) {
      console.warn('RouteManager: Invalid path coordinates for route:', routeData);
      return;
    }

    this.currentRoute = { path, options };

    // 1. Casing / Shadow Polyline (Dark contrast backdrop)
    this.casingPolyline = global.L.polyline(path, {
      color: casingColor,
      weight: casingWidth,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    // 2. Main Route Polyline (Vibrant cyan/emerald)
    this.routePolyline = global.L.polyline(path, {
      color: color,
      weight: width,
      opacity: opacity,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: options.dashed ? '6, 8' : null
    }).addTo(this.map);

    // Auto-fit route bounds if requested
    if (fitBounds && path.length > 0) {
      this.map.fitBounds(this.routePolyline.getBounds(), {
        padding: [options.padding || 60, options.padding || 60],
        animate: true
      });
    }
  };

  /**
   * Convert arbitrary coordinates array to Leaflet [lat, lng] array
   */
  RouteManager.prototype.normalizeCoordinates = function (rawCoords) {
    if (!Array.isArray(rawCoords)) return null;
    const normalized = [];

    for (const item of rawCoords) {
      const arr = global.MapUtils.toLatLngArray(item);
      if (arr) normalized.push(arr);
    }

    return normalized.length >= 2 ? normalized : null;
  };

  /**
   * Clear current route from map
   */
  RouteManager.prototype.clearRoute = function () {
    if (this.routePolyline && this.map) {
      this.map.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }
    if (this.casingPolyline && this.map) {
      this.map.removeLayer(this.casingPolyline);
      this.casingPolyline = null;
    }
    this.currentRoute = null;
  };

  global.RouteManager = RouteManager;
})(window);
