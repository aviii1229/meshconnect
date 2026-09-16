# MeshRoute — System Documentation & Architectural Specification

> **Offline-First Emergency BLE Mesh Networking & Real-Time Incident Dispatch Console**  
> *Enabling peer-to-peer life-saving communications when cellular infrastructure and power grids fail.*

---

## Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [End-to-End System Architecture](#2-end-to-end-system-architecture)
3. [Complete Incident Lifecycle Workflow](#3-complete-incident-lifecycle-workflow)
4. [Component Deep-Dives](#4-component-deep-dives)
   - [A. Android Edge Client (`app/`)](#a-android-edge-client-app)
   - [B. Emergency Gateway Backend (`backend/`)](#b-emergency-gateway-backend-backend)
   - [C. Emergency Dispatch Console (`dashboard`)](#c-emergency-dispatch-console-dashboard)
   - [D. Google Maps Subsystem (`map/`)](#d-google-maps-subsystem-map)
   - [E. Public Landing Portal (`index.html`)](#e-public-landing-portal-indexhtml)
5. [Wire Protocol & Data Schemas](#5-wire-protocol--data-schemas)
6. [Security & Cryptography Architecture](#6-security--cryptography-architecture)
7. [Environment & Configuration](#7-environment--configuration)
8. [Setup, Execution & Testing Guide](#8-setup-execution--testing-guide)
9. [Future Roadmap & Hardware Expansion](#9-future-roadmap--hardware-expansion)

---

## 1. Executive Summary & Problem Statement

### The Problem
During catastrophic natural disasters (hurricanes, earthquakes, floods, wildfires) or remote wilderness emergencies:
- **Cellular towers lose power or backhaul connectivity** within hours.
- **Fibre lines break**, isolating entire regions from internet access.
- Victims cannot dial 911 or dispatch their GPS coordinates to emergency responders.
- Traditional rescue operations must rely on physical line-of-sight searches.

### The MeshRoute Solution
**MeshRoute** is a decentralized, zero-infrastructure emergency networking system. It turns commercial, off-the-shelf smartphones into cooperative **Bluetooth Low Energy (BLE) mesh relay nodes**. 

1. **No Cell Service or SIM Required**: Devices discover each other locally over BLE.
2. **Store-Carry-Forward Routing**: If no peers are nearby, packets are cached in local database storage and relayed whenever a new peer moves within radio range.
3. **Opportunistic Internet Gateway**: The moment *any* single phone in the mesh network comes within reach of Wi-Fi, satellite backhaul, or restored cellular, it transparently uploads the cached emergency packets to the **MeshRoute Cloud Dispatch Gateway**.
4. **Real-Time Tactical Dispatch**: Search and rescue (SAR) operators and emergency dispatchers track live incidents on a mission-critical tactical dashboard powered by the **Google Maps JavaScript API**.

---

## 2. End-to-End System Architecture

MeshRoute operates as a hybrid topology combining a decentralized edge mesh with a centralized emergency dispatch gateway:

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                       OFFLINE EDGE BLE MESH CLUSTER                     │
 │                                                                         │
 │   [ Hiker A / Victim ]                                                  │
 │   (In Ravine - No Cell)                                                 │
 │       │                                                                 │
 │       │ 1. Local GPS + AES-256-GCM Encrypted SOS                        │
 │       ▼                                                                 │
 │   ┌─────────────┐                                                       │
 │   │  Phone A    │ (Originator)                                          │
 │   └──────┬──────┘                                                       │
 │          │                                                              │
 │          │ BLE Advertisement Beacon (~10-30m)                           │
 │          ▼                                                              │
 │   ┌─────────────┐                                                       │
 │   │  Phone B    │ (Relay 1: Store-Carry-Forward / Hops: 1)              │
 │   └──────┬──────┘                                                       │
 │          │                                                              │
 │          │ Multi-hop BLE Forwarding                                     │
 │          ▼                                                              │
 │   ┌─────────────┐                                                       │
 │   │  Phone C    │ (Relay 2: Trail Trekker / Hops: 2)                   │
 │   └──────┬──────┘                                                       │
 └──────────┼──────────────────────────────────────────────────────────────┘
            │
            │ Opportunistic Physical Movement / Radio Contact
            ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                   INTERNET GATEWAY EDGE / UPLINK                        │
 │                                                                         │
 │   ┌─────────────┐                                                       │
 │   │  Phone D    │ (Reaches Trailhead Wi-Fi or Cellular Tower)           │
 │   │  [Gateway]  │                                                       │
 │   └──────┬──────┘                                                       │
 └──────────┼──────────────────────────────────────────────────────────────┘
            │
            │ HTTPS REST Ingestion (POST /api/sos)
            ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                  MESHROUTE EMERGENCY BACKEND SERVER                     │
 │                                                                         │
 │   ┌─────────────────────────────────────────────────────────────────┐   │
 │   │  Node.js Ingestion Engine                                       │   │
 │   │  • Schema Validation (Mandatory wire fields)                    │   │
 │   │  • Idempotency & Deduplication (Message ID check)               │   │
 │   │  • AES-256-GCM Authorized Decryption Pipeline                   │   │
 │   │  • Real-Time Server-Sent Events (SSE) Broadcast Engine          │   │
 │   └────────────────────────────────┬────────────────────────────────┘   │
 └────────────────────────────────────┼────────────────────────────────────┘
                                      │
                                      │ Live SSE Stream (GET /api/sos/stream)
                                      ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                 TACTICAL DISPATCH DASHBOARD CONSOLE                     │
 │                                                                         │
 │   ┌──────────────────────────────────┐ ┌────────────────────────────┐   │
 │   │  Google Maps Satellite & Terrain │ │ Incident Triage Queue      │   │
 │   │  • Pulsing Animated Beacons      │ │ • Active / Ack / Resolved  │   │
 │   │  • GPS Accuracy Rings            │ │ • Audio Siren Alert        │   │
 │   │  • Emergency Polyline Routing    │ │ • Hop Traversal Chain      │   │
 │   │  • Glassmorphic InfoWindows      │ │ • Deep Cryptography Modal  │   │
 │   └──────────────────────────────────┘ └────────────────────────────┘   │
 └─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete Incident Lifecycle Workflow

```
[VICTIM PHONE]                 [RELAY PHONES]              [GATEWAY PHONE]           [BACKEND SERVER]         [DISPATCH CONSOLE]
      │                              │                            │                          │                        │
      ├─► Trigger SOS Button         │                            │                          │                        │
      ├─► Read GPS Coordinates       │                            │                          │                        │
      ├─► Encrypt Emergency Payload  │                            │                          │                        │
      ├─► Save to Room Database      │                            │                          │                        │
      ├─► Broadcast BLE Packet ─────►│                            │                          │                        │
      │                              ├─► Check SeenSet (New?)     │                          │                        │
      │                              ├─► Decrement TTL (8 -> 7)   │                          │                        │
      │                              ├─► Append Node to HopPath   │                          │                        │
      │                              ├─► Store in Local Queue     │                          │                        │
      │                              ├─► Forward BLE Packet ─────►│                          │                        │
      │                              │                            ├─► Detect Internet Avail  │                        │
      │                              │                            ├─► HTTP POST /api/sos ───►│                        │
      │                              │                            │                          ├─► Validate Schema      │
      │                              │                            │                          ├─► Check Deduplication  │
      │                              │                            │                          ├─► Decrypt AES-256-GCM  │
      │                              │                            │                          ├─► Store Incident       │
      │                              │                            │                          ├─► SSE Broadcast ──────►│
      │                              │                            │                          │                        ├─► Siren Audio Ping
      │                              │                            │                          │                        ├─► Plot Google Pin
      │                              │                            │                          │                        ├─► Add Triage Card
      │                              │                            │                          │                        ├─► Camera Pan / Zoom
```

### Detailed Steps:
1. **Creation**: The victim taps the physical or on-screen SOS button in the Android app. The device captures high-accuracy GPS coordinates, user medical notes, and battery percentage.
2. **Cryptographic Sealing**: The sensitive data is encrypted using AES-256-GCM. Personal identifiers and medical info are concealed from intermediate relay devices.
3. **Local Persistence**: The packet is saved into an offline-first SQLite database (via Android Room), ensuring survivability even if the app crashes or the battery dies.
4. **BLE Flooding & Hop Bounding**: The app broadcasts BLE advertisement packets. Intermediate relay devices listen, check their local `SeenSet` to drop duplicates, decrement the Time-to-Live (`TTL`), increment `hops`, and rebroadcast.
5. **Gateway Uplink**: When any phone in the mesh comes within reach of an active internet connection (Wi-Fi, cellular, satellite), its background `GatewayUploader` detects connectivity and pushes the packet via `POST /api/sos`.
6. **Backend Verification & Ingestion**: The backend validates the packet against mandatory schemas, deduplicates repeated packets from multiple gateways, decrypts the payload with the master emergency key, and logs the incident.
7. **Real-time Tactical Triage**: The incident is instantly broadcast to all connected web dashboards over Server-Sent Events (SSE). An audible chime sounds, a pulsing crimson beacon is plotted on Google Maps at the victim's exact GPS coordinates, and operators can inspect medical vitals and initiate rescue routing.

---

## 4. Component Deep-Dives

### A. Android Edge Client (`app/`)
- **Technology**: Kotlin, Jetpack Compose, Material3, Room Database, Android BLE APIs.
- **Key Modules**:
  - `mesh/ble/BleMeshTransport.kt`: Manages BLE advertiser and scanner lifecycles with dynamic duty-cycling to balance battery life and latency.
  - `mesh/router/MeshRouter.kt`: Implements opportunistic routing logic, TTL management, and hop-path logging.
  - `mesh/router/SeenSet.kt`: In-memory LRU cache backed by Room database (`SeenMessageDao`) to prevent infinite relay loops.
  - `data/queue/ForwardStore.kt`: Offline persistent queue storing packets until successfully relayed or uploaded.
  - `gateway/GatewayUploader.kt`: Automatically triggers upload when `NetworkMonitor` reports active internet.
  - `security/CryptoManager.kt`: Hardware-backed AES-256-GCM encryption with randomized 12-byte IVs.
  - `gateway/NostrRelayBridge.kt`: Fallback bridge for publishing emergency packets to decentralized Nostr relays (NIP-01) for censorship-resistant ingestion.

### B. Emergency Gateway Backend (`backend/`)
- **Technology**: Node.js (Built-in `http` and `crypto` modules — zero external npm dependencies required).
- **Core Endpoints**:
  - `POST /api/sos`: Ingests wire packets, validates schema, deduplicates, decrypts AES-256-GCM, and streams updates.
  - `GET /api/sos/:id`: Retrieves incident telemetry and decrypted status.
  - `GET /api/sos`: Returns all active emergency incidents.
  - `POST /api/sos/:id/resolve`: Marks incident as resolved by dispatch operators.
  - `DELETE /api/sos/:id`: Cleans up resolved incident records.
  - `POST /api/sos/simulate`: Generates realistic multi-hop emergency packets for live demonstrations and testing.
  - `GET /api/sos/stream`: Server-Sent Events (SSE) stream pushing sub-second updates to dashboard clients.
  - `GET /api/config`: Securely serves client configuration (Google Maps API key, default preset) from `.env`.

### C. Emergency Dispatch Console (`dashboard`)
- **Technology**: HTML5, Vanilla CSS3 (Cyber-Dark Glassmorphism Design System), Vanilla JavaScript.
- **Key Features**:
  - **Map-Left Workspace Layout**: Full tactical Google Map occupies the expansive left canvas (`#map-wrapper`) with floating style presets and GPS pin controls, while the scrollable emergency incident triage sidebar sits on the right for ergonomic, high-speed incident handling.
  - **KPI Analytics Banner**: Top telemetry metrics tracking Active Alerts, Average Mesh Hops, Active Relay Nodes, and Resolved Incidents.
  - **Audible Alert Siren**: Synthesized emergency audio ping alerting operators to incoming SOS signals.
  - **Sidebar Triage Queue**: Interactive incident cards with live search, keyword filters, and status toggles (`Active`, `All`, `Resolved`).
  - **Deep Inspector Modal**: Displays the complete multi-hop node chain (`Node A ➔ Relay B ➔ Gateway D`), decryption status, medical data, battery levels, and raw wire packet JSON.

### D. Google Maps Subsystem (`map/`)
- **Technology**: Google Maps JavaScript API.
- **Modular Sub-Modules**:
  - `mapConfig.js`: Asynchronous dynamic script loader for Google Maps API; handles runtime config from `.env` and authentication failure hooks (`gm_authFailure`).
  - `mapView.js`: Central controller managing camera movements (`flyTo`, `fitBounds`), resize observation, preset switching, and clean loading/error states.
  - `markerManager.js`: Custom animated HTML overlay markers with CSS pulsing rings. Features a modular type registry supporting:
    - 🚨 `sos`: Critical emergency beacon (Crimson)
    - 🆘 `person_in_danger`: High-priority victim beacon
    - 🚁 `rescue_team`: Tactical SAR team beacon
    - 🛡️ `safe_zone`: Designated evacuation sanctuary
    - 🏢 `emergency_center`: Command dispatch headquarters
    - 🏥 `hospital`: Medical aid station
    - 📡 `mesh_node`: Active BLE relay node
    - 🛰️ `gateway`: Connected satellite/internet gateway
    - 🥾 `trekker`: User/Civilian tracking marker
  - `locationManager.js`: Browser Geolocation API integration with animated blue pulse dot and accuracy radius.
  - `mapControls.js`: Custom glassmorphic navigation controls (Zoom In/Out, Locate Me, Reset North Compass, Fullscreen).
  - `routeManager.js`: High-contrast polyline rendering with shadow casing and `google.maps.DirectionsService` hooks for shortest rescue routes.
  - `utils.js`: Robust coordinate normalization (`[lng, lat]`, `[lat, lng]`, `{ lat, lng }`) and boundary math.

### E. Public Landing Portal (`index.html`)
- **Technology**: Semantic HTML5, CSS3 Grid/Flexbox, responsive modern typography.
- **Purpose**: Public showcase explaining MeshRoute's mission, offline BLE mesh protocols, technical architecture, and interactive links to the dispatch console.

---

## 5. Wire Protocol & Data Schemas

### 1. Inbound Emergency Packet (Wire Schema)
Transmitted over BLE advertisements and forwarded to `POST /api/sos`:

```json
{
  "message_id": "SOS-98A1-48218942",
  "sender_id": "MR-NODE-7X9P",
  "originator_id": "MR-NODE-7X9P",
  "timestamp": 1789220900000,
  "priority": "SOS",
  "ttl": 8,
  "hops": 2,
  "hop_path": [
    "MR-NODE-7X9P",
    "MR-RELAY-3K1W",
    "MR-GATEWAY-01"
  ],
  "location": {
    "latitude": 36.1069,
    "longitude": -112.1129,
    "accuracy": 5
  },
  "payload": "W12-BYTE-IV][CIPHERTEXT][16-BYTE-AUTH-TAG]"
}
```

### 2. Decrypted Telemetry (Disclosed to Authorized Dispatchers)
After server-side AES-256-GCM verification:

```json
{
  "sender_name": "Sarah Connor",
  "message": "Flash flood trapped on boulder. 2 adults, 1 child. Urgent.",
  "medical_info": "Hypothermia, diabetic supplies needed",
  "battery_percent": 38,
  "emergency_type": "FLOOD_TRAPPED"
}
```

---

## 6. Security & Cryptography Architecture

```
                 [Plaintext Emergency Info]
                             │
                             ▼
               AES-256-GCM Encryption Key
              (Emergency Broadcast Secret)
                             │
    ┌────────────────────────┴────────────────────────┐
    ▼                                                 ▼
12-Byte Cryptographic IV                  16-Byte Authentication Tag
    │                                                 │
    └────────────────────────┬────────────────────────┘
                             │
                             ▼
           [Concatenated Base64 Wire Payload]
                             │
                             ▼
      Relayed across untrusted peer phones (BLE)
                             │
                             ▼
                [MeshRoute Gateway Server]
                             │
                             ▼
            AES-256-GCM Authentic Decryption
                             │
                             ▼
         [Verified Telemetry Delivered to SAR]
```

1. **Payload Confidentiality**: The body of the SOS message is encrypted with AES-256-GCM. Intermediate relay phones only inspect unencrypted routing headers (`message_id`, `ttl`, `hops`) and cannot eavesdrop on medical or personal notes.
2. **Tamper Proofing**: Any attempt by an intermediate node to modify the ciphertext will invalidate the 16-byte GCM authentication tag, causing the backend to reject the packet.
3. **Replay & Loop Suppression**: Every packet has a cryptographically unique `message_id`. Nodes and the backend record seen IDs to drop duplicate transmissions instantly.
4. **Bounded Propagation**: Packets start with a Time-To-Live (TTL) of 8. Each relay decrements the TTL by 1. When `ttl <= 0`, the packet is dropped, preventing network broadcast storms.

---

## 7. Environment & Configuration

Environment variables are managed via a `.env` file loaded automatically by the backend server:

```env
# MeshRoute Server Configuration
PORT=3000

# Google Maps JavaScript API Configuration
GOOGLE_MAPS_API_KEY=AIzaSyYourProductionApiKeyHere

# Optional Google Cloud Map ID (for Advanced Vector Features)
GOOGLE_MAPS_MAP_ID=

# Initial Map Preset (terrain | tactical | roadmap | hybrid)
MAP_STYLE_URL=terrain
```

### Google Cloud Console Requirements
1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/overview).
2. Enable the **Maps JavaScript API**.
3. *(Optional)* Enable the **Directions API** for automated rescue team routing.
4. Restrict your API key:
   - **Application Restriction**: HTTP referrers (`https://yourdomain.com/*`, `http://localhost:3000/*`).
   - **API Restriction**: Restrict key specifically to **Maps JavaScript API**.

---

## 8. Setup, Execution & Testing Guide

### Prerequisites
- **Node.js**: Version 18.0.0 or higher
- **Web Browser**: Chrome, Firefox, Safari, or Edge
- **Android Development** *(Optional, for APK builds)*: Android Studio, JDK 17, Android SDK API 34

### 1. Starting the Server & Dashboard
```bash
# Clone repository
git clone https://github.com/aviii1229/meshconnect.git
cd mesh-network

# Install dependencies (zero external npm packages required for backend)
npm install

# Start the Node.js Emergency Gateway
npm start
```

Open your browser to:
- **Operations Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
- **Public Landing Page**: [http://localhost:3000/](http://localhost:3000/)
- **Backend Health Check**: [http://localhost:3000/health](http://localhost:3000/health)

### 2. Running the Automated Test Suite
The automated test suite verifies all layers: health check, packet schema validation, duplicate suppression, cryptographic decryption, incident resolution, deletion, and Google Maps configuration.

```bash
npm test
```

Expected output:
```text
🧪 Starting MeshRoute Backend Test Suite (with Dashboard API expansion)...

[Test 1] Health Check Endpoint - 200 OK
[Test 2] Layer 1: Valid SOS Packet Submission - 201 Created
[Test 3] Layer 2: Duplicate Suppression & Idempotency - 200 OK
[Test 4] Layer 3: Malformed Packet Validation - 400 Bad Request
[Test 5] Layer 4: Incident Query & Authorized Decryption Verification - 200 OK
[Test 6] Layer 5: Concurrent Requests Handling - 201/200 OK
[Test 7] Dashboard API: Resolve Incident - 200 OK
[Test 8] Dashboard API: Delete Incident - 200 OK
[Test 9] Dashboard API: Simulation Endpoint - 201 Created
[Test 10] Dashboard API: SSE Stream Connection - 200 OK
[Test 11] Dashboard API: Google Maps Configuration - 200 OK

🎉 ALL BACKEND & DASHBOARD API TESTS PASSED!
```

---

## 9. Future Roadmap & Hardware Expansion

1. **LoRa 915 MHz / 868 MHz Radio Bridge**: Integrating low-cost LoRa transceiver dongles (e.g. ESP32 / Meshtastic hardware bridges) via USB-OTG or BLE to extend relay range from ~50 meters to over 15 kilometers without line-of-sight.
2. **iOS BLE Multi-Platform Support**: Implementing iOS CoreBluetooth central/peripheral background mesh integration.
3. **Decentralized Nostr Relays**: Expanding multi-network failover so edge phones broadcast emergency events directly over Nostr relays when centralized gateways are blocked or experiencing DDoS.
4. **Satellite Direct-to-Device (D2D)**: Integration hooks for 3GPP Rel-17 NTN satellite messaging standards as direct-to-cell satellite constellations deploy commercially.

---

### License & Authors
- **Project**: MeshRoute Emergency Network System
- **License**: MIT
- **Authors**: MeshRoute Team
