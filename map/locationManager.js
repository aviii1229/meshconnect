/**
 * User Geolocation Manager Module for Google Maps
 * Uses native Navigator Geolocation API (Zero Google Location API dependencies).
 * Renders pulsing blue GPS beacon and accuracy radius circle on Google Maps.
 */
(function (global) {
  'use strict';

  function UserLocationOverlay(latLng, element, map) {
    this.latLng = latLng;
    this.element = element;
    this.map = map;
    this.setMap(map);
  }

  function setupUserLocationOverlayClass() {
    if (!global.google?.maps?.OverlayView) return;
    UserLocationOverlay.prototype = new global.google.maps.OverlayView();

    UserLocationOverlay.prototype.onAdd = function () {
      const panes = this.getPanes();
      if (panes && panes.overlayMouseTarget) {
        panes.overlayMouseTarget.appendChild(this.element);
      }
    };

    UserLocationOverlay.prototype.draw = function () {
      const projection = this.getProjection();
      if (!projection || !this.element || !this.latLng) return;

      const point = projection.fromLatLngToDivPixel(this.latLng);
      if (point) {
        this.element.style.position = 'absolute';
        this.element.style.left = point.x + 'px';
        this.element.style.top = point.y + 'px';
        this.element.style.transform = 'translate(-50%, -50%)';
        this.element.style.zIndex = '150';
      }
    };

    UserLocationOverlay.prototype.onRemove = function () {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    };

    UserLocationOverlay.prototype.setPosition = function (latLng) {
      this.latLng = latLng;
      this.draw();
    };
  }

  function LocationManager(mapView) {
    this.mapView = mapView;
    this.map = null;
    this.overlay = null;
    this.accuracyCircle = null;
    this.element = null;
    this.watchId = null;
    this.isTracking = false;
    this.lastPosition = null;
  }

  LocationManager.prototype.init = function (mapInstance) {
    this.map = mapInstance;
    setupUserLocationOverlayClass();
  };

  /**
   * Request user location via Navigator Geolocation
   */
  LocationManager.prototype.locate = function (options = {}) {
    const self = this;
    const { follow = true, continuous = false, onLocation, onError } = options;

    if (!('geolocation' in navigator)) {
      const err = new Error('Geolocation is not supported by your browser.');
      if (onError) onError(err);
      return;
    }

    if (this.isTracking && !continuous) {
      if (this.lastPosition) {
        this.centerOnPosition(this.lastPosition);
      }
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    };

    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      const latLng = { lat: latitude, lng: longitude };
      self.lastPosition = latLng;
      self.updateLocationDisplay(latLng, accuracy);

      if (follow) {
        self.centerOnPosition(latLng);
      }

      if (onLocation) onLocation(position);
    };

    const handleError = (error) => {
      let message = 'Unable to retrieve your location.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          message = 'Location access was denied. Please allow location permissions in your browser.';
          break;
        case error.POSITION_UNAVAILABLE:
          message = 'GPS location information is currently unavailable.';
          break;
        case error.TIMEOUT:
          message = 'Location request timed out. Please try again.';
          break;
      }
      console.warn('LocationManager:', message);
      if (onError) onError(new Error(message));
    };

    if (continuous) {
      if (this.watchId) {
        navigator.geolocation.clearWatch(this.watchId);
      }
      this.isTracking = true;
      this.watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
    } else {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    }
  };

  /**
   * Update or create blue dot beacon overlay and accuracy circle
   */
  LocationManager.prototype.updateLocationDisplay = function (latLng, accuracy = 0) {
    if (!this.map || !latLng) return;
    const googleLatLng = new google.maps.LatLng(latLng.lat, latLng.lng);

    // 1. Animated Blue Pulse DOM Marker
    if (!this.overlay) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      `;
      this.element = el;
      this.overlay = new UserLocationOverlay(googleLatLng, el, this.map);
    } else {
      this.overlay.setPosition(googleLatLng);
    }

    // 2. Accuracy Circle
    if (!this.accuracyCircle) {
      this.accuracyCircle = new google.maps.Circle({
        map: this.map,
        center: googleLatLng,
        radius: accuracy,
        fillColor: '#0ea5e9',
        fillOpacity: 0.12,
        strokeColor: '#0ea5e9',
        strokeOpacity: 0.6,
        strokeWeight: 1.5,
        clickable: false
      });
    } else {
      this.accuracyCircle.setCenter(googleLatLng);
      this.accuracyCircle.setRadius(accuracy);
    }
  };

  /**
   * Smoothly center camera on user position
   */
  LocationManager.prototype.centerOnPosition = function (latLng, zoom = 14) {
    if (!this.map || !latLng) return;
    const googleLatLng = new google.maps.LatLng(latLng.lat, latLng.lng);
    this.map.panTo(googleLatLng);
    if (this.map.getZoom() < zoom) {
      this.map.setZoom(zoom);
    }
  };

  LocationManager.prototype.stopTracking = function () {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  };

  LocationManager.prototype.destroy = function () {
    this.stopTracking();
    if (this.overlay) {
      this.overlay.setMap(null);
      this.overlay = null;
    }
    if (this.accuracyCircle) {
      this.accuracyCircle.setMap(null);
      this.accuracyCircle = null;
    }
  };

  global.LocationManager = LocationManager;
})(window);
