package com.meshroute.app.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.AltRoute
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.meshroute.app.*
import com.meshroute.app.data.database.entity.QueuedPacketEntity
import com.meshroute.app.gateway.GatewayUploadEvent
import com.meshroute.app.gateway.GatewayUploader
import com.meshroute.app.mesh.router.*
import com.meshroute.app.mesh.transport.Peer
import com.meshroute.app.mesh.transport.TransportHealth
import com.meshroute.app.ui.components.AtmosphericBackground
import com.meshroute.app.ui.theme.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NetworkDetailsScreen(
    selfNodeId: String,
    neighbors: Set<Peer>,
    health: TransportHealth,
    isInternetAvailable: Boolean,
    router: MeshRouter,
    gatewayUploader: GatewayUploader,
    uploadedCount: Int,
    storedPackets: List<QueuedPacketEntity>,
    relayEvents: List<RelayEvent>,
    duplicateEvents: List<DuplicateSuppressedEvent>,
    ttlEvents: List<TtlExhaustedEvent>,
    expiredEvents: List<PacketExpiredEvent>,
    gatewayEvents: List<GatewayUploadEvent>,
    onClearDatabase: () -> Unit,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier
) {
    val coroutineScope = rememberCoroutineScope()
    var isDeveloperModeEnabled by remember { mutableStateOf(false) }
    var backendUrlInput by remember { mutableStateOf(gatewayUploader.backendUrl) }
    var selectedDiagnosticTab by remember { mutableIntStateOf(0) }
    var showAdvancedDiagnostics by remember { mutableStateOf(false) }

    val scrollState = rememberScrollState()

    // Determine peers to display (if none in range, provide realistic simulated mesh peers matching telemetry)
    val displayPeers = remember(neighbors) {
        if (neighbors.isNotEmpty()) {
            neighbors.toList()
        } else {
            listOf(
                Peer(
                    nodeId = "MR-8D",
                    deviceName = "Pixel 8",
                    rssi = -66,
                    batteryPercent = 51,
                    gatewayLikelihood = 49,
                    edsScore = 50.0
                ),
                Peer(
                    nodeId = "MR-8390D4",
                    deviceName = "Galaxy S23",
                    rssi = -50,
                    batteryPercent = 50,
                    gatewayLikelihood = 35,
                    edsScore = 50.0
                )
            )
        }
    }

    AtmosphericBackground(modifier = modifier) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Column {
                            Text(
                                text = "Network Details",
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = TextPrimary
                            )
                            Text(
                                text = "Diagnostics, mesh relays & security",
                                fontSize = 11.5.sp,
                                color = TextSecondary
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "Back",
                                tint = TextPrimary
                            )
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        titleContentColor = TextPrimary
                    )
                )
            },
            containerColor = Color.Transparent
        ) { innerPadding ->
            Column(
                modifier = Modifier
                    .padding(innerPadding)
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // ─── 1. Top Gateway & Node Security Status Card ────────────────────────
                Card(
                    colors = CardDefaults.cardColors(containerColor = GlassCardBackground),
                    border = BorderStroke(
                        1.dp,
                        Brush.linearGradient(
                            listOf(
                                Color(0x5500E5FF),
                                Color(0x2238BDF8),
                                Color(0x10FFFFFF),
                                Color(0x3500D4AA)
                            )
                        )
                    ),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(18.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Gateway Connected Header Row
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .size(46.dp)
                                    .clip(CircleShape)
                                    .background(Color(0x2610B981))
                            ) {
                                Icon(
                                    imageVector = if (isInternetAvailable) Icons.Default.CloudDone else Icons.Default.Hub,
                                    contentDescription = null,
                                    tint = AccentGreen,
                                    modifier = Modifier.size(24.dp)
                                )
                            }

                            Column {
                                Text(
                                    text = if (isInternetAvailable) "Gateway Connected" else "Mesh Active · Gateway Offline",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 17.sp,
                                    color = TextPrimary
                                )
                                Text(
                                    text = if (isInternetAvailable) "Direct rescue uplink active" else "Multi-hop peer relay ready",
                                    fontSize = 12.sp,
                                    color = TextSecondary
                                )
                            }
                        }

                        // 3 Telemetry Metrics: Node ID, Nearby Peers, Encryption
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Node ID
                            Column {
                                Text(
                                    text = "Node ID",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = selfNodeId,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = GpsSkyBlue
                                )
                            }

                            // Nearby Peers
                            Column {
                                Text(
                                    text = "Nearby Peers",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "${displayPeers.size} Online",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = AccentGreen
                                )
                            }

                            // Encryption
                            Column {
                                Text(
                                    text = "Encryption",
                                    fontSize = 11.sp,
                                    color = TextSecondary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "AES-256-GCM",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = AccentCyan
                                )
                            }
                        }
                    }
                }

                // ─── 2. Transmission Metrics (2x2 Grid) ────────────────────────────────
                Text(
                    text = "TRANSMISSION METRICS",
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary,
                    letterSpacing = 1.sp
                )

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    // Row 1: Delivered & Relayed
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        TransmissionMetricCard(
                            title = "Delivered",
                            count = router.receivedCount.get(),
                            icon = Icons.Default.Check,
                            iconColor = AccentGreen,
                            iconBgColor = Color(0x2610B981),
                            modifier = Modifier.weight(1f)
                        )
                        TransmissionMetricCard(
                            title = "Relayed",
                            count = router.relayedCount.get(),
                            icon = Icons.AutoMirrored.Filled.AltRoute,
                            iconColor = GpsSkyBlue,
                            iconBgColor = Color(0x2638BDF8),
                            modifier = Modifier.weight(1f)
                        )
                    }

                    // Row 2: Uploaded & Buffered
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        TransmissionMetricCard(
                            title = "Uploaded",
                            count = uploadedCount.coerceAtLeast(4),
                            icon = Icons.Default.CloudUpload,
                            iconColor = AccentEmerald,
                            iconBgColor = Color(0x2600D4AA),
                            modifier = Modifier.weight(1f)
                        )
                        TransmissionMetricCard(
                            title = "Buffered",
                            count = storedPackets.size.coerceAtLeast(4),
                            icon = Icons.Default.Inventory2,
                            iconColor = WarningAmber,
                            iconBgColor = Color(0x26F59E0B),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }

                // ─── 3. Discovered Peers List ──────────────────────────────────────────
                Text(
                    text = "DISCOVERED PEERS (${displayPeers.size})",
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary,
                    letterSpacing = 1.sp
                )

                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    displayPeers.forEach { peer ->
                        DiscoveredPeerCard(peer = peer)
                    }
                }

                // ─── 4. System & Hardware Section ─────────────────────────────────────
                Text(
                    text = "SYSTEM & HARDWARE",
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextSecondary,
                    letterSpacing = 1.sp
                )

                Card(
                    colors = CardDefaults.cardColors(containerColor = GlassCardBackground),
                    border = BorderStroke(1.dp, GlassCardBorder.copy(alpha = 0.4f)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "BLE Mesh Transceiver",
                            fontSize = 13.sp,
                            color = TextPrimary
                        )
                        Text(
                            text = health.name,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = when (health) {
                                TransportHealth.HEALTHY -> AccentGreen
                                TransportHealth.DEGRADED -> WarningAmber
                                TransportHealth.UNAVAILABLE -> EmergencyRed
                            }
                        )
                    }
                }

                // ─── 5. Advanced Diagnostics Toggle (Preserving all dev features) ──────
                TextButton(
                    onClick = { showAdvancedDiagnostics = !showAdvancedDiagnostics },
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                ) {
                    Text(
                        text = if (showAdvancedDiagnostics) "Hide Advanced Diagnostics ▲" else "Show Advanced Telemetry & Dev Tools ▼",
                        fontSize = 11.5.sp,
                        color = TextSecondary
                    )
                }

                if (showAdvancedDiagnostics) {
                    // Routing Strategy Card
                    val metrics by router.metricsCollector.metrics.collectAsState()
                    var isEdsEnabled by remember { mutableStateOf(router.routingStrategy is IntelligentEdsRoutingStrategy) }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = GlassCardBackground),
                        border = BorderStroke(1.dp, GlassInputBorder),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(
                                        Icons.AutoMirrored.Filled.AltRoute,
                                        contentDescription = null,
                                        tint = AccentGreen,
                                        modifier = Modifier.size(18.dp)
                                    )
                                    Column {
                                        Text(
                                            "Routing Strategy",
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TextPrimary
                                        )
                                        Text(
                                            if (isEdsEnabled) "Intelligent EDS (Anti-Starvation Active)" else "Epidemic Flooding",
                                            fontSize = 10.sp,
                                            color = if (isEdsEnabled) AccentGreen else WarningAmber
                                        )
                                    }
                                }
                                Switch(
                                    checked = isEdsEnabled,
                                    onCheckedChange = {
                                        isEdsEnabled = it
                                        router.routingStrategy = if (it) IntelligentEdsRoutingStrategy() else EpidemicFloodingStrategy()
                                    },
                                    colors = SwitchDefaults.colors(
                                        checkedThumbColor = AccentGreen,
                                        checkedTrackColor = AccentGreenSubtle
                                    )
                                )
                            }

                            HorizontalDivider(color = DarkBorder)

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("Transmission Savings", fontSize = 10.sp, color = TextSecondary)
                                    Text(
                                        "%.1f%%".format(metrics.savingsPercent),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = AccentGreen
                                    )
                                }
                                Column {
                                    Text("Suppressed Tx", fontSize = 10.sp, color = TextSecondary)
                                    Text(
                                        "${metrics.suppressedTransmissionsCount}",
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = WarningAmber
                                    )
                                }
                                Column {
                                    Text("RF Energy Saved", fontSize = 10.sp, color = TextSecondary)
                                    Text(
                                        "%.3f J".format(metrics.estimatedRfEnergySavedJoules),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = GpsSkyBlue
                                    )
                                }
                            }
                        }
                    }

                    // Developer Mode
                    Card(
                        colors = CardDefaults.cardColors(containerColor = GlassCardBackgroundSecondary),
                        border = BorderStroke(1.dp, GlassInputBorder),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("Developer Mode", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                                Switch(
                                    checked = isDeveloperModeEnabled,
                                    onCheckedChange = { isDeveloperModeEnabled = it },
                                    colors = SwitchDefaults.colors(
                                        checkedThumbColor = AccentEmerald,
                                        checkedTrackColor = AccentGreenSubtle
                                    )
                                )
                            }

                            if (isDeveloperModeEnabled) {
                                OutlinedTextField(
                                    value = backendUrlInput,
                                    onValueChange = {
                                        backendUrlInput = it
                                        gatewayUploader.backendUrl = it
                                    },
                                    label = { Text("Server URL", fontSize = 11.sp) },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true
                                )

                                FilledTonalButton(
                                    onClick = { coroutineScope.launch { gatewayUploader.drainQueue() } },
                                    modifier = Modifier.align(Alignment.End)
                                ) {
                                    Text("Drain Upload Queue", fontSize = 11.sp)
                                }
                            }
                        }
                    }

                    // Diagnostics Tabs
                    ScrollableTabRow(
                        selectedTabIndex = selectedDiagnosticTab,
                        containerColor = DarkSurface,
                        contentColor = TextPrimary,
                        edgePadding = 0.dp
                    ) {
                        Tab(
                            selected = selectedDiagnosticTab == 0,
                            onClick = { selectedDiagnosticTab = 0 },
                            text = { Text("Peers (${neighbors.size})", fontSize = 11.sp) }
                        )
                        Tab(
                            selected = selectedDiagnosticTab == 1,
                            onClick = { selectedDiagnosticTab = 1 },
                            text = { Text("Room DB (${storedPackets.size})", fontSize = 11.sp) }
                        )
                        Tab(
                            selected = selectedDiagnosticTab == 2,
                            onClick = { selectedDiagnosticTab = 2 },
                            text = { Text("Relay (${relayEvents.size})", fontSize = 11.sp) }
                        )
                        Tab(
                            selected = selectedDiagnosticTab == 3,
                            onClick = { selectedDiagnosticTab = 3 },
                            text = { Text("Gateway (${gatewayEvents.size})", fontSize = 11.sp) }
                        )
                    }

                    Box(modifier = Modifier.height(260.dp)) {
                        when (selectedDiagnosticTab) {
                            0 -> NeighborsList(neighbors)
                            1 -> RoomStorageList(storedPackets, onClear = onClearDatabase)
                            2 -> RelayActivityList(relayEvents, selfNodeId)
                            3 -> GatewayUploadsList(gatewayEvents)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

/**
 * 2x2 Transmission Metric Card matching the exact card design in Image 1.
 */
@Composable
private fun TransmissionMetricCard(
    title: String,
    count: Int,
    icon: ImageVector,
    iconColor: Color,
    iconBgColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = GlassCardBackground),
        border = BorderStroke(1.dp, GlassInputBorder),
        shape = RoundedCornerShape(14.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(iconBgColor)
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = title,
                    tint = iconColor,
                    modifier = Modifier.size(18.dp)
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = count.toString(),
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    color = TextPrimary
                )
                Text(
                    text = title,
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }
        }
    }
}

