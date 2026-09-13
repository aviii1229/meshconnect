package com.meshroute.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.meshroute.app.R
import com.meshroute.app.ui.theme.AccentCyan
import com.meshroute.app.ui.theme.AccentEmerald

/**
 * Atmospheric background using the exact mountain wallpaper image with an illuminated
 * twilight radial glow to make the home screen brighter, vibrant, and stunning for glassmorphism.
 */
@Composable
fun AtmosphericBackground(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Box(modifier = modifier.fillMaxSize()) {
        // 1. Base Mountain Wallpaper Image
        Image(
            painter = painterResource(id = R.drawable.mountain_bg),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        // 2. Luminous Brightening Gradient & Ambient Aurora Layer
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    brush = Brush.verticalGradient(
                        colors = listOf(
                            Color(0x3500E5FF), // Brighter upper cyan ambient tint
                            Color(0x200D2D4D), // Mid atmospheric glow
                            Color(0x10081C30), // Soft depth
                            Color(0x28051220), // Subtle bottom grounding
                            Color(0x40020A14)
                        )
                    )
                )
        )

        // 3. Radial ambient backlight behind the glass cards
        Canvas(modifier = Modifier.fillMaxSize()) {
            val width = size.width
            val height = size.height

            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        Color(0x4D00E5FF),
                        Color(0x2800D4AA),
                        Color(0x1038BDF8),
                        Color.Transparent
                    ),
                    center = Offset(width * 0.5f, height * 0.28f),
                    radius = width * 0.85f
                ),
                radius = width * 0.85f,
                center = Offset(width * 0.5f, height * 0.28f)
            )
        }

        // 4. Foreground Content (Glassmorphism UI)
        content()
    }
}

/**
 * Neon Mesh radar brand emblem matching the circular badge on the top left of the uploaded home screen.
 */
@Composable
fun MeshRouteBrandIcon(
    modifier: Modifier = Modifier,
    size: Dp = 38.dp
) {
    val infiniteTransition = rememberInfiniteTransition(label = "RadarPulse")
    val pulseAlpha by infiniteTransition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1800, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "PulseAlpha"
    )

    Canvas(modifier = modifier.size(size)) {
        val center = Offset(this.size.width / 2f, this.size.height / 2f)
        val radius = this.size.width / 2f

        // Outer glow
        drawCircle(
            color = AccentCyan.copy(alpha = 0.2f * pulseAlpha),
            radius = radius,
            center = center
        )

        // Outer ring
        drawCircle(
            color = AccentEmerald.copy(alpha = 0.85f),
            radius = radius - 2.dp.toPx(),
            center = center,
            style = Stroke(width = 1.8.dp.toPx())
        )

        // Middle ring
        drawCircle(
            color = AccentCyan.copy(alpha = 0.65f),
            radius = radius * 0.65f,
            center = center,
            style = Stroke(width = 1.4.dp.toPx())
        )

        // Inner solid core
        drawCircle(
            color = AccentCyan,
            radius = 3.5.dp.toPx(),
            center = center
        )

        // Satellite nodes
        val angleOffsets = listOf(0.0, Math.PI * 0.5, Math.PI, Math.PI * 1.5)
        val satRadius = radius * 0.65f
        for (angle in angleOffsets) {
            val satX = center.x + (satRadius * Math.cos(angle)).toFloat()
            val satY = center.y + (satRadius * Math.sin(angle)).toFloat()
            drawCircle(
                color = AccentEmerald,
                radius = 2.dp.toPx(),
                center = Offset(satX, satY)
            )
        }
    }
}
