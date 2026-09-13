/**
 * Custom Map Navigation Controls for Leaflet
 * Provides polished cyber-glassmorphic controls matching the existing MeshRoute theme:
 * - Zoom In (+)
 * - Zoom Out (-)
 * - My Location (🎯)
 * - Reset North / View (🧭)
 * - Fullscreen toggle (⛶)
 * Uses L.DomEvent.disableClickPropagation to guarantee clicks never get swallowed by Leaflet.
 */
(function (global) {
  'use strict';

  function MapControls(mapView) {
    this.mapView = mapView;
    this.map = null;
    this.container = null;
  }

  MapControls.prototype.init = function (mapInstance, targetContainer) {
    this.map = mapInstance;
    this.render(targetContainer || (this.mapView && this.mapView.container));
  };

  MapControls.prototype.render = function (parent) {
    if (this.container) {
      this.container.remove();
    }

    if (!parent) return;

    const container = document.createElement('div');
    container.className = 'map-custom-control-group maplibre-custom-control-group';
    container.setAttribute('role', 'toolbar');
    container.setAttribute('aria-label', 'Map navigation controls');

    // Prevent Leaflet from intercepting clicks/drags on custom controls
    if (global.L && global.L.DomEvent) {
      global.L.DomEvent.disableClickPropagation(container);
      global.L.DomEvent.disableScrollPropagation(container);
    }

    // 1. Zoom In (Smooth 0.5 step)
    const btnZoomIn = this.createButton('＋', 'Zoom in', () => {
      if (this.map) {
        this.map.zoomIn(0.5);
      }
    });

    // 2. Zoom Out (Smooth 0.5 step)
    const btnZoomOut = this.createButton('－', 'Zoom out', () => {
      if (this.map) {
        this.map.zoomOut(0.5);
      }
    });

    // 3. Locate Me
    const btnLocate = this.createButton('🎯', 'Find my location', () => {
      if (this.mapView && this.mapView.locationManager) {
        btnLocate.classList.add('loading');
        this.mapView.locationManager.locate({
          follow: true,
          onLocation: () => {
            btnLocate.classList.remove('loading');
            btnLocate.classList.add('active');
            setTimeout(() => btnLocate.classList.remove('active'), 3000);
          },
          onError: (err) => {
            btnLocate.classList.remove('loading');
            if (global.showToast) {
              global.showToast(err.message, 'danger');
            } else {
              alert(err.message);
            }
          }
        });
      }
    });

    // 4. Reset View / Fit Pins
    const btnCompass = this.createButton('🧭', 'Reset view to emergency pins', () => {
      if (this.mapView && this.mapView.markerManager && this.mapView.markerManager.markers.size > 0) {
        this.mapView.markerManager.fitAll();
      } else if (this.mapView) {
        this.mapView.flyTo([36.1069, -112.1129], 12);
      }
    });

    // 5. Fullscreen Toggle
    const btnFullscreen = this.createButton('⛶', 'Toggle fullscreen', () => {
      const mapWrapper = parent.closest('.map-container') || parent;
      if (!document.fullscreenElement) {
        if (mapWrapper.requestFullscreen) {
          mapWrapper.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });

    document.addEventListener('fullscreenchange', () => {
      const isFull = !!document.fullscreenElement;
      btnFullscreen.innerHTML = isFull ? '✕' : '⛶';
      btnFullscreen.title = isFull ? 'Exit fullscreen' : 'Toggle fullscreen';
      if (this.map) {
        setTimeout(() => this.map.invalidateSize(), 150);
      }
    });

    container.appendChild(btnZoomIn);
    container.appendChild(btnZoomOut);
    container.appendChild(btnLocate);
    container.appendChild(btnCompass);
    container.appendChild(btnFullscreen);

    parent.appendChild(container);
    this.container = container;
  };

  MapControls.prototype.createButton = function (html, title, onClick) {
    const btn = document.createElement('button');
    btn.className = 'btn-custom-map-control';
    btn.type = 'button';
    btn.innerHTML = html;
    btn.title = title;
    btn.setAttribute('aria-label', title);

    if (global.L && global.L.DomEvent) {
      global.L.DomEvent.disableClickPropagation(btn);
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onClick();
    });
    return btn;
  };

  global.MapControls = MapControls;
})(window);
