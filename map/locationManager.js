/**
 * User Geolocation Manager Module for Leaflet
 * Uses native Navigator Geolocation API (Zero external location service dependencies).
 * Renders pulsing blue GPS beacon and accuracy radius circle on Leaflet map.
 */
(function (global) {
  'use strict';

  function LocationManager(mapView) {
    this.mapView = mapView;
    this.map = null;
    this.userMarker = null;
    this.accuracyCircle = null;
    this.watchId = null;
    this.isTracking = false;
    this.lastPosition = null;
  }

  LocationManager.prototype.init = function (mapInstance) {
    this.map = mapInstance;
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
      const latLng = [latitude, longitude];
      self.lastPosition = latLng;
      self.updateLocationDisplay(latLng, accuracy);

      if (follow && self.map) {
        self.map.flyTo(latLng, Math.max(self.map.getZoom(), 14), {
          animate: true,
          duration: 1.2
        });
      }

      if (onLocation) onLocation(latLng, accuracy, position);
    };

    const handleError = (error) => {
      let msg = 'Unable to retrieve your location.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          msg = 'Location permission was denied. Please allow location access in your browser.';
          break;
        case error.POSITION_UNAVAILABLE:
          msg = 'GPS location information is currently unavailable.';
          break;
        case error.TIMEOUT:
          msg = 'Location request timed out.';
          break;
      }
      const err = new Error(msg);
      err.code = error.code;
      if (onError) onError(err);
    };

    if (continuous) {
      this.isTracking = true;
      this.watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);
    } else {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    }
  };

  /**
   * Update or create the pulsing blue location marker and accuracy circle
   */
  LocationManager.prototype.updateLocationDisplay = function (latLng, accuracy) {
    if (!this.map || !global.L) return;

    if (!this.userMarker) {
      const iconHtml = `
        <div class="user-location-marker-wrapper">
          <div class="user-location-pulse"></div>
          <div class="user-location-dot"></div>
        </div>
      `;

      const divIcon = global.L.divIcon({
        className: 'mesh-user-location-icon',
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      this.userMarker = global.L.marker(latLng, {
        icon: divIcon,
        zIndexOffset: 1500,
        title: 'Your Current Location'
      }).addTo(this.map);
    } else {
      this.userMarker.setLatLng(latLng);
    }

    if (accuracy && accuracy > 0) {
      if (!this.accuracyCircle) {
        this.accuracyCircle = global.L.circle(latLng, {
          radius: accuracy,
          color: '#38bdf8',
          fillColor: '#38bdf8',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '2, 4'
        }).addTo(this.map);
      } else {
        this.accuracyCircle.setLatLng(latLng);
        this.accuracyCircle.setRadius(accuracy);
      }
    }
  };

  LocationManager.prototype.centerOnPosition = function (latLng) {
    if (this.map && latLng) {
      this.map.flyTo(latLng, Math.max(this.map.getZoom(), 14), {
        animate: true,
        duration: 1.0
      });
    }
  };

  LocationManager.prototype.stopTracking = function () {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
  };

  LocationManager.prototype.clear = function () {
    this.stopTracking();
    if (this.userMarker && this.map) {
      this.map.removeLayer(this.userMarker);
      this.userMarker = null;
    }
    if (this.accuracyCircle && this.map) {
      this.map.removeLayer(this.accuracyCircle);
      this.accuracyCircle = null;
    }
    this.lastPosition = null;
  };

  global.LocationManager = LocationManager;
})(window);
