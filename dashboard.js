/**
 * MeshRoute Emergency Operations Dashboard
 * Powered by MapLibre GL JS & OpenStreetMap Vector Tiles
 * Zero Google APIs, Zero Mapbox tokens, Zero external account dependencies.
 */

(function () {
  'use strict';

  // State
  const state = {
    incidents: new Map(),
    activeFilter: 'ACTIVE', // 'ACTIVE' (default: New + Acknowledged), 'ALL', 'RESOLVED'
    searchQuery: '',
    audioEnabled: true,
    showRings: true,
    selectedIncidentId: null,
    audioCtx: null
  };

  // Modular MapView reference
  let mapView = null;

  // DOM Elements
  const el = {
    map: document.getElementById('map'),
    liveStatus: document.getElementById('live-status'),
    liveStatusText: document.getElementById('live-status-text'),
    audioToggle: document.getElementById('btn-audio-toggle'),
    btnSimulate: document.getElementById('btn-simulate-sos'),
    btnClearAll: document.getElementById('btn-clear-all'),
    btnFitPins: document.getElementById('btn-fit-pins'),
    btnToggleRings: document.getElementById('btn-toggle-rings'),
    pinCount: document.getElementById('map-pin-count'),
    kpiActive: document.getElementById('kpi-active-count'),
    kpiAvgHops: document.getElementById('kpi-avg-hops'),
    kpiActiveNodes: document.getElementById('kpi-active-nodes'),
    kpiResolved: document.getElementById('kpi-resolved-count'),
    sidebarBadge: document.getElementById('sidebar-count-badge'),
    searchInput: document.getElementById('incident-search'),
    filterTabs: document.querySelectorAll('.filter-tab'),
    incidentList: document.getElementById('incident-list'),
    inspectorModal: document.getElementById('inspector-modal'),
    modalBody: document.getElementById('modal-body-content'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnModalResolve: document.getElementById('btn-modal-resolve'),
    btnModalDelete: document.getElementById('btn-modal-delete'),
    toastContainer: document.getElementById('toast-container'),
    mapLayerBadge: document.getElementById('map-layer-badge')
  };

  /**
   * Initialize Web Audio API Synthesizer for Emergency Chime
   */
  function initAudio() {
    if (!state.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        state.audioCtx = new AudioContext();
      }
    }
  }

  function playAlertChime() {
    if (!state.audioEnabled) return;
    try {
      initAudio();
      if (state.audioCtx && state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
      }
      if (!state.audioCtx) return;

      const now = state.audioCtx.currentTime;
      const osc1 = state.audioCtx.createOscillator();
      const osc2 = state.audioCtx.createOscillator();
      const gain = state.audioCtx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);

      osc2.frequency.setValueAtTime(1320, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.35);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(state.audioCtx.destination);

      osc1.start(now);
      osc1.stop(now + 0.2);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn('Audio playback not supported or blocked:', e);
    }
  }

  /**
   * Toast notification display
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'danger' ? 'danger' : ''}`;
    const icon = type === 'danger' ? '🚨' : (type === 'success' ? '✅' : 'ℹ️');
    toast.innerHTML = `<span class="toast-icon">${icon}</span> <span>${message}</span>`;
    el.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Initialize Google Maps JavaScript API engine
   */
  async function initMap() {
    mapView = new MapView('map', {
      center: { lat: 36.1069, lng: -112.1129 },
      zoom: 12
    });
    await mapView.init();
  }
  const initMapLibre = initMap;

  /**
   * Helper to normalize incident status (NEW, ACKNOWLEDGED, RESOLVED)
   */
  function getNormalizedStatus(incident) {
    const raw = (incident.status || '').toUpperCase();
    if (raw === 'RESOLVED') return 'RESOLVED';
    if (raw === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
    return 'NEW';
  }

  /**
   * Generate Popup HTML content for Incident
   * Shows: Sender ID, Timestamp, Status (New/Acknowledged/Resolved), Link to open Detail view
   */
  function buildPopupContent(incident) {
    const status = getNormalizedStatus(incident);
    const msg = incident.decrypted_payload ? incident.decrypted_payload.message : 'Encrypted emergency payload';
    const senderId = incident.originator_id || incident.sender_id || 'Unknown';
    const senderName = incident.decrypted_payload?.sender_name;
    const medical = incident.decrypted_payload?.medical_info || 'None specified';
    const battery = incident.decrypted_payload?.battery_percent !== undefined ? incident.decrypted_payload.battery_percent + '%' : 'Unknown';
    const hopChain = (incident.hop_path || [senderId, incident.gateway_node]).join(' ➔ ');
    const receivedTime = incident.received_at || Date.now();
    const formattedDate = new Date(receivedTime).toLocaleString();

    let statusBadgeClass = 'status-new';
    let statusLabel = '🚨 NEW SOS';
    if (status === 'ACKNOWLEDGED') {
      statusBadgeClass = 'status-acknowledged';
      statusLabel = '⚡ ACKNOWLEDGED';
    } else if (status === 'RESOLVED') {
      statusBadgeClass = 'status-resolved';
      statusLabel = '✓ RESOLVED';
    }

    return `
      <div class="popup-card">
        <div class="popup-header">
          <span class="popup-badge ${statusBadgeClass}">
            ${statusLabel}
          </span>
          <span class="popup-time">${formattedDate}</span>
        </div>

        <div class="popup-msg-box">
          <p>"${escapeHtml(msg)}"</p>
        </div>

        <div class="popup-details">
          <div class="popup-detail-item">
            <span class="popup-detail-label">Sender ID</span>
            <span class="popup-detail-val">${escapeHtml(senderId)}</span>
          </div>
          <div class="popup-detail-item">
            <span class="popup-detail-label">Sender Name</span>
            <span class="popup-detail-val">${escapeHtml(senderName || 'N/A')}</span>
          </div>
          <div class="popup-detail-item">
            <span class="popup-detail-label">Gateway Phone</span>
            <span class="popup-detail-val">${escapeHtml(incident.gateway_node || 'Direct')}</span>
          </div>
          <div class="popup-detail-item">
            <span class="popup-detail-label">Hops Traversed</span>
            <span class="popup-detail-val">${incident.hops} hops (TTL: ${incident.ttl})</span>
          </div>
          <div class="popup-detail-item">
            <span class="popup-detail-label">Battery Level</span>
            <span class="popup-detail-val">${battery}</span>
          </div>
          <div class="popup-detail-item" style="grid-column: span 2;">
            <span class="popup-detail-label">Medical Condition</span>
            <span class="popup-detail-val">${escapeHtml(medical)}</span>
          </div>
          <div class="popup-detail-item" style="grid-column: span 2;">
            <span class="popup-detail-label">Mesh Hop Route</span>
            <span class="popup-detail-val" style="font-size: 0.7rem; word-break: break-all;">${escapeHtml(hopChain)}</span>
          </div>
        </div>

        <div style="margin-bottom: 10px;">
          <button class="btn btn-secondary" style="width: 100%; font-size: 0.75rem; justify-content: center;" onclick="window.meshDispatch.openInspectorModal('${incident.incident_id}')">
            🔍 Open Full Incident Details
          </button>
        </div>

        <div class="popup-actions">
          ${status === 'NEW' ? `<button class="btn-popup-resolve" style="background: #f59e0b; color: #000;" onclick="window.meshDispatch.acknowledgeIncident('${incident.incident_id}')">Acknowledge</button>` : ''}
          ${status !== 'RESOLVED' ? `<button class="btn-popup-resolve" onclick="window.meshDispatch.resolveIncident('${incident.incident_id}')">Resolve</button>` : ''}
          <button class="btn-popup-delete" onclick="window.meshDispatch.deleteIncident('${incident.incident_id}')">Delete</button>
        </div>
      </div>
    `;
  }

  /**
   * Returns true if incident should be visible under active filter
   */
  function shouldDisplayIncident(incident) {
    const status = getNormalizedStatus(incident);
    if (state.activeFilter === 'ACTIVE') {
      return status !== 'RESOLVED';
    }
    if (state.activeFilter === 'RESOLVED') {
      return status === 'RESOLVED';
    }
    return true; // 'ALL'
  }

  /**
   * Sync single incident marker to MapLibre GL map
   */
  function syncIncidentMapMarker(incident) {
    if (!mapView || !mapView.markerManager || !incident.location || !incident.location.latitude || !incident.location.longitude) {
      return;
    }

    const id = incident.incident_id;
    if (!shouldDisplayIncident(incident)) {
      removeIncidentMapMarker(id);
      return;
    }

    mapView.markerManager.addMarker({
      id: id,
      latitude: incident.location.latitude,
      longitude: incident.location.longitude,
      status: incident.status,
      hops: incident.hops,
      accuracy: incident.location.accuracy || 15,
      popupHtml: buildPopupContent(incident),
      onClick: () => {
        selectIncident(id, false);
      }
    });

    updatePinCount();
  }

  /**
   * Remove marker from MapLibre
   */
  function removeIncidentMapMarker(incidentId) {
    if (mapView && mapView.markerManager) {
      mapView.markerManager.removeMarker(incidentId);
      updatePinCount();
    }
  }

  function updatePinCount() {
    if (el.pinCount) {
      el.pinCount.textContent = mapView && mapView.markerManager ? mapView.markerManager.markers.size : 0;
    }
  }

  /**
   * Re-renders all markers according to the current filter
   */
  function refreshAllMarkers() {
    if (!mapView || !mapView.markerManager) return;
    mapView.markerManager.clearMarkers();

    for (const inc of state.incidents.values()) {
      if (shouldDisplayIncident(inc)) {
        syncIncidentMapMarker(inc);
      }
    }

    updatePinCount();
  }

  /**
   * Fit map view to all active emergency markers
   */
  function fitAllPins() {
    if (!mapView || !mapView.markerManager) return;
    mapView.markerManager.fitAll({ padding: 70 });
  }

  /**
   * Toggle GPS Accuracy circles
   */
  function toggleAccuracyRings() {
    state.showRings = !state.showRings;
    if (mapView && mapView.markerManager) {
      mapView.markerManager.setAccuracyRingsVisible(state.showRings);
    }
    el.btnToggleRings.style.opacity = state.showRings ? '1' : '0.5';
    showToast(state.showRings ? 'GPS Accuracy Rings: Shown' : 'GPS Accuracy Rings: Hidden');
  }

  /**
   * Update KPI Cards & Counts
   */
  function updateKPIs() {
    let active = 0;
    let resolved = 0;
    let totalHops = 0;
    const nodes = new Set();

    for (const inc of state.incidents.values()) {
      const status = getNormalizedStatus(inc);
      if (status === 'RESOLVED') {
        resolved++;
      } else {
        active++;
      }
      totalHops += (inc.hops || 0);
      if (inc.originator_id) nodes.add(inc.originator_id);
      if (inc.gateway_node) nodes.add(inc.gateway_node);
      if (Array.isArray(inc.hop_path)) {
        inc.hop_path.forEach(n => nodes.add(n));
      }
    }

    el.kpiActive.textContent = active;
    el.sidebarBadge.textContent = active;
    el.kpiResolved.textContent = resolved;
    el.kpiActiveNodes.textContent = nodes.size;

    const total = active + resolved;
    el.kpiAvgHops.textContent = total > 0 ? (totalHops / total).toFixed(1) : '0.0';
  }

  /**
   * Render Incident Queue Cards in Sidebar
   */
  function renderIncidentList() {
    const list = Array.from(state.incidents.values());
    const query = state.searchQuery.toLowerCase().trim();

    const filtered = list.filter(inc => {
      const status = getNormalizedStatus(inc);
      if (state.activeFilter === 'ACTIVE' && status === 'RESOLVED') return false;
      if (state.activeFilter === 'RESOLVED' && status !== 'RESOLVED') return false;

      if (query) {
        const text = [
          inc.message_id,
          inc.incident_id,
          inc.originator_id,
          inc.gateway_node,
          inc.decrypted_payload?.message,
          inc.decrypted_payload?.sender_name,
          inc.decrypted_payload?.medical_info
        ].filter(Boolean).join(' ').toLowerCase();

        if (!text.includes(query)) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      el.incidentList.innerHTML = `
        <div class="empty-feed">
          <div class="icon">🔍</div>
          <p><strong>No matching incidents</strong></p>
          <p style="font-size: 0.75rem;">${query ? 'Try a different search keyword' : 'No emergency packets in this view'}</p>
        </div>
      `;
      return;
    }

    // Sort by received_at descending (newest first)
    filtered.sort((a, b) => (b.received_at || 0) - (a.received_at || 0));

    el.incidentList.innerHTML = filtered.map(inc => {
      const status = getNormalizedStatus(inc);
      const isResolved = status === 'RESOLVED';
      const isAck = status === 'ACKNOWLEDGED';
      const isSelected = inc.incident_id === state.selectedIncidentId;
      const msg = inc.decrypted_payload?.message || '[Encrypted Emergency Data]';
      const senderName = inc.decrypted_payload?.sender_name || inc.originator_id;
      const timeAgo = formatTimeAgo(inc.received_at || Date.now());
      const battery = inc.decrypted_payload?.battery_percent;
      const isLowBattery = battery !== undefined && battery < 25;

      let cardStatusClass = 'status-new';
      if (isAck) cardStatusClass = 'status-acknowledged';
      else if (isResolved) cardStatusClass = 'resolved';

      return `
        <div class="incident-card ${cardStatusClass} ${isSelected ? 'active-selected' : ''}" data-id="${inc.incident_id}">
          <div class="card-top">
            <div class="card-node-id">
              <span>${isResolved ? '✅' : (isAck ? '⚡' : '🚨')}</span> ${escapeHtml(senderName)}
            </div>
            <span class="card-time">${timeAgo}</span>
          </div>

          <div class="card-message">
            "${escapeHtml(msg)}"
          </div>

          <div class="card-tags">
            <span class="card-tag hops">⚡ ${inc.hops} hops</span>
            <span class="card-tag">📡 ${escapeHtml(inc.gateway_node || 'Direct')}</span>
            <span class="card-tag" style="color: ${isResolved ? '#10b981' : (isAck ? '#f59e0b' : '#f43f5e')}">${status}</span>
            ${battery !== undefined ? `<span class="card-tag ${isLowBattery ? 'battery-low' : ''}">🔋 ${battery}%</span>` : ''}
            ${inc.location ? `<span class="card-tag">📍 GPS (±${inc.location.accuracy || 0}m)</span>` : ''}
          </div>

          <div class="card-actions">
            <button class="btn-card-action btn-card-inspect" data-action="inspect" data-id="${inc.incident_id}">🔍 Details</button>
            <div style="display: flex; gap: 4px;">
              ${status === 'NEW' ? `<button class="btn-card-action" style="color: #f59e0b;" data-action="ack" data-id="${inc.incident_id}">⚡ Ack</button>` : ''}
              ${!isResolved ? `<button class="btn-card-action btn-card-resolve" data-action="resolve" data-id="${inc.incident_id}">✓ Resolve</button>` : ''}
              <button class="btn-card-action btn-card-delete" data-action="delete" data-id="${inc.incident_id}">🗑️ Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Pan map and select incident
   */
  function selectIncident(incidentId, panMap = true) {
    state.selectedIncidentId = incidentId;
    const incident = state.incidents.get(incidentId);

    document.querySelectorAll('.incident-card').forEach(card => {
      card.classList.toggle('active-selected', card.dataset.id === incidentId);
    });

    if (panMap && incident && incident.location && mapView) {
      const lat = incident.location.latitude;
      const lng = incident.location.longitude;

      mapView.flyTo({ lat, lng }, 14);

      if (mapView.markerManager) {
        const entry = mapView.markerManager.getMarker(incidentId);
        if (entry && mapView.map) {
          if (entry.infoWindow) {
            if (mapView.markerManager.activeInfoWindow) {
              mapView.markerManager.activeInfoWindow.close();
            }
            entry.infoWindow.setPosition(entry.googleLatLng || new google.maps.LatLng(lat, lng));
            entry.infoWindow.open({ map: mapView.map });
            mapView.markerManager.activeInfoWindow = entry.infoWindow;
          } else if (entry.popup) {
            entry.popup.addTo(mapView.map);
          }
        }
      }
    }
  }

  /**
   * Open Deep Inspector Modal
   */
  function openInspectorModal(incidentId) {
    const incident = state.incidents.get(incidentId);
    if (!incident) return;

    state.selectedIncidentId = incidentId;
    const status = getNormalizedStatus(incident);
    const isResolved = status === 'RESOLVED';
    const hopNodes = incident.hop_path || [incident.originator_id, incident.gateway_node];

    const hopChainHtml = hopNodes.map((node, idx) => `
      <span class="hop-node-pill">${escapeHtml(node)}</span>
      ${idx < hopNodes.length - 1 ? '<span class="hop-arrow">➔</span>' : ''}
    `).join('');

    el.modalBody.innerHTML = `
      <div class="inspector-section">
        <span class="inspector-section-label">Incident Identifiers</span>
        <div style="font-family: var(--font-mono); font-size: 0.82rem; background: var(--bg-tertiary); padding: 10px; border-radius: 6px;">
          <div><strong>Incident ID :</strong> ${incident.incident_id}</div>
          <div><strong>Message ID  :</strong> ${incident.message_id}</div>
          <div><strong>Status      :</strong> <span style="color: ${isResolved ? '#10b981' : (status === 'ACKNOWLEDGED' ? '#f59e0b' : '#f43f5e')}; font-weight: 700;">${status}</span></div>
          <div><strong>Priority    :</strong> ${incident.priority}</div>
          <div><strong>Received At :</strong> ${new Date(incident.received_at || Date.now()).toLocaleString()}</div>
        </div>
      </div>

      <div class="inspector-section">
        <span class="inspector-section-label">Mesh Route Hop Traversal</span>
        <div class="hop-chain-container">
          ${hopChainHtml}
        </div>
      </div>

      <div class="inspector-section">
        <span class="inspector-section-label">Payload Cryptography</span>
        <div class="crypto-badge">
          <span>🔒</span> AES-256-GCM Validated & Decrypted (12-byte IV + 16-byte Tag Authentic)
        </div>
      </div>

      <div class="inspector-section">
        <span class="inspector-section-label">Emergency Data</span>
        <div style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 6px; border-left: 3px solid var(--accent-cyan);">
          <div><strong>Message:</strong> "${escapeHtml(incident.decrypted_payload?.message || 'N/A')}"</div>
          <div><strong>Sender:</strong> ${escapeHtml(incident.decrypted_payload?.sender_name || 'N/A')}</div>
          <div><strong>Medical:</strong> ${escapeHtml(incident.decrypted_payload?.medical_info || 'None')}</div>
          <div><strong>Battery:</strong> ${incident.decrypted_payload?.battery_percent !== undefined ? incident.decrypted_payload.battery_percent + '%' : 'N/A'}</div>
          ${incident.location ? `<div><strong>GPS:</strong> ${incident.location.latitude}, ${incident.location.longitude} (±${incident.location.accuracy || 0}m)</div>` : ''}
        </div>
      </div>

      <div class="inspector-section">
        <span class="inspector-section-label">Raw Wire Packet JSON</span>
        <pre class="raw-json-block">${escapeHtml(JSON.stringify(incident, null, 2))}</pre>
      </div>
    `;

    el.btnModalResolve.style.display = isResolved ? 'none' : 'inline-flex';
    el.btnModalResolve.onclick = () => {
      resolveIncident(incidentId);
      closeInspectorModal();
    };

    el.btnModalDelete.onclick = () => {
      deleteIncident(incidentId);
      closeInspectorModal();
    };

    el.inspectorModal.classList.add('open');
  }

  function closeInspectorModal() {
    el.inspectorModal.classList.remove('open');
  }

  /**
   * API Actions
   */
  async function acknowledgeIncident(id) {
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(id)}/acknowledge`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast(`Incident acknowledged: ${id}`, 'info');
        const inc = state.incidents.get(id);
        if (inc) {
          inc.status = 'ACKNOWLEDGED';
          syncIncidentMapMarker(inc);
          renderIncidentList();
          updateKPIs();
        }
      }
    } catch (err) {
      showToast(`Error acknowledging incident: ${err.message}`, 'danger');
    }
  }

  async function resolveIncident(id) {
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(id)}/resolve`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast(`Incident resolved: ${id}`, 'success');
        const inc = state.incidents.get(id);
        if (inc) {
          inc.status = 'RESOLVED';
          syncIncidentMapMarker(inc);
          renderIncidentList();
          updateKPIs();
        }
      } else {
        showToast(`Failed to resolve incident (${res.status})`, 'danger');
      }
    } catch (err) {
      showToast(`Network error resolving incident: ${err.message}`, 'danger');
    }
  }

  async function deleteIncident(id) {
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast(`Incident deleted from dispatch: ${id}`, 'info');
        state.incidents.delete(id);
        removeIncidentMapMarker(id);
        renderIncidentList();
        updateKPIs();
      } else {
        showToast(`Failed to delete incident (${res.status})`, 'danger');
      }
    } catch (err) {
      showToast(`Network error deleting incident: ${err.message}`, 'danger');
    }
  }

  async function simulateSos() {
    el.btnSimulate.disabled = true;
    el.btnSimulate.innerHTML = '<span>⏳</span> Relaying...';
    try {
      // Simulate nearby clusters or distinct mountain points
      const res = await fetch('/api/sos/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        showToast('Simulated multi-hop SOS packet injected!', 'danger');
      } else {
        showToast(`Simulation failed (${res.status})`, 'danger');
      }
    } catch (err) {
      showToast(`Simulation request error: ${err.message}`, 'danger');
    } finally {
      el.btnSimulate.disabled = false;
      el.btnSimulate.innerHTML = '<span>🚨</span> Simulate Mesh SOS';
    }
  }

  async function clearAllIncidents() {
    if (!confirm('Are you sure you want to clear all incidents from the backend and map?')) {
      return;
    }
    try {
      const res = await fetch('/api/sos', { method: 'DELETE' });
      if (res.ok) {
        state.incidents.clear();
        if (mapView && mapView.markerManager) {
          mapView.markerManager.clearMarkers();
        }
        updatePinCount();
        renderIncidentList();
        updateKPIs();
        showToast('All incidents cleared from backend store', 'info');
      }
    } catch (err) {
      showToast('Error clearing incidents: ' + err.message, 'danger');
    }
  }

  /**
   * Functional Requirement 1:
   * Fetch incidents from GET /api/incidents (filtered to active/unresolved by default)
   */
  async function loadInitialIncidents() {
    try {
      // Fetch active/unresolved incidents by default per requirement
      const res = await fetch('/api/incidents?status=active');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.incidents)) {
          data.incidents.forEach(inc => {
            state.incidents.set(inc.incident_id, inc);
            syncIncidentMapMarker(inc);
          });
          renderIncidentList();
          updateKPIs();
          fitAllPins();
        }
      }
    } catch (err) {
      console.error('Failed to load initial incidents:', err);
    }
  }

  /**
   * Setup Real-Time Server-Sent Events (SSE) Stream
   * New incidents arriving via SSE appear on the map immediately, without a page reload.
   */
  function setupSSE() {
    let sse = null;

    function connect() {
      if (sse) {
        try { sse.close(); } catch {}
      }

      sse = new EventSource('/api/sos/stream');

      sse.onopen = () => {
        el.liveStatus.classList.remove('disconnected');
        el.liveStatusText.textContent = 'LIVE MESH STREAM';
      };

      sse.addEventListener('ping', () => {
        el.liveStatus.classList.remove('disconnected');
        el.liveStatusText.textContent = 'LIVE MESH STREAM';
      });

      // Functional Requirement 5: Real-time incident arrival on map without reload
      sse.addEventListener('sos:new', (e) => {
        try {
          const incident = JSON.parse(e.data);
          state.incidents.set(incident.incident_id, incident);
          syncIncidentMapMarker(incident);
          renderIncidentList();
          updateKPIs();
          playAlertChime();

          const sender = incident.decrypted_payload?.sender_name || incident.originator_id;
          showToast(`🚨 NEW EMERGENCY: ${sender} (${incident.hops} hops)`, 'danger');

          // Auto center/zoom to new alert if location exists
          if (incident.location && mapView) {
            mapView.flyTo({ lat: incident.location.latitude, lng: incident.location.longitude }, 14);
          }
        } catch (err) {
          console.error('Failed to parse sos:new event:', err);
        }
      });

      sse.addEventListener('sos:acknowledged', (e) => {
        try {
          const data = JSON.parse(e.data);
          const inc = state.incidents.get(data.incident_id);
          if (inc) {
            inc.status = 'ACKNOWLEDGED';
            syncIncidentMapMarker(inc);
            renderIncidentList();
            updateKPIs();
          }
        } catch {}
      });

      sse.addEventListener('sos:duplicate', (e) => {
        try {
          const data = JSON.parse(e.data);
          showToast(`Duplicate SOS relayed via Gateway ${data.gateway_node} (hops: ${data.hops})`, 'info');
        } catch {}
      });

      sse.addEventListener('sos:resolved', (e) => {
        try {
          const data = JSON.parse(e.data);
          const inc = state.incidents.get(data.incident_id);
          if (inc) {
            inc.status = 'RESOLVED';
            syncIncidentMapMarker(inc);
            renderIncidentList();
            updateKPIs();
          }
        } catch {}
      });

      sse.addEventListener('sos:deleted', (e) => {
        try {
          const data = JSON.parse(e.data);
          state.incidents.delete(data.incident_id);
          removeIncidentMapMarker(data.incident_id);
          renderIncidentList();
          updateKPIs();
        } catch {}
      });

      sse.addEventListener('sos:cleared', () => {
        state.incidents.clear();
        if (mapView && mapView.markerManager) {
          mapView.markerManager.clearMarkers();
        }
        updatePinCount();
        renderIncidentList();
        updateKPIs();
      });

      sse.onerror = () => {
        if (sse.readyState === EventSource.OPEN) {
          el.liveStatus.classList.remove('disconnected');
          el.liveStatusText.textContent = 'LIVE MESH STREAM';
        } else {
          el.liveStatus.classList.add('disconnected');
          el.liveStatusText.textContent = 'RECONNECTING...';
        }
      };
    }

    connect();
  }

  /**
   * Utility Helpers
   */
  function formatTimeAgo(timestamp) {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 15) return 'Just now';
    if (elapsed < 60) return `${elapsed}s ago`;
    const mins = Math.floor(elapsed / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Event Listeners Registration
   */
  function setupEventListeners() {
    // Audio alert toggle
    el.audioToggle.addEventListener('click', () => {
      initAudio();
      state.audioEnabled = !state.audioEnabled;
      el.audioToggle.classList.toggle('active', state.audioEnabled);
      el.audioToggle.textContent = state.audioEnabled ? '🔊' : '🔇';
      showToast(state.audioEnabled ? 'Emergency Siren Audio: Enabled' : 'Emergency Siren Audio: Muted');
      if (state.audioEnabled) playAlertChime();
    });

    // Simulate SOS
    el.btnSimulate.addEventListener('click', () => {
      initAudio();
      simulateSos();
    });

    // Clear All
    el.btnClearAll.addEventListener('click', clearAllIncidents);

    // Fit Pins
    el.btnFitPins.addEventListener('click', fitAllPins);

    // Toggle Rings
    el.btnToggleRings.addEventListener('click', toggleAccuracyRings);

    // Map Style Preset Switching (Vivid OSM, Tactical Dark, Bright Day)
    const styleButtons = document.querySelectorAll('.btn-map-style');
    styleButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetId = btn.dataset.style;
        if (!presetId || !state.mapView) return;
        styleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mapView.changePreset(presetId);
        try { localStorage.setItem('mesh_map_style_preset', presetId); } catch (e) {}
      });
    });

    // Restore saved style preset preference if available
    try {
      const savedPreset = localStorage.getItem('mesh_map_style_preset');
      const validPresets = ['topo', 'tactical', 'vivid', 'satellite'];
      if (savedPreset && validPresets.includes(savedPreset)) {
        const targetBtn = document.querySelector(`.btn-map-style[data-style="${savedPreset}"]`);
        if (targetBtn) {
          styleButtons.forEach(b => b.classList.remove('active'));
          targetBtn.classList.add('active');
          state.mapView.onReady(mv => mv.changePreset(savedPreset));
        }
      } else {
        // Set active button to match current preset
        const currentId = (window.MapConfig && window.MapConfig.currentPresetId) || 'topo';
        const activeBtn = document.querySelector(`.btn-map-style[data-style="${currentId}"]`);
        if (activeBtn) {
          styleButtons.forEach(b => b.classList.remove('active'));
          activeBtn.classList.add('active');
        }
      }
    } catch (e) {}

    // Search input
    el.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderIncidentList();
    });

    // Filter tabs
    el.filterTabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        el.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeFilter = tab.dataset.filter;

        // If user explicitly asks for 'ALL' or 'RESOLVED', fetch them from server
        if (state.activeFilter === 'ALL' || state.activeFilter === 'RESOLVED') {
          try {
            const endpoint = state.activeFilter === 'RESOLVED' ? '/api/incidents?status=resolved' : '/api/incidents?status=all';
            const res = await fetch(endpoint);
            if (res.ok) {
              const data = await res.json();
              data.incidents.forEach(inc => state.incidents.set(inc.incident_id, inc));
            }
          } catch {}
        }

        refreshAllMarkers();
        renderIncidentList();
        updateKPIs();
        fitAllPins();
      });
    });

    // Incident List click delegate
    el.incidentList.addEventListener('click', (e) => {
      const card = e.target.closest('.incident-card');
      const actionBtn = e.target.closest('.btn-card-action');

      if (actionBtn) {
        e.stopPropagation();
        const action = actionBtn.dataset.action;
        const id = actionBtn.dataset.id;
        if (action === 'inspect') openInspectorModal(id);
        if (action === 'ack') acknowledgeIncident(id);
        if (action === 'resolve') resolveIncident(id);
        if (action === 'delete') deleteIncident(id);
        return;
      }

      if (card) {
        const id = card.dataset.id;
        selectIncident(id, true);
      }
    });

    // Modal Close
    el.btnCloseModal.addEventListener('click', closeInspectorModal);
    el.inspectorModal.addEventListener('click', (e) => {
      if (e.target === el.inspectorModal) closeInspectorModal();
    });

    // Keyboard escape to close modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeInspectorModal();
    });
  }

  // Expose global methods for inline popup buttons
  window.meshDispatch = {
    acknowledgeIncident,
    resolveIncident,
    deleteIncident,
    openInspectorModal
  };

  // Bootstrap Application
  document.addEventListener('DOMContentLoaded', async () => {
    await initMapLibre();
    setupEventListeners();
    loadInitialIncidents();
    setupSSE();
  });

  // Clean lifecycle destruction on page unload
  window.addEventListener('beforeunload', () => {
    if (mapView) {
      mapView.destroy();
    }
  });

})();