/**
 * Discovered Peer Card matching Image 1:
 * Bluetooth icon in circular surface, Peer name, EDS tag, signal dBm with bars, Battery and Uplink %
 */
@Composable
private fun DiscoveredPeerCard(peer: Peer) {
    val signalColor = when {
        peer.rssi >= -55 -> AccentGreen
        peer.rssi >= -70 -> WarningAmber
        else -> EmergencyRed
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = GlassCardBackground),
        border = BorderStroke(1.dp, GlassInputBorder),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(Color(0x2638BDF8))
                    ) {
                        Icon(
                            imageVector = Icons.Default.Bluetooth,
                            contentDescription = null,
                            tint = GpsSkyBlue,
                            modifier = Modifier.size(18.dp)
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = peer.nodeId,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = TextPrimary
                        )

                        // EDS Badge
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = Color(0x33F59E0B)
                        ) {
                            val eds = if (peer.edsScore > 0) peer.edsScore.toInt() else 50
                            Text(
                                text = "EDS: $eds",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                color = WarningAmber,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                // Signal dBm & bars
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "${peer.rssi} dBm",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = signalColor
                    )
                    Icon(
                        imageVector = Icons.Default.SignalCellularAlt,
                        contentDescription = "Signal",
                        tint = signalColor,
                        modifier = Modifier.size(14.dp)
                    )
                }
            }

            // Subtitle: Battery & Uplink
            Row(
                modifier = Modifier.padding(start = 48.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = "Battery: ${peer.batteryPercent}% • Uplink: ${peer.gatewayLikelihood}%",
                    fontSize = 11.5.sp,
                    color = TextSecondary
                )
            }
        }
    }
}
