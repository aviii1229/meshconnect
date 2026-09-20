/**
 * MeshRoute Emergency Gateway Backend API
 * Standalone Node.js server (Built-in HTTP and Crypto, zero external dependencies required).
 *
 * Endpoints:
 * - POST   /api/sos          : Ingest SOS packet, validate, deduplicate, decrypt, notify, stream
 * - GET    /api/sos/:id      : Retrieve incident status by message_id or incident_id
 * - GET    /api/sos          : List all stored incidents
 * - DELETE /api/sos/:id      : Delete resolved incident and remove from active store
 * - POST   /api/sos/:id/resolve : Mark incident as resolved
 * - DELETE /api/sos          : Clear all incidents (for testing/cleanup)
 * - GET    /api/sos/stream   : Server-Sent Events (SSE) real-time incident event stream
 * - POST   /api/sos/simulate : Generate and ingest simulated multi-hop emergency packet
 * - GET    /health           : Health check
 * - GET    /dashboard        : Serves Emergency Operations Dashboard UI
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

// Load environment variables from .env if present
const envPath = path.join(ROOT_DIR, '.env');
function loadEnv() {
  if (fs.existsSync(envPath)) {
    try {
      const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of envLines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/(^['"]|['"]$)/g, '');
          process.env[key] = val;
        }
      }
    } catch (err) {
      console.warn('Could not read .env file:', err.message);
    }
  }
}
loadEnv();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const PORT = process.env.PORT || 3000;
const EMERGENCY_PASSPHRASE = 'MeshRoute-Emergency-Broadcast-Key-2026';
const EMERGENCY_KEY = crypto.createHash('sha256').update(EMERGENCY_PASSPHRASE).digest();

// In-memory incident store
const incidents = new Map();
const incidentLog = [];

// Server-Sent Events (SSE) active dashboard subscribers
const sseClients = new Set();

/**
 * Broadcast an event to all connected dashboard SSE clients
 */
