/**
 * Custom Map Controls for Google Maps
 * Provides polished cyber-glassmorphic controls matching the existing MeshRoute theme:
 * - Zoom In (+)
 * - Zoom Out (-)
 * - My Location (🎯)
 * - Reset North / Bearing (🧭)
 * - Fullscreen toggle (⛶)
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

    // 1. Zoom In
    const btnZoomIn = this.createButton('＋', 'Zoom in', () => {
      if (this.map) {
        this.map.setZoom(this.map.getZoom() + 1);
      }
    });

    // 2. Zoom Out
    const btnZoomOut = this.createButton('－', 'Zoom out', () => {
      if (this.map) {
        this.map.setZoom(this.map.getZoom() - 1);
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

    // 4. Reset Bearing / North Compass
    const btnCompass = this.createButton('🧭', 'Reset heading to North', () => {
      if (this.map) {
        if (typeof this.map.setHeading === 'function') {
          this.map.setHeading(0);
        }
        if (typeof this.map.setTilt === 'function') {
          this.map.setTilt(0);
        }
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
      btnFullscreen.innerHTML = isFull ? '<span>🗗</span>' : '<span>⛶</span>';
      btnFullscreen.setAttribute('title', isFull ? 'Exit fullscreen' : 'Toggle fullscreen');
      setTimeout(() => {
        if (this.map && global.google?.maps?.event) {
          google.maps.event.trigger(this.map, 'resize');
        }
      }, 100);
    });

    container.appendChild(btnZoomIn);
    container.appendChild(btnZoomOut);
    container.appendChild(btnLocate);
    container.appendChild(btnCompass);
    container.appendChild(btnFullscreen);

    parent.appendChild(container);
    this.container = container;
  };

  MapControls.prototype.createButton = function (icon, title, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'map-ctrl-btn';
    btn.innerHTML = `<span>${icon}</span>`;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  };

  MapControls.prototype.destroy = function () {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  };

  global.MapControls = MapControls;
})(window);
