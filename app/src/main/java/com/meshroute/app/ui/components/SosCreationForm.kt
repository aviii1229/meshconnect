package com.meshroute.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.meshroute.app.mesh.transport.LocationData
import com.meshroute.app.ui.theme.*

@Composable
fun SosCreationForm(
    messageText: String,
    onMessageChange: (String) -> Unit,
    senderName: String,
    onSenderNameChange: (String) -> Unit,
    medicalNotes: String,
    onMedicalNotesChange: (String) -> Unit,
    selectedReachHops: Int,
    onReachHopsChange: (Int) -> Unit,
    currentLocation: LocationData?,
    isFetchingLocation: Boolean,
    onRefreshLocation: () -> Unit,
    onSendSos: () -> Unit,
    isBroadcasting: Boolean = false,
    modifier: Modifier = Modifier
) {
    // Beacon Pulse Animation
    val infiniteTransition = rememberInfiniteTransition(label = "SosBeacon")
    val beaconPulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "BeaconScale"
    )
    val beaconPulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 0.85f,
        animationSpec = infiniteRepeatable(
            animation = tween(1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "BeaconAlpha"
    )

    // Main Glassmorphic Container
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
        shape = RoundedCornerShape(22.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(15.dp)
        ) {
            // ─── Header: Beacon Icon + "Emergency SOS" + Subtitle ──────────────────
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                // Pulsing Emergency Beacon
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.size(48.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .scale(beaconPulseScale)
                            .clip(CircleShape)
                            .background(EmergencyRed.copy(alpha = 0.22f * beaconPulseAlpha))
                    )
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(38.dp)
                            .clip(CircleShape)
                            .background(EmergencyRed)
                    ) {
                        Icon(
                            imageVector = Icons.Default.NotificationsActive,
                            contentDescription = "Emergency Alert",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                Column {
                    Text(
                        text = "Emergency SOS",
                        fontWeight = FontWeight.Bold,
                        fontSize = 21.sp,
                        color = TextPrimary
                    )
                    Text(
                        text = "Broadcast an encrypted emergency message",
                        fontSize = 11.5.sp,
                        color = TextSecondary
                    )
                }
            }

            // ─── Message Section ──────────────────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Chat,
                        contentDescription = null,
                        tint = GpsSkyBlue,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = "Message",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = GpsSkyBlue
                    )
                }

                // Glassmorphic Multiline Input Box
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(GlassInputBackground)
                        .border(BorderStroke(1.dp, GlassInputBorder), RoundedCornerShape(12.dp))
                        .padding(horizontal = 14.dp, vertical = 12.dp)
                ) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        BasicTextField(
                            value = messageText,
                            onValueChange = {
                                if (it.length <= 200) onMessageChange(it)
                            },
                            textStyle = TextStyle(
                                color = TextPrimary,
                                fontSize = 13.5.sp,
                                lineHeight = 20.sp,
                                fontWeight = FontWeight.Normal
                            ),
                            cursorBrush = SolidColor(AccentCyan),
                            minLines = 3,
                            maxLines = 5,
                            modifier = Modifier.fillMaxWidth(),
                            decorationBox = { innerTextField ->
                                if (messageText.isEmpty()) {
                                    Text(
                                        text = "Describe what happened and what help you need...",
                                        color = TextMuted,
                                        fontSize = 13.5.sp
                                    )
                                }
                                innerTextField()
                            }
                        )

                        Text(
                            text = "${messageText.length}/200",
                            fontSize = 11.sp,
                            color = TextMuted,
                            modifier = Modifier.align(Alignment.End)
                        )
                    }
                }
            }

            // ─── Sender Name & Medical / Notes Row (2 Columns) ─────────────────────
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                // Sender Name
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            tint = GpsSkyBlue,
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = "Sender Name",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = GpsSkyBlue
                        )
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(GlassInputBackground)
                            .border(BorderStroke(1.dp, GlassInputBorder), RoundedCornerShape(10.dp))
                            .padding(horizontal = 12.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        BasicTextField(
                            value = senderName,
                            onValueChange = onSenderNameChange,
                            singleLine = true,
                            textStyle = TextStyle(
                                color = TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            ),
                            cursorBrush = SolidColor(AccentCyan),
                            modifier = Modifier.fillMaxWidth(),
                            decorationBox = { innerTextField ->
                                if (senderName.isEmpty()) {
                                    Text("Your name", color = TextMuted, fontSize = 13.sp)
                                }
                                innerTextField()
                            }
                        )
                    }
                }

                // Medical / Notes
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.AddBox,
                            contentDescription = null,
                            tint = GpsSkyBlue,
                            modifier = Modifier.size(13.dp)
                        )
                        Text(
                            text = "Medical / Notes",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = GpsSkyBlue
                        )
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(GlassInputBackground)
                            .border(BorderStroke(1.dp, GlassInputBorder), RoundedCornerShape(10.dp))
                            .padding(horizontal = 12.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        BasicTextField(
                            value = medicalNotes,
                            onValueChange = onMedicalNotesChange,
                            singleLine = true,
                            textStyle = TextStyle(
                                color = TextPrimary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Medium
                            ),
                            cursorBrush = SolidColor(AccentCyan),
                            modifier = Modifier.fillMaxWidth(),
                            decorationBox = { innerTextField ->
                                if (medicalNotes.isEmpty()) {
                                    Text("Sprained ankle...", color = TextMuted, fontSize = 13.sp)
                                }
                                innerTextField()
                            }
                        )
                    }
                }
            }

            // ─── Location Section ─────────────────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(5.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = GpsSkyBlue,
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        text = "Location",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = GpsSkyBlue
                    )
                }

                // Glassmorphic Location Box
                Surface(
                    color = GlassInputBackground,
                    shape = RoundedCornerShape(12.dp),
                    border = BorderStroke(1.dp, GlassInputBorder),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .padding(horizontal = 14.dp, vertical = 10.dp)
                            .fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(7.dp)
                                        .clip(CircleShape)
                                        .background(if (currentLocation != null) AccentGreen else WarningAmber)
                                )
                                Text(
                                    text = if (currentLocation != null) "Location ready" else "Acquiring GPS location",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (currentLocation != null) AccentGreen else WarningAmber
                                )
                            }

                            val locationStr = if (currentLocation != null) {
                                "%.4f, %.4f  (Accuracy ±%.0fm)".format(
                                    currentLocation.latitude,
                                    currentLocation.longitude,
                                    currentLocation.accuracy
                                )
                            } else {
                                "26.7303, 83.4387  (Accuracy ±1m)"
                            }

                            Text(
                                text = locationStr,
                                fontSize = 11.5.sp,
                                fontFamily = FontFamily.Monospace,
                                color = TextPrimary
                            )
                        }

                        Surface(
                            shape = CircleShape,
                            color = GlassInnerSurface,
                            border = BorderStroke(1.dp, GlassCardBorder.copy(alpha = 0.35f)),
                            modifier = Modifier.size(34.dp)
                        ) {
                            IconButton(
                                onClick = onRefreshLocation,
                                modifier = Modifier.fillMaxSize()
                            ) {
                                if (isFetchingLocation) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(16.dp),
                                        strokeWidth = 2.dp,
                                        color = GpsSkyBlue
                                    )
                                } else {
                                    Icon(
                                        imageVector = Icons.Default.MyLocation,
                                        contentDescription = "Refresh GPS",
                                        tint = GpsSkyBlue,
                                        modifier = Modifier.size(17.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ─── Relay Distance (Hops) Section ─────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Sensors,
                            contentDescription = null,
                            tint = TextSecondary,
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "relay distance",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextSecondary
                        )
                        Icon(
                            imageVector = Icons.Default.Info,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(12.dp)
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(3.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = AccentCyan,
                            modifier = Modifier.size(12.dp)
                        )
                        Text(
                            text = "Recommended",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = AccentCyan
                        )
                    }
                }

                // 4 Hop Selection Buttons
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    listOf(2, 4, 8, 12).forEach { hops ->
                        val isSelected = selectedReachHops == hops
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = if (isSelected) Color(0x2800E5FF) else GlassInputBackground,
                            border = BorderStroke(
                                if (isSelected) 1.5.dp else 1.dp,
                                if (isSelected) AccentCyan else GlassInputBorder
                            ),
                            modifier = Modifier
                                .weight(1f)
                                .height(38.dp)
                                .clickable { onReachHopsChange(hops) }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .padding(horizontal = 2.dp),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "$hops Hops",
                                    fontSize = 11.sp,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (isSelected) AccentCyan else TextSecondary,
                                    textAlign = TextAlign.Center,
                                    maxLines = 1
                                )
                                if (isSelected) {
                                    Spacer(modifier = Modifier.width(3.dp))
                                    Icon(
                                        imageVector = Icons.Default.Check,
                                        contentDescription = null,
                                        tint = AccentCyan,
                                        modifier = Modifier.size(12.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(2.dp))

            // ─── Primary SEND SOS Button (Vibrant Coral/Red Gradient Pill) ────────
            Surface(
                onClick = onSendSos,
                enabled = !isBroadcasting,
                shape = RoundedCornerShape(16.dp),
                color = Color.Transparent,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            brush = Brush.horizontalGradient(
                                colors = listOf(
                                    SosButtonGradientStart,
                                    Color(0xFFFF4838),
                                    SosButtonGradientEnd
                                )
                            )
                        )
                        .padding(horizontal = 16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    if (isBroadcasting) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = Color.White
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            Text(
                                text = "BROADCASTING EMERGENCY...",
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.5.sp,
                                color = Color.White
                            )
                        }
                    } else {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.Send,
                                contentDescription = "Send SOS",
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )

                            Column(
                                horizontalAlignment = Alignment.Start,
                                modifier = Modifier
                                    .weight(1f)
                                    .padding(horizontal = 12.dp)
                            ) {
                                Text(
                                    text = "SEND SOS",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 15.sp,
                                    letterSpacing = 0.8.sp,
                                    color = Color.White
                                )
                                Text(
                                    text = "Broadcast encrypted emergency message",
                                    fontSize = 9.5.sp,
                                    color = Color.White.copy(alpha = 0.88f)
                                )
                            }

                            Icon(
                                imageVector = Icons.Default.ChevronRight,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}
