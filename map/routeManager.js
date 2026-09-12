/**
 * Route & Geometry Rendering Manager for Google Maps
 * Renders high-contrast emergency polylines with casing, glowing accents,
 * and integrates with Google Maps DirectionsService for shortest emergency routes.
 */
(function (global) {
  'use strict';

  function RouteManager(mapView) {
    this.mapView = mapView;
    this.map = null;
    this.routePolyline = null;
    this.casingPolyline = null;
    this.directionsService = null;
    this.currentRoute = null;
  }

  RouteManager.prototype.init = function (mapInstance) {
    this.map = mapInstance;
  };

  /**
   * Render a route path on Google Maps
   * @param {Array<Object|Array>|Object} routeData Array of coordinates or GeoJSON LineString
   * @param {Object} options Visual styling options
   */
  RouteManager.prototype.setRoute = function (routeData, options = {}) {
    if (!this.map || !routeData) return;

    this.clearRoute();

    const {
      color = '#00d4aa',
      casingColor = '#060b14',
      width = 5,
      casingWidth = 8,
      opacity = 0.9,
      fitBounds = true
    } = options;

    const path = this.normalizeCoordinates(routeData);
    if (!path || path.length < 2) {
      console.warn('RouteManager: Invalid path coordinates for route:', routeData);
      return;
    }

    this.currentRoute = { path, options };

    // 1. Casing / Shadow Polyline
    this.casingPolyline = new google.maps.Polyline({
      path: path,
      map: this.map,
      strokeColor: casingColor,
      strokeOpacity: 0.8,
      strokeWeight: casingWidth,
      zIndex: 10
    });

    // 2. Main Route Polyline
    this.routePolyline = new google.maps.Polyline({
      path: path,
      map: this.map,
      strokeColor: color,
      strokeOpacity: opacity,
      strokeWeight: width,
      zIndex: 11
    });

    // Auto-fit route bounds if requested
    if (fitBounds && path.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      for (const pt of path) {
        bounds.extend(pt);
      }
      this.map.fitBounds(bounds, options.padding || 60);
    }
  };

  /**
   * Calculate and render shortest emergency route between two points
   * Uses Google Maps DirectionsService
   */
  RouteManager.prototype.calculateEmergencyRoute = function (origin, destination, options = {}) {
    if (!this.map) return Promise.reject(new Error('Map not initialized'));

    if (!this.directionsService && global.google?.maps?.DirectionsService) {
      this.directionsService = new google.maps.DirectionsService();
    }

    if (!this.directionsService) {
      return Promise.reject(new Error('DirectionsService not available'));
    }

    const origLatLng = global.MapUtils.toGoogleLatLng(origin);
    const destLatLng = global.MapUtils.toGoogleLatLng(destination);

    if (!origLatLng || !destLatLng) {
      return Promise.reject(new Error('Invalid origin or destination coordinates'));
    }

    const request = {
      origin: origLatLng,
      destination: destLatLng,
      travelMode: options.travelMode || google.maps.TravelMode.DRIVING
    };

    return new Promise((resolve, reject) => {
      this.directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          const overviewPath = result.routes[0].overview_path;
          this.setRoute(overviewPath, options);
          resolve(result);
        } else {
          console.warn('RouteManager: Directions request failed:', status);
          reject(new Error(`Directions request failed: ${status}`));
        }
      });
    });
  };

  /**
   * Convert various coordinate formats to array of google.maps.LatLng
   */
  RouteManager.prototype.normalizeCoordinates = function (data) {
    if (!data) return null;

    let points = [];
    if (Array.isArray(data)) {
      points = data;
    } else if (data.type === 'Feature' && data.geometry && Array.isArray(data.geometry.coordinates)) {
      points = data.geometry.coordinates;
    } else if (data.type === 'LineString' && Array.isArray(data.coordinates)) {
      points = data.coordinates;
    }

    const result = [];
    for (const pt of points) {
      const g = global.MapUtils.toGoogleLatLng(pt);
      if (g) {
        result.push(new google.maps.LatLng(g.lat, g.lng));
      }
    }
    return result;
  };

  /**
   * Remove the active route from the map
   */
  RouteManager.prototype.clearRoute = function () {
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
      this.routePolyline = null;
    }
    if (this.casingPolyline) {
      this.casingPolyline.setMap(null);
      this.casingPolyline = null;
    }
    this.currentRoute = null;
  };

  RouteManager.prototype.destroy = function () {
    this.clearRoute();
    this.directionsService = null;
  };

  global.RouteManager = RouteManager;
})(window);
