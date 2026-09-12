/**
 * MeshRoute Backend Automated Validation Suite (Phase 9 + Dashboard Expansion)
 * Tests all layers:
 * 1. Health check
 * 2. Direct API Ingestion
 * 3. Duplicate Suppression & Idempotent ACK
 * 4. Malformed Packet Validation Error
 * 5. Stored Incident Retrieval with Decrypted Emergency Data
 * 6. Concurrent Submissions Handling
 * 7. Incident Resolution (POST /api/sos/:id/resolve)
 * 8. Incident Deletion (DELETE /api/sos/:id)
 * 9. Mesh SOS Simulation (POST /api/sos/simulate)
 * 10. Real-time Event Streaming (GET /api/sos/stream)
 */

const http = require('http');
const crypto = require('crypto');
const { server } = require('./server');

const TEST_PORT = 3999;
const PASSPHRASE = 'MeshRoute-Emergency-Broadcast-Key-2026';
const KEY = crypto.createHash('sha256').update(PASSPHRASE).digest();

function encryptEmergencyPayload(plaintextObj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const jsonStr = JSON.stringify(plaintextObj);
  let enc = cipher.update(jsonStr, 'utf8');
  enc = Buffer.concat([enc, cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, enc, tag]);
  return combined.toString('base64');
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: data ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      } : {}
    }, res => {
      let resData = '';
      res.on('data', chunk => { resData += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: runCatchingJson(resData)
        });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function runCatchingJson(str) {
  try { return JSON.parse(str); } catch { return str; }
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting MeshRoute Backend Test Suite (with Dashboard API expansion)...\n');

  await new Promise(resolve => server.listen(TEST_PORT, resolve));

  try {
    // -------------------------------------------------------------
    // Test 1: Health Check
    // -------------------------------------------------------------
    console.log('[Test 1] Health Check Endpoint');
    const health = await request('GET', '/health');
    assert(health.statusCode === 200, 'GET /health returns 200 OK');
    assert(health.body.status === 'OK', 'Response contains status OK');

    // -------------------------------------------------------------
    // Test 2: Valid SOS Ingestion (Layer 1)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Layer 1: Valid SOS Packet Submission');
    const emergencyPayload = {
      message: 'Trapped in ravine, 2 injured, medical supplies urgent',
      sender_name: 'Test Hiker A',
      medical_info: 'Fractured rib',
      battery_percent: 42
    };
    const ciphertext = encryptEmergencyPayload(emergencyPayload);

    const testPacket = {
      message_id: 'SOS-TEST-' + Date.now(),
      sender_id: 'MR-GATEWAY-01',
      originator_id: 'MR-NODE-A',
      timestamp: Date.now(),
      location: {
        latitude: 36.1069,
        longitude: -112.1129,
        accuracy: 4.0
      },
      priority: 'SOS',
      ttl: 8,
      hops: 2,
      payload: ciphertext,
      hop_path: ['MR-NODE-A', 'MR-RELAY-B', 'MR-GATEWAY-01']
    };

    const res1 = await request('POST', '/api/sos', testPacket);
    assert(res1.statusCode === 201, 'POST /api/sos returns 201 Created');
    assert(res1.body.status === 'ACCEPTED', 'Response status is ACCEPTED');
    assert(res1.body.ack === true, 'Response acknowledges receipt to gateway');
    assert(res1.body.incident_id !== undefined, 'Incident ID is generated');
    const incidentId = res1.body.incident_id;

    // -------------------------------------------------------------
    // Test 3: Duplicate Suppression (Layer 2)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Layer 2: Duplicate Suppression & Idempotency');
    const resDuplicate = await request('POST', '/api/sos', testPacket);
    assert(resDuplicate.statusCode === 200, 'POST duplicate returns 200 OK');
    assert(resDuplicate.body.status === 'ACKNOWLEDGED_EXISTING', 'Duplicate status is ACKNOWLEDGED_EXISTING');
    assert(resDuplicate.body.duplicate === true, 'Flagged duplicate is true');
    assert(resDuplicate.body.incident_id === incidentId, 'Matches original incident ID');

    // -------------------------------------------------------------
    // Test 4: Malformed Packet Rejection (Layer 3)
    // -------------------------------------------------------------
    console.log('\n[Test 4] Layer 3: Malformed Packet Validation');
    const badPacket = { message_id: 'BAD-123' };
    const resBad = await request('POST', '/api/sos', badPacket);
    assert(resBad.statusCode === 400, 'Malformed packet returns 400 Bad Request');
    assert(resBad.body.error !== undefined, 'Clear validation error returned');

    // -------------------------------------------------------------
    // Test 5: Incident Retrieval & Decryption Verification (Layer 4)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Layer 4: Incident Query & Authorized Decryption Verification');
    const resQuery = await request('GET', `/api/sos/${testPacket.message_id}`);
    assert(resQuery.statusCode === 200, 'GET /api/sos/:id returns 200 OK');
    const incident = resQuery.body.incident;
    assert(incident.message_id === testPacket.message_id, 'Message ID matches');
    assert(incident.location.latitude === 36.1069, 'GPS coordinates match');
    assert(incident.decrypted_payload !== null, 'Emergency payload was decrypted successfully');
    assert(incident.decrypted_payload.message === emergencyPayload.message, 'Decrypted message matches original');
    assert(incident.decrypted_payload.medical_info === 'Fractured rib', 'Decrypted medical info matches');

    // -------------------------------------------------------------
    // Test 6: Concurrent Race Condition (Layer 5)
    // -------------------------------------------------------------
    console.log('\n[Test 6] Layer 5: Concurrent Requests Handling');
    const racePacket = {
      ...testPacket,
      message_id: 'SOS-RACE-' + Date.now()
    };
    const [raceRes1, raceRes2] = await Promise.all([
      request('POST', '/api/sos', racePacket),
      request('POST', '/api/sos', racePacket)
    ]);
    const codes = [raceRes1.statusCode, raceRes2.statusCode].sort();
    assert(codes[0] === 200 && codes[1] === 201, 'One request created incident (201) and concurrent duplicate acknowledged (200)');

    // -------------------------------------------------------------
    // Test 7: Incident Resolution (POST /api/sos/:id/resolve)
    // -------------------------------------------------------------
    console.log('\n[Test 7] Dashboard API: Resolve Incident');
    const resResolve = await request('POST', `/api/sos/${incidentId}/resolve`);
    assert(resResolve.statusCode === 200, 'POST /api/sos/:id/resolve returns 200 OK');
    assert(resResolve.body.status === 'RESOLVED', 'Status updated to RESOLVED');
    assert(resResolve.body.incident.resolved_at !== undefined, 'Resolution timestamp recorded');

    // -------------------------------------------------------------
    // Test 8: Incident Deletion (DELETE /api/sos/:id)
    // -------------------------------------------------------------
    console.log('\n[Test 8] Dashboard API: Delete Incident');
    const resDelete = await request('DELETE', `/api/sos/${incidentId}`);
    assert(resDelete.statusCode === 200, 'DELETE /api/sos/:id returns 200 OK');
    assert(resDelete.body.deleted === true, 'Incident deletion flag is true');

    const resCheckDeleted = await request('GET', `/api/sos/${incidentId}`);
    assert(resCheckDeleted.statusCode === 404, 'GET deleted incident returns 404 Not Found');

    // -------------------------------------------------------------
    // Test 9: Simulation API (POST /api/sos/simulate)
    // -------------------------------------------------------------
    console.log('\n[Test 9] Dashboard API: Simulation Endpoint');
    const resSim = await request('POST', '/api/sos/simulate', {
      sender_name: 'Simulated Climber',
      message: 'Belay rope slipped, anchored on cliff ledge',
      medical_info: 'Rope burns',
      battery_percent: 55,
      latitude: 36.12,
      longitude: -112.10
    });
    assert(resSim.statusCode === 201, 'POST /api/sos/simulate returns 201 Created');
    assert(resSim.body.simulated === true, 'Simulation flag is true');
    assert(resSim.body.incident.decrypted_payload.sender_name === 'Simulated Climber', 'Simulated payload decrypted correctly');

    // -------------------------------------------------------------
    // Test 10: Real-time SSE Stream Connectivity (GET /api/sos/stream)
    // -------------------------------------------------------------
    console.log('\n[Test 10] Dashboard API: SSE Stream Connection');
    const sseCheck = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/sos/stream',
        method: 'GET'
      }, res => {
        assert(res.statusCode === 200, 'GET /api/sos/stream returns 200 OK');
        assert(res.headers['content-type'] === 'text/event-stream', 'Content-Type is text/event-stream');
        res.on('data', chunk => {
          const text = chunk.toString();
          if (text.includes('connected')) {
            req.destroy();
            resolve(true);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
    // Test 11: Google Maps Configuration (GET /api/config)
    // -------------------------------------------------------------
    console.log('\n[Test 11] Dashboard API: Google Maps Configuration');
    const configRes = await request('GET', '/api/config');
    assert(configRes.statusCode === 200, 'GET /api/config returns 200 OK');
    assert(configRes.body.map_engine === 'google', 'Map engine is configured as google');
    assert(configRes.body.google_maps_api_key !== undefined, 'Google Maps API key field is present');
    assert(configRes.body.map_style_url !== undefined, 'Map style URL is present');

    console.log('\n🎉 ALL BACKEND & DASHBOARD API TESTS PASSED!\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