function broadcastEvent(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Periodic SSE keepalive heartbeat
const heartbeat = setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': heartbeat\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 25000);
if (heartbeat.unref) heartbeat.unref();

/**
 * Decrypts AES-256-GCM emergency payload
 * Format: Base64 of [12-byte IV + ciphertext + 16-byte GCM authentication tag]
 */
function decryptPayload(base64Ciphertext) {
  try {
    const buffer = Buffer.from(base64Ciphertext.trim(), 'base64');
    if (buffer.length < 28) {
      return { error: 'Ciphertext too short for IV and Tag' };
    }
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(buffer.length - 16);
    const cipherBytes = buffer.subarray(12, buffer.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', EMERGENCY_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(cipherBytes, null, 'utf8');
    decrypted += decipher.final('utf8');
    return { data: JSON.parse(decrypted) };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Encrypts arbitrary plaintext object with AES-256-GCM for simulation and testing
 */
function encryptPayload(plaintextObj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', EMERGENCY_KEY, iv);
  let enc = cipher.update(JSON.stringify(plaintextObj), 'utf8');
  enc = Buffer.concat([enc, cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

/**
 * Dispatches emergency notification log
 */
function dispatchEmergencyNotification(incident, decrypted) {
  const separator = '='.repeat(60);
  console.log('\n' + separator);
  console.log('🚨 [EMERGENCY DISPATCH NOTIFICATION] 🚨');
  console.log(`Incident ID   : ${incident.incident_id}`);
  console.log(`Message ID    : ${incident.message_id}`);
  console.log(`Priority      : ${incident.priority}`);
  console.log(`Status        : ${incident.status}`);
  console.log(`Origin Node   : ${incident.originator_id || incident.sender_id}`);
  console.log(`Gateway Phone : ${incident.gateway_node || incident.sender_id}`);
  console.log(`Hops Traversed: ${incident.hops} (TTL: ${incident.ttl})`);
  console.log(`Hop Path      : ${(incident.hop_path || []).join(' ➔ ')}`);

  if (incident.location) {
    console.log(`GPS Location  : Lat ${incident.location.latitude}, Lon ${incident.location.longitude} (±${incident.location.accuracy || 0}m)`);
    console.log(`Map Link      : https://maps.google.com/?q=${incident.location.latitude},${incident.location.longitude}`);
  }

  if (decrypted) {
    console.log(`Emergency Text: "${decrypted.message}"`);
    console.log(`Sender Name   : ${decrypted.sender_name || 'N/A'}`);
    console.log(`Medical Info  : ${decrypted.medical_info || 'None'}`);
    console.log(`Battery Level : ${decrypted.battery_percent >= 0 ? decrypted.battery_percent + '%' : 'Unknown'}`);
  } else {
    console.log('Emergency Text: [Encrypted Payload - Decryption Pending]');
  }
  console.log(separator + '\n');
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  // Normalize consecutive slashes and strip trailing slash (except for root '/')
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+/g, '/').replace(/\/$/, '');
  }

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  console.log(`[HTTP ${req.method}] ${req.url} (path: ${url.pathname}) from ${clientIp}`);

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // GET /health
  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, {
      status: 'OK',
      service: 'MeshRoute Backend & Dispatch Dashboard',
      version: '1.1.0',
      total_incidents: incidents.size,
      connected_dashboards: sseClients.size,
      timestamp: Date.now()
    });
  }

  // GET /api/config (Public Configuration for Dashboard)
  if (req.method === 'GET' && url.pathname === '/api/config') {
    loadEnv();
    return sendJson(res, 200, {
      map_engine: 'leaflet',
      leaflet: true,
      google_maps_api_key: process.env.GOOGLE_MAPS_API_KEY || '',
      google_maps_map_id: process.env.GOOGLE_MAPS_MAP_ID || '',
      map_style_url: process.env.MAP_STYLE_URL || 'tactical'
    });
  }

  // GET /api/sos/stream (SSE Stream for Real-time Dashboard Updates)
  if (req.method === 'GET' && url.pathname === '/api/sos/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });
    if (res.flushHeaders) res.flushHeaders();
    res.write(': connected\n\n');
    res.write(`event: ping\ndata: {"time":${Date.now()}}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // Helper to find incident by message_id or incident_id
  function findIncident(id) {
    let incident = incidents.get(id);
    if (!incident) {
      for (const inc of incidents.values()) {
        if (inc.incident_id === id || inc.message_id === id) {
          incident = inc;
          break;
        }
      }
    }
    return incident;
  }

  // GET /api/incidents and GET /api/sos (with status filter support)
  if (req.method === 'GET' && (url.pathname === '/api/incidents' || url.pathname === '/api/sos')) {
    const statusParam = url.searchParams.get('status');
    // Default /api/incidents to active (unresolved) per architecture.md
    const defaultFilter = url.pathname === '/api/incidents' ? 'active' : 'all';
    const filter = (statusParam || defaultFilter).toLowerCase();

    let list = incidentLog;
    if (filter === 'active') {
      list = incidentLog.filter(i => i.status !== 'RESOLVED');
    } else if (filter !== 'all') {
      list = incidentLog.filter(i => (i.status || 'NEW').toLowerCase() === filter);
    }

    return sendJson(res, 200, {
      count: list.length,
      incidents: list
    });
  }

  // GET /api/incidents/:id or /api/sos/:id
  if (req.method === 'GET' && ((url.pathname.startsWith('/api/sos/') && url.pathname !== '/api/sos/stream') || url.pathname.startsWith('/api/incidents/'))) {
    const cleanPath = url.pathname.replace(/^\/api\/(sos|incidents)\//, '');
    const id = decodeURIComponent(cleanPath);
    const incident = findIncident(id);
    if (!incident) {
      return sendJson(res, 404, { error: 'Incident not found', id });
    }
    return sendJson(res, 200, { status: 'FOUND', incident });
  }

  // POST /api/incidents/:id/acknowledge or /api/sos/:id/acknowledge
  if (req.method === 'POST' && (url.pathname.includes('/acknowledge'))) {
    const id = decodeURIComponent(url.pathname.replace(/^\/api\/(sos|incidents)\//, '').replace('/acknowledge', ''));
    const target = findIncident(id);
    if (!target) {
      return sendJson(res, 404, { error: 'Incident not found for acknowledge', id });
    }

    target.status = 'ACKNOWLEDGED';
    target.acknowledged_at = Date.now();

    broadcastEvent('sos:acknowledged', {
      incident_id: target.incident_id,
      message_id: target.message_id,
      status: target.status,
      acknowledged_at: target.acknowledged_at
    });

    console.log(`[ACKNOWLEDGED] Incident ${target.incident_id} (${target.message_id}) marked as ACKNOWLEDGED.`);
    return sendJson(res, 200, {
      status: 'ACKNOWLEDGED',
      incident: target
    });
  }

  // POST /api/sos/:id/resolve or /api/incidents/:id/resolve
  if (req.method === 'POST' && (url.pathname.includes('/resolve'))) {
    const id = decodeURIComponent(url.pathname.replace(/^\/api\/(sos|incidents)\//, '').replace('/resolve', ''));
    const target = findIncident(id);
    if (!target) {
      return sendJson(res, 404, { error: 'Incident not found for resolve', id });
    }

    target.status = 'RESOLVED';
    target.resolved_at = Date.now();

    broadcastEvent('sos:resolved', {
      incident_id: target.incident_id,
      message_id: target.message_id,
      status: target.status,
      resolved_at: target.resolved_at
    });

    console.log(`[RESOLVED] Incident ${target.incident_id} (${target.message_id}) marked as RESOLVED.`);
    return sendJson(res, 200, {
      status: 'RESOLVED',
      incident: target
    });
  }

  // DELETE /api/sos/:id or /api/incidents/:id (Resolve and delete incident)
  if (req.method === 'DELETE' && (url.pathname.startsWith('/api/sos/') || url.pathname.startsWith('/api/incidents/'))) {
    const id = decodeURIComponent(url.pathname.replace(/^\/api\/(sos|incidents)\//, ''));
    let foundKey = null;
    let deletedRecord = null;

    if (incidents.has(id)) {
      foundKey = id;
      deletedRecord = incidents.get(id);
    } else {
      for (const [key, inc] of incidents.entries()) {
        if (inc.incident_id === id || inc.message_id === id) {
          foundKey = key;
          deletedRecord = inc;
          break;
        }
      }
    }

    if (!foundKey) {
      return sendJson(res, 404, { error: 'Incident not found for deletion', id });
    }

    incidents.delete(foundKey);
    const idx = incidentLog.findIndex(i => i.message_id === foundKey || i.incident_id === id);
    if (idx !== -1) {
      incidentLog.splice(idx, 1);
    }

    broadcastEvent('sos:deleted', {
      incident_id: deletedRecord.incident_id,
      message_id: deletedRecord.message_id
    });

    console.log(`[DELETED] Incident ${deletedRecord.incident_id} (${deletedRecord.message_id}) deleted by operator.`);
    return sendJson(res, 200, {
      status: 'DELETED',
      deleted: true,
      incident_id: deletedRecord.incident_id,
      message_id: deletedRecord.message_id
    });
  }

  // DELETE /api/sos (Clear all incidents)
  if (req.method === 'DELETE' && url.pathname === '/api/sos') {
    const count = incidents.size;
    incidents.clear();
    incidentLog.length = 0;
    broadcastEvent('sos:cleared', { count });
    return sendJson(res, 200, { status: 'CLEARED', cleared_count: count });
  }

  // POST /api/sos/simulate (Generate realistic simulated mesh SOS)
  if (req.method === 'POST' && url.pathname === '/api/sos/simulate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let custom = {};
      try {
        if (body.trim()) custom = JSON.parse(body);
      } catch {}

      const presets = [
        {
          sender_name: 'Sarah Connor',
          message: 'Hiking party stuck on ledge near Phantom Ranch. Severe ankle sprain, low water.',
          medical_info: 'Sprained left ankle, mild dehydration',
          battery_percent: 28,
          lat: 36.1012,
          lng: -112.0911
        },
        {
          sender_name: 'Marcus Vance',
          message: 'Mountain bike crash off North Kaibab trail. Possible concussion, need extraction.',
          medical_info: 'Head contusion, disoriented, laceration on shoulder',
          battery_percent: 15,
          lat: 36.1345,
          lng: -112.0589
        },
        {
          sender_name: 'Elena Rostova',
          message: 'Flash flood blocked Bright Angel trail canyon. 4 people stranded above wash.',
          medical_info: 'Hypothermia symptoms in 1 elderly hiker',
          battery_percent: 49,
          lat: 36.0823,
          lng: -112.1456
        },
        {
          sender_name: 'David Kim',
          message: 'Avalanche debris blocking backcountry ridge. GPS beacon deployed, cold shock.',
          medical_info: 'Bruised ribs, cold exposure',
          battery_percent: 63,
          lat: 36.1189,
          lng: -112.1294
        }
      ];

      const preset = presets[Math.floor(Math.random() * presets.length)];
      const payloadObj = {
        message: custom.message || preset.message,
        sender_name: custom.sender_name || preset.sender_name,
        medical_info: custom.medical_info || preset.medical_info,
        battery_percent: custom.battery_percent !== undefined ? custom.battery_percent : preset.battery_percent
      };

      const ciphertext = encryptPayload(payloadObj);
      const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const originatorNode = 'MR-NODE-' + randSuffix;
      const relayNode = 'MR-RELAY-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      const gatewayNode = 'MR-GATEWAY-01';

      const simulatedPacket = {
        message_id: 'SOS-SIM-' + Date.now().toString(36).toUpperCase() + '-' + randSuffix,
        sender_id: gatewayNode,
        originator_id: originatorNode,
        timestamp: Date.now(),
        location: {
          latitude: custom.latitude !== undefined ? custom.latitude : (preset.lat + (Math.random() - 0.5) * 0.01),
          longitude: custom.longitude !== undefined ? custom.longitude : (preset.lng + (Math.random() - 0.5) * 0.01),
          accuracy: custom.accuracy || Math.floor(3 + Math.random() * 8)
        },
        priority: 'SOS',
        ttl: 8,
        hops: custom.hops || Math.floor(1 + Math.random() * 4),
        payload: ciphertext,
        hop_path: [originatorNode, relayNode, gatewayNode]
      };

      // Ingest packet through standard ingestion logic
      const messageId = simulatedPacket.message_id;
      const incidentId = 'INC-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const decryptResult = decryptPayload(simulatedPacket.payload);

      const incidentRecord = {
        incident_id: incidentId,
        message_id: simulatedPacket.message_id,
        originator_id: simulatedPacket.originator_id,
        gateway_node: simulatedPacket.sender_id,
        priority: simulatedPacket.priority,
        status: custom.status || 'NEW',
        ttl: simulatedPacket.ttl,
        hops: simulatedPacket.hops,
        hop_path: simulatedPacket.hop_path,
        location: simulatedPacket.location,
        ciphertext_payload: simulatedPacket.payload,
        decrypted_payload: decryptResult.data || null,
        decryption_error: decryptResult.error || null,
        received_at: Date.now(),
        notification_sent: true
      };

      incidents.set(messageId, incidentRecord);
      incidentLog.unshift(incidentRecord);

      dispatchEmergencyNotification(incidentRecord, decryptResult.data);
      broadcastEvent('sos:new', incidentRecord);

      return sendJson(res, 201, {
        status: 'ACCEPTED',
        simulated: true,
        incident: incidentRecord
      });
    });
    return;
  }

  // GET /api/sos-events (TECHNICAL_SPECIFICATIONS.md §6.2)
  // Returns array of recent incidents sorted newest first, including origin coordinates, hops traversed, decrypted medical note, and timestamp.
  if (req.method === 'GET' && url.pathname === '/api/sos-events') {
    const events = incidentLog.map(inc => ({
      incident_id: inc.incident_id,
      message_id: inc.message_id,
      originator_id: inc.originator_id,
      gateway_node: inc.gateway_node,
      priority: inc.priority,
      hops: inc.hops,
      ttl: inc.ttl,
      hop_path: inc.hop_path,
      location: inc.location,
      decrypted_payload: inc.decrypted_payload,
      medical_note: inc.decrypted_payload ? (inc.decrypted_payload.medical_info || '') : '',
      message: inc.decrypted_payload ? (inc.decrypted_payload.message || '') : '',
      sender_name: inc.decrypted_payload ? (inc.decrypted_payload.sender_name || '') : '',
      battery_percent: inc.decrypted_payload ? inc.decrypted_payload.battery_percent : -1,
      timestamp: inc.received_at,
      received_at: inc.received_at
    }));
    return sendJson(res, 200, events);
  }

  // POST /api/sos (Accepts /api/sos, /api/sos/api/sos, /sos, or /dashboard/api/sos)
  if (req.method === 'POST' && (url.pathname === '/api/sos' || url.pathname.endsWith('/api/sos') || url.pathname === '/sos')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let packet;
      try {
        packet = JSON.parse(body);
      } catch (err) {
        return sendJson(res, 400, { error: 'Invalid JSON body' });
      }

      // 1. Validate mandatory schema per architecture.md §Packet Schema
      const required = ['message_id', 'sender_id', 'priority', 'ttl', 'hops', 'payload'];
      for (const field of required) {
        if (packet[field] === undefined || packet[field] === null) {
          return sendJson(res, 400, {
            error: `Missing mandatory packet schema field: ${field}`,
            required_fields: required
          });
        }
      }

      const messageId = packet.message_id;

      // 2. Duplicate Check: if message_id is already known, return ACK without duplicating notification
      if (incidents.has(messageId)) {
        const existing = incidents.get(messageId);
        console.log(`[BACKEND DEDUP] Duplicate SOS received: ${messageId} from gateway ${packet.sender_id}. Acknowledging existing incident.`);
        
        broadcastEvent('sos:duplicate', {
          message_id: messageId,
          incident_id: existing.incident_id,
          gateway_node: packet.sender_id,
          hops: packet.hops
        });

        return sendJson(res, 200, {
          status: 'ACKNOWLEDGED_EXISTING',
          message_id: messageId,
          incident_id: existing.incident_id,
          acknowledged: true,
          duplicate: true,
          first_received_at: existing.received_at
        });
      }

      // 3. New Incident Processing
      const incidentId = 'INC-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
      const decryptResult = decryptPayload(packet.payload);

      const incidentRecord = {
        incident_id: incidentId,
        message_id: packet.message_id,
        originator_id: packet.originator_id || packet.sender_id,
        gateway_node: packet.sender_id,
        priority: packet.priority,
        status: 'NEW',
        ttl: packet.ttl,
        hops: packet.hops,
        hop_path: packet.hop_path || [packet.sender_id],
        location: packet.location || null,
        ciphertext_payload: packet.payload,
        decrypted_payload: decryptResult.data || null,
        decryption_error: decryptResult.error || null,
        received_at: Date.now(),
        notification_sent: true
      };

      incidents.set(messageId, incidentRecord);
      incidentLog.unshift(incidentRecord);

      // 4. Trigger Emergency Notification & Broadcast to Dashboard
      dispatchEmergencyNotification(incidentRecord, decryptResult.data);
      broadcastEvent('sos:new', incidentRecord);

      return sendJson(res, 201, {
        status: 'ACCEPTED',
        incident_id: incidentId,
        message_id: messageId,
        ack: true,
        notification_dispatched: true,
        decrypted: decryptResult.data ? true : false
      });
    });
    return;
  }

  // Static File Serving (Dashboard, Landing Page & Assets)
  if (req.method === 'GET' || req.method === 'HEAD') {
    let filePath = url.pathname;
    if (filePath === '/') {
      filePath = '/index.html';
    } else if (filePath === '/dashboard') {
      filePath = '/dashboard.html';
    }

    // Prevent directory traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const absolutePath = path.join(ROOT_DIR, safePath);

    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      const ext = path.extname(absolutePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      if (req.method === 'HEAD') {
        return res.end();
      }
      return fs.createReadStream(absolutePath).pipe(res);
    }
  }

  // 404 for unknown endpoints
  console.warn(`[HTTP 404] No route found for ${req.method} ${url.pathname}`);
  sendJson(res, 404, { error: 'Not found', path: url.pathname });
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`🚀 MeshRoute Backend running on port ${PORT} (0.0.0.0)`);
    console.log(`   Dispatch Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`   Local Health Check: http://localhost:${PORT}/health`);
    console.log(`   Phone SOS Endpoint: http://localhost:${PORT}/api/sos`);
    console.log(`   Real-Time SSE Stream: http://localhost:${PORT}/api/sos/stream`);
    console.log(`   AES-256-GCM emergency key active for authorized decryption`);
    console.log(`====================================================\n`);
  });
}

const handler = (req, res) => {
  server.emit('request', req, res);
};

handler.server = server;
handler.incidents = incidents;
handler.incidentLog = incidentLog;
handler.decryptPayload = decryptPayload;
handler.encryptPayload = encryptPayload;
handler.broadcastEvent = broadcastEvent;

module.exports = handler;
