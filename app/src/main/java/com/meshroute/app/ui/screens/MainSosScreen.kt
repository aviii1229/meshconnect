package com.meshroute.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.meshroute.app.mesh.transport.LocationData
import com.meshroute.app.mesh.transport.SosPacket
import com.meshroute.app.mesh.transport.TransportHealth
import com.meshroute.app.ui.components.*
import com.meshroute.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainSosScreen(
    selfNodeId: String,
    isInternetAvailable: Boolean,
    peerCount: Int,
    transportHealth: TransportHealth,
    currentLocation: LocationData?,
    isFetchingLocation: Boolean,
    sosMessageText: String,
    onMessageChange: (String) -> Unit,
    senderName: String,
    onSenderNameChange: (String) -> Unit,
    medicalNotes: String,
    onMedicalNotesChange: (String) -> Unit,
    selectedReachHops: Int,
    onReachHopsChange: (Int) -> Unit,
    onRefreshLocation: () -> Unit,
    onSendSos: () -> Unit,
    isBroadcasting: Boolean,
    receivedPackets: List<SosPacket>,
    packetStatuses: Map<String, String> = emptyMap(),
    uploadedCount: Int,
    onNavigateToNetworkDetails: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()
    var isTransmissionsExpanded by remember { mutableStateOf(false) }

    AtmosphericBackground(modifier = modifier) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
        ) {
            // ─── Custom Modern Top Bar (Buffer-safe for all screen widths) ─────────
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 14.dp, end = 12.dp, top = 6.dp, bottom = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Left: Brand Icon + Title + Node ID
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MeshRouteBrandIcon(size = 32.dp)
                    Column {
                        Text(
                            text = "MeshRoute",
                            fontWeight = FontWeight.Black,
                            fontSize = 17.sp,
                            maxLines = 1,
                            softWrap = false,
                            color = TextPrimary
                        )
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(5.dp)
                                    .clip(CircleShape)
                                    .background(AccentGreen)
                            )
                            Text(
                                text = selfNodeId,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Medium,
                                fontSize = 11.sp,
                                maxLines = 1,
                                softWrap = false,
                                color = TextSecondary
                            )
                        }
                    }
                }

                // Right: Status Chip + Perfect Circular Info Button
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    NetworkStatusBadge(
                        isInternetAvailable = isInternetAvailable,
                        peerCount = peerCount,
                        transportHealth = transportHealth,
                        showSubtitle = false
                    )

                    // Perfect 1:1 circular info button matching user reference
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .clickable(onClick = onNavigateToNetworkDetails)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Info,
                            contentDescription = "Network Details",
                            tint = TextSecondary,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }
            }

            // ─── Scrollable Main Content ───────────────────────────────────────────
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // ─── 1. Primary SOS Creation Form (Glassmorphic Container) ──────────
                SosCreationForm(
                    messageText = sosMessageText,
                    onMessageChange = onMessageChange,
                    senderName = senderName,
                    onSenderNameChange = onSenderNameChange,
                    medicalNotes = medicalNotes,
                    onMedicalNotesChange = onMedicalNotesChange,
                    selectedReachHops = selectedReachHops,
                    onReachHopsChange = onReachHopsChange,
                    currentLocation = currentLocation,
                    isFetchingLocation = isFetchingLocation,
                    onRefreshLocation = onRefreshLocation,
                    onSendSos = onSendSos,
                    isBroadcasting = isBroadcasting
                )

                // ─── 2. Emergency Transmissions (Collapsible Technical Flow) ───────
                Surface(
                    onClick = { isTransmissionsExpanded = !isTransmissionsExpanded },
                    shape = RoundedCornerShape(14.dp),
                    color = GlassInnerSurface,
                    border = BorderStroke(1.dp, GlassCardBorder.copy(alpha = 0.35f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.weight(1f, fill = false)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Sensors,
                                contentDescription = null,
                                tint = if (receivedPackets.isNotEmpty()) AccentEmerald else TextSecondary,
                                modifier = Modifier.size(16.dp)
                            )
                            Column {
                                Text(
                                    text = "EMERGENCY TRANSMISSIONS",
                                    fontSize = 11.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary,
                                    letterSpacing = 0.8.sp,
                                    maxLines = 1
                                )
                                Text(
                                    text = if (receivedPackets.isNotEmpty()) {
                                        "${receivedPackets.size} active packet${if (receivedPackets.size > 1) "s" else ""} in mesh"
                                    } else {
                                        "Technical delivery pipeline (tap to inspect)"
                                    },
                                    fontSize = 10.sp,
                                    color = TextSecondary,
                                    maxLines = 1
                                )
                            }
                        }

                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = if (isTransmissionsExpanded) "Hide" else "Inspect",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = AccentCyan
                            )
                            Icon(
                                imageVector = if (isTransmissionsExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                contentDescription = if (isTransmissionsExpanded) "Collapse" else "Expand",
                                tint = AccentCyan,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }

                // Collapsed by default: technical delivery pipeline only visible on deliberate click
                AnimatedVisibility(
                    visible = isTransmissionsExpanded,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically()
                ) {
                    SosDeliveryFlowView(
                        packets = receivedPackets,
                        packetStatuses = packetStatuses,
                        isInternetAvailable = isInternetAvailable,
                        uploadedCount = uploadedCount,
                        selfNodeId = selfNodeId
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))
            }
        }
    }
}
