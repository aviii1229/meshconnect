/**
 * Main Google Maps View Controller
 * Coordinates map initialization, dynamic Google Maps script loading,
 * camera transitions, presets, responsive sizing, and submodules.
 */
(function (global) {
  'use strict';

  function MapView(containerId, options = {}) {
    this.containerId = containerId;
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    this.options = options;
    this.map = null;
    this.isReady = false;

    // Sub-modules
    this.markerManager = new global.MarkerManager(this);
    this.locationManager = new global.LocationManager(this);
    this.routeManager = new global.RouteManager(this);
    this.controls = new global.MapControls(this);

    this.resizeObserver = null;
    this.onReadyCallbacks = [];
  }

  MapView.prototype.init = async function () {
    const self = this;

    if (!this.container) {
      console.error(`MapView: Container #${this.containerId} not found.`);
      return;
    }

    // Display subtle loading state
    this.showLoadingUI();

    // Hydrate configuration from .env via /api/config
    if (global.MapConfig) {
      await global.MapConfig.loadRuntimeConfig();
    }

    const config = global.MapConfig || {};

    // Check if API key is present
    if (!config.apiKey && !global.google?.maps) {
      this.showMissingKeyUI();
      return;
    }

    try {
      await config.loadGoogleMapsApi(config.apiKey);
    } catch (err) {
      console.error('MapView: Failed to load Google Maps API:', err);
      if (err.message === 'MISSING_API_KEY') {
        this.showMissingKeyUI();
      } else if (err.message === 'AUTH_FAILURE') {
        this.showAuthErrorUI();
      } else {
        this.showErrorUI('Unable to load Google Maps. Please check your connection and try again.');
      }
      return;
    }

    if (!global.google || !global.google.maps) {
      this.showErrorUI('Unable to load Google Maps. Please check your connection and try again.');
      return;
    }

    // Clear loading state
    this.container.innerHTML = '';

    const centerCoords = global.MapUtils.toGoogleLatLng(this.options.center) || config.defaultCenter || { lat: 36.1069, lng: -112.1129 };
    const zoomLevel = this.options.zoom !== undefined ? this.options.zoom : (config.defaultZoom || 12);
    const initialPreset = config.presets[config.currentPresetId] || config.presets.topo;

    const mapOptions = {
      center: centerCoords,
      zoom: zoomLevel,
      minZoom: config.minZoom || 2,
      maxZoom: config.maxZoom || 21,
      mapTypeId: initialPreset.mapTypeId || google.maps.MapTypeId.TERRAIN,
      disableDefaultUI: true, // Custom controls handle zoom/locate/fullscreen
      gestureHandling: 'greedy', // Smooth pinch, pan, touch gestures
      scrollwheel: true,
      keyboardShortcuts: true,
      tilt: 0,
      mapTypeControl: false,
      zoomControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      backgroundColor: '#060b14',
      styles: initialPreset.styles || null
    };

    if (config.mapId) {
      mapOptions.mapId = config.mapId;
    }

    try {
      this.map = new google.maps.Map(this.container, mapOptions);

      // Add custom styles if tactical preset was selected
      if (config.currentPresetId === 'tactical') {
        this.container.classList.add('theme-dark');
      }

      // Initialize sub-modules
      this.markerManager.init(this.map);
      this.locationManager.init(this.map);
      this.routeManager.init(this.map);
      this.controls.init(this.map, this.container);

      this.setupResizeObserver();

      // Wait for map tiles/idle
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        self.isReady = true;
        for (const cb of self.onReadyCallbacks) {
          try { cb(self); } catch (e) { console.error(e); }
        }
        self.onReadyCallbacks = [];
      });

    } catch (err) {
      console.error('MapView: Exception during google.maps.Map instantiation:', err);
      this.showErrorUI(err.message);
    }
  };

  /**
   * Execute callback when map is fully initialized
   */
  MapView.prototype.onReady = function (callback) {
    if (this.isReady) {
      callback(this);
    } else {
      this.onReadyCallbacks.push(callback);
    }
  };

  /**
   * Keep map viewport perfectly sized with smooth resize observation
   */
  MapView.prototype.setupResizeObserver = function () {
    if ('ResizeObserver' in window && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.map && global.google?.maps?.event) {
          google.maps.event.trigger(this.map, 'resize');
        }
      });
      this.resizeObserver.observe(this.container);
    }
  };

  /**
   * Smooth flyTo / camera pan animation
   */
  MapView.prototype.flyTo = function (coords, zoom = 14) {
    if (!this.map) return;
    const latLng = global.MapUtils.toGoogleLatLng(coords);
    if (!latLng) return;

    this.map.panTo(latLng);
    if (typeof zoom === 'number') {
      // Smooth step zoom if distant
      const currentZoom = this.map.getZoom();
      if (Math.abs(currentZoom - zoom) > 3) {
        this.map.setZoom(Math.round((currentZoom + zoom) / 2));
        setTimeout(() => {
          if (this.map) this.map.setZoom(zoom);
        }, 200);
      } else {
        this.map.setZoom(zoom);
      }
    }
  };

  /**
   * Fit all markers or coordinates within bounds
   */
  MapView.prototype.fitBounds = function (bounds, options = {}) {
    if (!this.map || !bounds) return;

    if (bounds instanceof google.maps.LatLngBounds) {
      this.map.fitBounds(bounds, options.padding || 60);
      return;
    }

    if (Array.isArray(bounds)) {
      const gBounds = global.MapUtils.computeBounds(bounds);
      if (gBounds) {
        this.map.fitBounds(gBounds, options.padding || 60);
      }
      return;
    }

    if (typeof bounds === 'object' && bounds.south !== undefined) {
      this.map.fitBounds(bounds, options.padding || 60);
    }
  };

  /**
   * Change map preset (topo / tactical / vivid / satellite)
   */
  MapView.prototype.changePreset = function (presetId) {
    if (!this.map || !global.MapConfig || !global.MapConfig.presets) return;
    const preset = global.MapConfig.presets[presetId];
    if (!preset) return;

    global.MapConfig.currentPresetId = presetId;

    if (preset.mapTypeId) {
      this.map.setMapTypeId(preset.mapTypeId);
    }

    // Apply or clear custom dark styles
    if (preset.styles) {
      this.map.setOptions({ styles: preset.styles });
    } else {
      this.map.setOptions({ styles: null });
    }

    if (this.container) {
      if (presetId === 'tactical') {
        this.container.classList.add('theme-dark');
      } else {
        this.container.classList.remove('theme-dark');
      }
    }
  };

  /**
   * Subtle loading state
   */
  MapView.prototype.showLoadingUI = function () {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="map-loading-overlay" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#060b14;color:#94a3b8;gap:12px;">
        <div class="map-spinner" style="width:36px;height:36px;border:3px solid rgba(0,212,170,0.2);border-top-color:#00d4aa;border-radius:50%;animation:spin 0.9s linear infinite;"></div>
        <span style="font-size:0.85rem;font-family:var(--font-sans);letter-spacing:0.04em;">Initializing Google Maps Satellite & Terrain...</span>
      </div>
    `;
  };

  /**
   * Developer-facing missing API key instructions
   */
  MapView.prototype.showMissingKeyUI = function () {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="map-error-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#060b14;color:#cbd5e1;padding:32px;text-align:center;">
        <div style="font-size:2.8rem;margin-bottom:12px;">🗺️</div>
        <h3 style="color:#f8fafc;font-size:1.15rem;font-weight:700;margin-bottom:8px;">Google Maps API Key Required</h3>
        <p style="font-size:0.85rem;max-width:440px;line-height:1.55;color:#94a3b8;margin-bottom:16px;">
          MeshRoute requires a <strong>Google Maps JavaScript API</strong> key to render high-resolution road, contour relief, and satellite map tiles.
        </p>
        <div style="background:rgba(15,23,42,0.85);border:1px solid #1e293b;border-radius:8px;padding:14px 18px;text-align:left;font-family:var(--font-mono);font-size:0.75rem;color:#38bdf8;max-width:480px;width:100%;margin-bottom:16px;line-height:1.6;">
          <div style="color:#64748b;margin-bottom:4px;"># Add your key to .env:</div>
          <div>GOOGLE_MAPS_API_KEY=AIzaSy...</div>
          <div style="color:#64748b;margin-top:8px;"># Enable in Google Cloud Console:</div>
          <div style="color:#34d399;">✓ Maps JavaScript API</div>
        </div>
        <button class="btn btn-secondary" style="font-size:0.82rem;padding:8px 16px;" onclick="location.reload()">
          Refresh After Setting Key
        </button>
      </div>
    `;
  };

  /**
   * Authentication or quota failure state
   */
  MapView.prototype.showAuthErrorUI = function () {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="map-error-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#060b14;color:#cbd5e1;padding:32px;text-align:center;">
        <div style="font-size:2.8rem;margin-bottom:12px;color:#f43f5e;">⚠️</div>
        <h3 style="color:#f8fafc;font-size:1.15rem;font-weight:700;margin-bottom:8px;">Google Maps Key Authorization Error</h3>
        <p style="font-size:0.85rem;max-width:440px;line-height:1.55;color:#94a3b8;margin-bottom:16px;">
          The configured Google Maps API key was rejected by Google Cloud. Please ensure the <strong>Maps JavaScript API</strong> is enabled and referrer restrictions allow this domain.
        </p>
        <button class="btn btn-secondary" style="font-size:0.82rem;padding:8px 16px;" onclick="location.reload()">
          Retry Connection
        </button>
      </div>
    `;
  };

  /**
   * Standard connection error state requested by prompt specification
   */
  MapView.prototype.showErrorUI = function (detail) {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="map-error-state" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;background:#060b14;color:#94a3b8;padding:24px;text-align:center;">
        <span style="font-size:2.5rem;margin-bottom:12px;">🗺️</span>
        <h4 style="color:#f8fafc;margin-bottom:8px;font-size:1.1rem;font-weight:700;">Map unavailable</h4>
        <p style="font-size:0.85rem;max-width:340px;line-height:1.5;margin-bottom:6px;">Unable to load Google Maps.<br>Please check your connection and try again.</p>
        ${detail ? `<p style="font-size:0.75rem;color:#64748b;font-family:var(--font-mono);">${global.MapUtils.escapeHtml(detail)}</p>` : ''}
        <button class="btn btn-secondary" style="margin-top:16px;font-size:0.82rem;padding:7px 16px;" onclick="location.reload()">Retry Connection</button>
      </div>
    `;
  };

  /**
   * Clean lifecycle destruction
   */
  MapView.prototype.destroy = function () {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.controls) this.controls.destroy();
    if (this.markerManager) this.markerManager.destroy();
    if (this.locationManager) this.locationManager.destroy();
    if (this.routeManager) this.routeManager.destroy();

    this.map = null;
    this.isReady = false;
  };

  global.MapView = MapView;
})(window);
