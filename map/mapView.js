/**
 * Main Leaflet Map View Controller
 * Coordinates Leaflet initialization, offline/online tile switching,
 * responsive sizing, butter-smooth camera flyTo/fitBounds, and submodules.
 * Handles Leaflet's zoom and tile limits cleanly.
 */
(function (global) {
  'use strict';

  function MapView(containerId, options = {}) {
    this.containerId = containerId;
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    this.options = options;
    this.map = null;
    this.currentTileLayer = null;
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

    if (!global.L) {
      console.error('MapView: Leaflet (L) library is not loaded.');
      this.container.innerHTML = `
        <div class="map-missing-key-card">
          <div class="missing-key-icon">⚠️</div>
          <h3 class="missing-key-title">Leaflet Library Not Loaded</h3>
          <p class="missing-key-desc">Please ensure Leaflet CSS and JS files are included in the page.</p>
        </div>
      `;
      return;
    }

    // Hydrate configuration from .env via /api/config if present
    if (global.MapConfig) {
      await global.MapConfig.loadRuntimeConfig();
    }

    const config = global.MapConfig || {};
    const centerCoords = global.MapUtils.toLatLngArray(this.options.center) || config.defaultCenter || [36.1069, -112.1129];
    const zoomLevel = this.options.zoom !== undefined ? this.options.zoom : (config.defaultZoom || 12);

    // Clear any previous container contents
    this.container.innerHTML = '';

    try {
      // Initialize Leaflet with butter-smooth animation and interaction settings
      this.map = global.L.map(this.container, {
        center: centerCoords,
        zoom: zoomLevel,
        minZoom: config.minZoom || 2,
        maxZoom: config.maxZoom || 20,
        zoomControl: false, // Handled by custom glassmorphism controls
        attributionControl: false,
        // Smoothness & Physics Settings:
        zoomSnap: config.zoomSnap !== undefined ? config.zoomSnap : 0.5,
        zoomDelta: config.zoomDelta !== undefined ? config.zoomDelta : 0.5,
        wheelDebounceTime: 35,
        wheelPxPerZoomLevel: config.wheelPxPerZoomLevel || 100,
        inertia: true,
        inertiaDeceleration: 3000,
        inertiaMaxSpeed: 1600,
        easeLinearity: 0.2,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true,
        bounceAtZoomLimits: true
      });

      // Add styled custom attribution control
      global.L.control.attribution({
        position: 'bottomright',
        prefix: '<span style="color:#00d4aa;font-weight:600;">MeshRoute Leaflet</span>'
      }).addTo(this.map);

      // Apply initial tile preset
      const presetId = config.currentPresetId || 'tactical';
      this.setPreset(presetId);

      // Initialize sub-modules
      this.markerManager.init(this.map);
      this.locationManager.init(this.map);
      this.routeManager.init(this.map);
      this.controls.init(this.map, this.container);

      // Setup responsive resizing
      this.setupResizeHandling();

      this.isReady = true;
      console.log('🗺️ Leaflet MapView initialized successfully with ultra-smooth physics');

      // Execute ready callbacks
      for (const cb of this.onReadyCallbacks) {
        try { cb(this); } catch (e) { console.error(e); }
      }
      this.onReadyCallbacks = [];

    } catch (err) {
      console.error('MapView: Error initializing Leaflet map:', err);
      this.container.innerHTML = `
        <div class="map-missing-key-card">
          <div class="missing-key-icon">⚠️</div>
          <h3 class="missing-key-title">Map Initialization Error</h3>
          <p class="missing-key-desc">${global.MapUtils.escapeHtml(err.message)}</p>
        </div>
      `;
    }
  };

  /**
   * Switch Map Style Preset (tactical, topo, vivid, satellite)
   * Handled with cross-fade and maxNativeZoom limits
   */
  MapView.prototype.setPreset = function (presetId) {
    if (!this.map || !global.MapConfig) return;

    const presets = global.MapConfig.presets;
    const preset = presets[presetId] || presets.tactical;

    const oldLayer = this.currentTileLayer;

    // Create new tile layer with native limits
    const newLayer = global.L.tileLayer(preset.url, {
      attribution: preset.attribution,
      subdomains: preset.subdomains || 'abc',
      maxNativeZoom: preset.maxNativeZoom || 18, // Upscale past provider limit without 404s
      maxZoom: 20,
      keepBuffer: 10,                            // Buffer tiles to prevent blank flashes
      updateWhenIdle: false,
      updateWhenZooming: false,
      crossOrigin: true
    });

    newLayer.addTo(this.map);
    this.currentTileLayer = newLayer;

    // Smoothly remove old layer after new layer is ready
    if (oldLayer) {
      setTimeout(() => {
        try {
          if (this.map.hasLayer(oldLayer)) {
            this.map.removeLayer(oldLayer);
          }
        } catch (e) {}
      }, 300);
    }

    global.MapConfig.currentPresetId = preset.id;

    // Update active UI style button if present
    document.querySelectorAll('.btn-map-style').forEach(btn => {
      const active = btn.dataset.style === preset.id;
      btn.classList.toggle('active', active);
    });
  };

  // Alias for backward compatibility
  MapView.prototype.changePreset = MapView.prototype.setPreset;

  /**
   * Smoothly pan & zoom to coordinates
   */
  MapView.prototype.flyTo = function (target, zoom = 14) {
    if (!this.map) return;
    const latLng = global.MapUtils.toLatLngArray(target);
    if (!latLng) return;

    this.map.flyTo(latLng, zoom, {
      animate: true,
      duration: 1.0,
      easeLinearity: 0.2
    });
  };

  /**
   * Fit map viewport to bounding box or array of points
   */
  MapView.prototype.fitBounds = function (bounds, options = {}) {
    if (!this.map || !bounds) return;
    const padding = options.padding !== undefined ? options.padding : 60;

    let b = bounds;
    if (Array.isArray(bounds) && bounds.length > 0 && typeof bounds[0] !== 'object') {
      b = global.MapUtils.computeBounds(bounds);
    }

    if (b) {
      this.map.fitBounds(b, {
        padding: [padding, padding],
        maxZoom: options.maxZoom || 16,
        animate: true,
        duration: 0.8
      });
    }
  };

  /**
   * Responsive resize observer
   */
  MapView.prototype.setupResizeHandling = function () {
    const self = this;
    if (window.ResizeObserver && this.container) {
      this.resizeObserver = new ResizeObserver(() => {
        if (self.map) {
          self.map.invalidateSize();
        }
      });
      this.resizeObserver.observe(this.container);
    }

    window.addEventListener('resize', () => {
      if (self.map) {
        self.map.invalidateSize();
      }
    });
  };

  MapView.prototype.onReady = function (callback) {
    if (this.isReady) {
      callback(this);
    } else {
      this.onReadyCallbacks.push(callback);
    }
  };

  global.MapView = MapView;
})(window);
