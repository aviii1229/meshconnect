/**
 * Reusable Marker Manager Module for Google Maps
 * Handles dynamic emergency beacons, custom HTML overlays, accuracy circles,
 * InfoWindows, and modular emergency marker types.
 */
(function (global) {
  'use strict';

  // Marker Type Registry & Visual Aesthetics
  const MARKER_TYPES = {
    sos: {
      label: 'SOS Alert',
      icon: '🚨',
      bgGradient: 'radial-gradient(circle, #f43f5e 0%, #be123c 100%)',
      glowColor: 'rgba(225, 29, 72, 0.9)',
      rippleColor: '#e11d48',
      circleColor: '#ef4444',
      pulse: true
    },
    person_in_danger: {
      label: 'Person in Danger',
      icon: '🆘',
      bgGradient: 'radial-gradient(circle, #ef4444 0%, #991b1b 100%)',
      glowColor: 'rgba(239, 68, 68, 0.9)',
      rippleColor: '#ef4444',
      circleColor: '#ef4444',
      pulse: true
    },
    victim: {
      label: 'Victim',
      icon: '⚠️',
      bgGradient: 'radial-gradient(circle, #f97316 0%, #c2410c 100%)',
      glowColor: 'rgba(249, 115, 22, 0.8)',
      rippleColor: '#f97316',
      circleColor: '#f97316',
      pulse: true
    },
    rescue_team: {
      label: 'Rescue Team',
      icon: '🚁',
      bgGradient: 'radial-gradient(circle, #38bdf8 0%, #0369a1 100%)',
      glowColor: 'rgba(56, 189, 248, 0.8)',
      rippleColor: '#38bdf8',
      circleColor: '#38bdf8',
      pulse: false
    },
    safe_zone: {
      label: 'Safe Zone',
      icon: '🛡️',
      bgGradient: 'radial-gradient(circle, #10b981 0%, #065f46 100%)',
      glowColor: 'rgba(16, 185, 129, 0.8)',
      rippleColor: '#10b981',
      circleColor: '#10b981',
      pulse: false
    },
    emergency_center: {
      label: 'Emergency Command Center',
      icon: '🏢',
      bgGradient: 'radial-gradient(circle, #6366f1 0%, #3730a3 100%)',
      glowColor: 'rgba(99, 102, 241, 0.8)',
      rippleColor: '#6366f1',
      circleColor: '#6366f1',
      pulse: false
    },
    hospital: {
      label: 'Hospital / Medical Aid',
      icon: '🏥',
      bgGradient: 'radial-gradient(circle, #f43f5e 0%, #881337 100%)',
      glowColor: 'rgba(244, 63, 94, 0.8)',
      rippleColor: '#f43f5e',
      circleColor: '#f43f5e',
      pulse: false
    },
    police_station: {
      label: 'Police Station / Security',
      icon: '🚓',
      bgGradient: 'radial-gradient(circle, #3b82f6 0%, #1e40af 100%)',
      glowColor: 'rgba(59, 130, 246, 0.8)',
      rippleColor: '#3b82f6',
      circleColor: '#3b82f6',
      pulse: false
    },
    mesh_node: {
      label: 'Mesh Relay Node',
      icon: '📡',
      bgGradient: 'radial-gradient(circle, #00d4aa 0%, #0f766e 100%)',
      glowColor: 'rgba(0, 212, 170, 0.8)',
      rippleColor: '#00d4aa',
      circleColor: '#00d4aa',
      pulse: false
    },
    network_node: {
      label: 'Network Node',
      icon: '🌐',
      bgGradient: 'radial-gradient(circle, #8b5cf6 0%, #5b21b6 100%)',
      glowColor: 'rgba(139, 92, 246, 0.8)',
      rippleColor: '#8b5cf6',
      circleColor: '#8b5cf6',
      pulse: false
    },
    gateway: {
      label: 'Mesh Gateway',
      icon: '🛰️',
      bgGradient: 'radial-gradient(circle, #f59e0b 0%, #b45309 100%)',
      glowColor: 'rgba(245, 158, 11, 0.8)',
      rippleColor: '#f59e0b',
      circleColor: '#f59e0b',
      pulse: false
    },
    trekker: {
      label: 'Trekker / User',
      icon: '🥾',
      bgGradient: 'radial-gradient(circle, #0ea5e9 0%, #0369a1 100%)',
      glowColor: 'rgba(14, 165, 233, 0.8)',
      rippleColor: '#0ea5e9',
      circleColor: '#0ea5e9',
      pulse: false
    }
  };

  /**
   * Custom HTML OverlayView for Google Maps
   * Seamlessly renders CSS-animated DOM elements at specific LatLng coordinates.
   */
  function HtmlOverlay(latLng, element, map) {
    this.latLng = latLng;
    this.element = element;
    this.map = map;
    this.setMap(map);
  }

  function setupHtmlOverlayClass() {
    if (!global.google?.maps?.OverlayView) return;
    HtmlOverlay.prototype = new global.google.maps.OverlayView();

    HtmlOverlay.prototype.onAdd = function () {
      const panes = this.getPanes();
      if (panes && panes.overlayMouseTarget) {
        panes.overlayMouseTarget.appendChild(this.element);
      }
    };

    HtmlOverlay.prototype.draw = function () {
      const projection = this.getProjection();
      if (!projection || !this.element || !this.latLng) return;

      const point = projection.fromLatLngToDivPixel(this.latLng);
      if (point) {
        this.element.style.position = 'absolute';
        this.element.style.left = point.x + 'px';
        this.element.style.top = point.y + 'px';
        this.element.style.transform = 'translate(-50%, -50%)';
        this.element.style.zIndex = '100';
      }
    };

    HtmlOverlay.prototype.onRemove = function () {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
      }
    };

    HtmlOverlay.prototype.setPosition = function (latLng) {
      this.latLng = latLng;
      this.draw();
    };

    HtmlOverlay.prototype.setVisible = function (visible) {
      if (this.element) {
        this.element.style.display = visible ? 'block' : 'none';
      }
    };
  }

  function MarkerManager(mapView) {
    this.mapView = mapView;
    this.map = null;
    this.markers = new Map(); // id -> { id, overlay, circle, infoWindow, data, latLng, status, type }
    this.accuracyRingsVisible = true;
    this.activeInfoWindow = null;
    this.markerTypes = MARKER_TYPES;
  }

  MarkerManager.prototype.init = function (mapInstance) {
    this.map = mapInstance;
    setupHtmlOverlayClass();
  };

  /**
   * Primary method to add or update a marker on Google Maps
   * @param {Object} config
   *   latitude, longitude, type, status, title, description, hops, accuracy, popupHtml, onClick
   */
  MarkerManager.prototype.addMarker = function (config) {
    if (!this.map || !config) return null;

    const latLng = global.MapUtils.toGoogleLatLng(config);
    if (!latLng) {
      console.warn('MarkerManager: Invalid coordinates for marker:', config);
      return null;
    }

    const id = String(config.id || config.incident_id || `marker-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`);
    const status = (config.status || 'NEW').toUpperCase();
    const typeKey = this.resolveMarkerType(config.type, status);
    const typeDef = this.markerTypes[typeKey] || this.markerTypes.sos;
    const hops = config.hops !== undefined ? config.hops : 0;
    const accuracy = (config.location && config.location.accuracy) || config.accuracy || 15;

    // If marker already exists, smoothly update it
    if (this.markers.has(id)) {
      return this.updateMarker(id, { latLng, status, hops, accuracy, config, typeKey });
    }

    // 1. Build custom animated DOM beacon element
    const el = this.createMarkerElement(status, hops, typeKey, config);

    // 2. Build Google Maps LatLng object
    const googleLatLng = new google.maps.LatLng(latLng.lat, latLng.lng);

    // 3. Create Custom HTML Overlay
    const overlay = new HtmlOverlay(googleLatLng, el, this.map);

    // 4. Build InfoWindow
    let infoWindow = null;
    const popupContent = config.popupHtml || (typeof config.buildPopup === 'function' ? config.buildPopup(config) : this.buildDefaultPopup(config, typeDef));
    if (popupContent) {
      infoWindow = new google.maps.InfoWindow({
        content: popupContent,
        disableAutoPan: false,
        pixelOffset: new google.maps.Size(0, -18)
      });
    }

    // 5. Build Accuracy Radius Circle
    let circle = null;
    if (accuracy && accuracy > 0) {
      const circleColor = status === 'RESOLVED' ? '#10b981' : (status === 'ACKNOWLEDGED' ? '#f59e0b' : typeDef.circleColor);
      circle = new google.maps.Circle({
        map: this.map,
        center: googleLatLng,
        radius: accuracy,
        fillColor: circleColor,
        fillOpacity: 0.12,
        strokeColor: circleColor,
        strokeOpacity: 0.6,
        strokeWeight: 1.5,
        visible: this.accuracyRingsVisible,
        clickable: false
      });
    }

    const markerEntry = {
      id,
      overlay,
      circle,
      infoWindow,
      element: el,
      data: config,
      latLng,
      googleLatLng,
      status,
      type: typeKey,
      accuracy
    };

    // Click handler for beacon element
    el.addEventListener('click', (e) => {
      e.stopPropagation();

      if (this.activeInfoWindow) {
        this.activeInfoWindow.close();
      }

      if (infoWindow) {
        infoWindow.setPosition(googleLatLng);
        infoWindow.open({
          map: this.map
        });
        this.activeInfoWindow = infoWindow;
      }

      if (typeof config.onClick === 'function') {
        config.onClick(config);
      }
    });

    this.markers.set(id, markerEntry);
    return markerEntry;
  };

  /**
   * Resolve marker type key based on type and status
   */
  MarkerManager.prototype.resolveMarkerType = function (rawType, status) {
    if (rawType) {
      const key = String(rawType).toLowerCase().replace(/[\s-]+/g, '_');
      if (this.markerTypes[key]) return key;
    }

    // Map emergency incident status to marker types
    if (status === 'RESOLVED') return 'safe_zone';
    if (status === 'ACKNOWLEDGED') return 'victim';
    return 'sos';
  };

  /**
   * Create animated high-contrast beacon element
   */
  MarkerManager.prototype.createMarkerElement = function (status, hops, typeKey, config) {
    const typeDef = this.markerTypes[typeKey] || this.markerTypes.sos;
    let statusClass = 'status-new';
    let iconLabel = typeDef.icon;

    if (status === 'ACKNOWLEDGED') {
      statusClass = 'status-acknowledged';
      iconLabel = '⚡' + (hops > 0 ? hops : '');
    } else if (status === 'RESOLVED') {
      statusClass = 'status-resolved';
      iconLabel = '✓';
    } else if (hops > 0 && typeKey === 'sos') {
      iconLabel = hops;
    }

    const el = document.createElement('div');
    el.className = `sos-beacon-marker ${statusClass} marker-type-${typeKey}`;
    el.title = config.title || typeDef.label;

    const shouldPulse = status === 'NEW' && typeDef.pulse;

    el.innerHTML = `
      ${shouldPulse ? '<div class="beacon-ripple"></div><div class="beacon-ripple delay-1"></div><div class="beacon-ripple delay-2"></div>' : ''}
      <div class="beacon-core" style="${status === 'NEW' ? `background:${typeDef.bgGradient};box-shadow:0 0 16px ${typeDef.glowColor}, 0 3px 8px rgba(0,0,0,0.6);` : ''}">
        ${iconLabel}
      </div>
    `;

    return el;
  };

  /**
   * Update an existing marker's position, status, hops, or popup
   */
  MarkerManager.prototype.updateMarker = function (id, updates) {
    const entry = this.markers.get(id);
    if (!entry) return null;

    if (updates.latLng) {
      entry.latLng = updates.latLng;
      entry.googleLatLng = new google.maps.LatLng(updates.latLng.lat, updates.latLng.lng);
      entry.overlay.setPosition(entry.googleLatLng);
      if (entry.circle) {
        entry.circle.setCenter(entry.googleLatLng);
      }
    }

    if (updates.accuracy && entry.circle) {
      entry.accuracy = updates.accuracy;
      entry.circle.setRadius(updates.accuracy);
    }

    if (updates.status && updates.status !== entry.status) {
      entry.status = updates.status;
      const typeKey = updates.typeKey || this.resolveMarkerType(entry.data.type, entry.status);
      const newEl = this.createMarkerElement(entry.status, updates.hops || entry.data.hops || 0, typeKey, entry.data);
      entry.element.className = newEl.className;
      entry.element.innerHTML = newEl.innerHTML;

      // Update circle color
      if (entry.circle) {
        const circleColor = entry.status === 'RESOLVED' ? '#10b981' : (entry.status === 'ACKNOWLEDGED' ? '#f59e0b' : '#ef4444');
        entry.circle.setOptions({
          fillColor: circleColor,
          strokeColor: circleColor
        });
      }
    }

    if (updates.config) {
      entry.data = Object.assign(entry.data, updates.config);
      if (updates.config.popupHtml && entry.infoWindow) {
        entry.infoWindow.setContent(updates.config.popupHtml);
      }
    }

    return entry;
  };

  /**
   * Default InfoWindow content builder for arbitrary markers
   */
  MarkerManager.prototype.buildDefaultPopup = function (config, typeDef) {
    const title = config.title || typeDef.label;
    const desc = config.description || 'Emergency Network Node';
    const lat = config.latitude || (config.latLng && config.latLng.lat) || '0.0';
    const lng = config.longitude || (config.latLng && config.latLng.lng) || '0.0';

    return `
      <div class="popup-card">
        <div class="popup-header">
          <span class="popup-badge status-new">${typeDef.icon} ${global.MapUtils.escapeHtml(title)}</span>
        </div>
        <div class="popup-msg-box">
          <p>${global.MapUtils.escapeHtml(desc)}</p>
        </div>
        <div class="popup-details">
          <div class="popup-detail-item">
            <span class="popup-detail-label">Location</span>
            <span class="popup-detail-val">${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}</span>
          </div>
        </div>
      </div>
    `;
  };

  /**
   * Remove a single marker by ID
   */
  MarkerManager.prototype.removeMarker = function (id) {
    const entry = this.markers.get(id);
    if (!entry) return false;

    if (entry.overlay) {
      entry.overlay.setMap(null);
    }
    if (entry.circle) {
      entry.circle.setMap(null);
    }
    if (entry.infoWindow) {
      entry.infoWindow.close();
    }
    this.markers.delete(id);
    return true;
  };

  /**
   * Clear all markers
   */
  MarkerManager.prototype.clearMarkers = function () {
    for (const [id, entry] of this.markers.entries()) {
      if (entry.overlay) entry.overlay.setMap(null);
      if (entry.circle) entry.circle.setMap(null);
      if (entry.infoWindow) entry.infoWindow.close();
    }
    this.markers.clear();
    if (this.activeInfoWindow) {
      this.activeInfoWindow.close();
      this.activeInfoWindow = null;
    }
  };

  /**
   * Toggle visibility of GPS Accuracy Rings
   */
  MarkerManager.prototype.setAccuracyRingsVisible = function (visible) {
    this.accuracyRingsVisible = !!visible;
    for (const entry of this.markers.values()) {
      if (entry.circle) {
        entry.circle.setVisible(this.accuracyRingsVisible);
      }
    }
  };

  /**
   * Fit all active markers in the current viewport
   */
  MarkerManager.prototype.fitAll = function (options = {}) {
    if (!this.map || this.markers.size === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let count = 0;
    for (const entry of this.markers.values()) {
      if (entry.googleLatLng) {
        bounds.extend(entry.googleLatLng);
        count++;
      }
    }

    if (count > 0) {
      this.map.fitBounds(bounds, options.padding || 60);
    }
  };

  MarkerManager.prototype.getMarker = function (id) {
    return this.markers.get(id) || null;
  };

  MarkerManager.prototype.getAllMarkers = function () {
    return Array.from(this.markers.values());
  };

  MarkerManager.prototype.destroy = function () {
    this.clearMarkers();
  };

  global.MarkerManager = MarkerManager;
})(window);
