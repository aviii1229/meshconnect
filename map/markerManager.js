/**
 * Reusable Marker Manager Module for Leaflet
 * Handles dynamic emergency beacons using L.divIcon, accuracy circles (L.circle),
 * popups with direct Google Maps external links, and modular emergency marker types.
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

  function MarkerManager(mapView) {
    this.mapView = mapView;
    this.map = null;
    this.markers = new Map(); // id -> { marker, circle, data, latLng, popup }
    this.showAccuracyRings = true;
    this.activePopupMarker = null;
  }

  MarkerManager.prototype.init = function (mapInstance) {
    this.map = mapInstance;
  };

  /**
   * Determine marker category key
   */
  MarkerManager.prototype.resolveMarkerType = function (explicitType, status) {
    if (explicitType && MARKER_TYPES[explicitType]) {
      return explicitType;
    }
    if (status === 'RESOLVED') return 'safe_zone';
    if (status === 'ACKNOWLEDGED') return 'victim';
    return 'sos';
  };

  /**
   * Generate HTML for animated pulsing cyber-beacon
   */
  MarkerManager.prototype.createMarkerHtml = function (status, hops, typeKey, data = {}) {
    const typeDef = MARKER_TYPES[typeKey] || MARKER_TYPES.sos;
    const isPulse = typeDef.pulse && status !== 'RESOLVED';
    const statusClass = (status || 'NEW').toLowerCase();
    const hopBadge = hops !== undefined ? `<span class="beacon-hops" title="${hops} mesh hops traversed">${hops}h</span>` : '';

    return `
      <div class="beacon-wrapper ${statusClass} type-${typeKey}" style="--beacon-gradient:${typeDef.bgGradient};--beacon-glow:${typeDef.glowColor};--ripple-color:${typeDef.rippleColor};">
        ${isPulse ? '<div class="beacon-radar-ring"></div><div class="beacon-radar-ring-2"></div>' : ''}
        <div class="beacon-core">
          <span class="beacon-icon">${typeDef.icon}</span>
          ${hopBadge}
        </div>
      </div>
    `;
  };

  /**
   * Add or update an emergency marker on Leaflet map
   */
  MarkerManager.prototype.addMarker = function (config) {
    if (!this.map || !global.L) return null;

    const id = config.id || `marker-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const latLng = global.MapUtils.toLatLngArray(config.latLng || [config.latitude, config.longitude]);

    if (!latLng) {
      console.warn('MarkerManager: Invalid coordinates for marker:', config);
      return null;
    }

    const status = config.status || 'NEW';
    const hops = config.hops !== undefined ? config.hops : 0;
    const typeKey = this.resolveMarkerType(config.type, status);
    const typeDef = MARKER_TYPES[typeKey] || MARKER_TYPES.sos;

    // Remove existing marker with same ID if present
    if (this.markers.has(id)) {
      this.removeMarker(id);
    }

    // 1. Create Leaflet DivIcon
    const html = this.createMarkerHtml(status, hops, typeKey, config);
    const divIcon = global.L.divIcon({
      className: 'mesh-leaflet-marker-icon',
      html: html,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22]
    });

    const marker = global.L.marker(latLng, {
      icon: divIcon,
      zIndexOffset: status === 'NEW' ? 1000 : 500,
      title: config.title || typeDef.label
    });

    // 2. Create Accuracy Radius Circle
    const accuracy = config.accuracy || 15;
    const circleColor = status === 'RESOLVED' ? '#10b981' : (status === 'ACKNOWLEDGED' ? '#f59e0b' : (typeDef.circleColor || '#ef4444'));
    const circle = global.L.circle(latLng, {
      radius: accuracy,
      color: circleColor,
      fillColor: circleColor,
      fillOpacity: 0.12,
      weight: 1.5,
      dashArray: '3, 6'
    });

    // 3. Popup Content (Includes Direct Google Maps Link!)
    const popupHtml = config.popupHtml || this.buildDefaultPopup(config, typeDef, latLng);
    marker.bindPopup(popupHtml, {
      maxWidth: 360,
      className: 'mesh-leaflet-popup',
      autoPanPadding: [30, 30]
    });

    // Marker click handling
    marker.on('click', () => {
      this.activePopupMarker = marker;
      if (typeof config.onClick === 'function') {
        config.onClick(id, config);
      }
    });

    // Add layers to map
    marker.addTo(this.map);
    if (this.showAccuracyRings) {
      circle.addTo(this.map);
    }

    const entry = {
      id: id,
      marker: marker,
      circle: circle,
      latLng: latLng,
      accuracy: accuracy,
      status: status,
      typeKey: typeKey,
      data: config
    };

    this.markers.set(id, entry);
    return entry;
  };

  /**
   * Default InfoWindow / Popup builder with Google Maps link
   */
  MarkerManager.prototype.buildDefaultPopup = function (config, typeDef, latLng) {
    const title = config.title || typeDef.label;
    const desc = config.description || 'Emergency Network Node';
    const lat = latLng[0];
    const lng = latLng[1];
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    return `
      <div class="popup-card">
        <div class="popup-header">
          <span class="popup-badge status-new">${typeDef.icon} ${global.MapUtils.escapeHtml(title)}</span>
          <span class="popup-time">${new Date().toLocaleTimeString()}</span>
        </div>
        <div class="popup-msg-box">
          <p>${global.MapUtils.escapeHtml(desc)}</p>
        </div>
        <div class="popup-details">
          <div class="popup-detail-item">
            <span class="popup-detail-label">GPS Coordinates</span>
            <span class="popup-detail-val">${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
          </div>
          <div class="popup-detail-item">
            <span class="popup-detail-label">Accuracy</span>
            <span class="popup-detail-val">±${config.accuracy || 10}m</span>
          </div>
        </div>

        <!-- Open in Google Maps Link -->
        <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-popup-google-maps" title="Open these exact coordinates in Google Maps">
          📍 Open in Google Maps ↗
        </a>
      </div>
    `;
  };

  MarkerManager.prototype.getMarker = function (id) {
    return this.markers.get(id) || null;
  };

  /**
   * Open popup for marker
   */
  MarkerManager.prototype.openPopup = function (id) {
    const entry = this.markers.get(id);
    if (entry && entry.marker) {
      entry.marker.openPopup();
      this.activePopupMarker = entry.marker;
    }
  };

  /**
   * Remove a single marker
   */
  MarkerManager.prototype.removeMarker = function (id) {
    const entry = this.markers.get(id);
    if (!entry) return false;

    if (this.map) {
      this.map.removeLayer(entry.marker);
      if (entry.circle) {
        this.map.removeLayer(entry.circle);
      }
    }
    this.markers.delete(id);
    return true;
  };

  /**
   * Clear all markers
   */
  MarkerManager.prototype.clearMarkers = function () {
    if (!this.map) return;
    for (const [id, entry] of this.markers.entries()) {
      this.map.removeLayer(entry.marker);
      if (entry.circle) {
        this.map.removeLayer(entry.circle);
      }
    }
    this.markers.clear();
    this.activePopupMarker = null;
  };

  /**
   * Toggle accuracy circles
   */
  MarkerManager.prototype.setAccuracyRingsVisible = function (visible) {
    this.showAccuracyRings = !!visible;
    if (!this.map) return;

    for (const entry of this.markers.values()) {
      if (entry.circle) {
        if (this.showAccuracyRings) {
          if (!this.map.hasLayer(entry.circle)) {
            entry.circle.addTo(this.map);
          }
        } else {
          if (this.map.hasLayer(entry.circle)) {
            this.map.removeLayer(entry.circle);
          }
        }
      }
    }
  };

  /**
   * Fit map viewport to include all active markers
   */
  MarkerManager.prototype.fitAll = function (options = {}) {
    if (!this.map || this.markers.size === 0) return;

    const points = [];
    for (const entry of this.markers.values()) {
      if (entry.latLng) points.push(entry.latLng);
    }

    if (points.length === 0) return;

    if (points.length === 1) {
      this.map.flyTo(points[0], 14, {
        animate: true,
        duration: 0.8,
        easeLinearity: 0.2
      });
      return;
    }

    const padding = options.padding || 60;
    const bounds = global.L.latLngBounds(points);
    this.map.fitBounds(bounds, {
      padding: [padding, padding],
      maxZoom: 16,
      animate: true,
      duration: 0.8
    });
  };

  global.MarkerManager = MarkerManager;
  global.MARKER_TYPES = MARKER_TYPES;
})(window);
