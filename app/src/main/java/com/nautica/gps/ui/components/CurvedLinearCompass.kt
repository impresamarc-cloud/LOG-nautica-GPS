package com.nautica.gps.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nautica.gps.ui.theme.*
import com.nautica.gps.utils.NauticalMath
import kotlin.math.roundToInt

@Composable
fun CurvedLinearCompass(
    headingDeg: Float?,
    targetBearingDeg: Float?,
    modifier: Modifier = Modifier
) {
    val effectiveHeading = headingDeg ?: 0f

    // Animated steering correction arrows pulse
    val infiniteTransition = rememberInfiniteTransition(label = "HelmArrowPulse")
    val arrowAlpha by infiniteTransition.animateFloat(
        initialValue = 0.35f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(650, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "ArrowAlpha"
    )

    // Heading delta to target bearing (-180..+180)
    val deltaDeg = targetBearingDeg?.let {
        var diff = (it - effectiveHeading) % 360f
        if (diff > 180f) diff -= 360f
        if (diff < -180f) diff += 360f
        diff
    }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(115.dp)
            .background(PureBlack),
        contentAlignment = Alignment.TopCenter
    ) {
        // Digital 3-Digit Heading at Top
        Row(
            modifier = Modifier
                .padding(top = 4.dp)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Port Steering Arrow (<<<) if need to steer Left
            if (deltaDeg != null && deltaDeg < -2.0f) {
                Text(
                    text = "<<<",
                    color = RaymarineOrange.copy(alpha = arrowAlpha),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.padding(end = 12.dp)
                )
            }

            Text(
                text = NauticalMath.formatHeading3Digits(headingDeg) + "°",
                color = PureWhite,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 2.sp
            )

            // Starboard Steering Arrow (>>>) if need to steer Right
            if (deltaDeg != null && deltaDeg > 2.0f) {
                Text(
                    text = ">>>",
                    color = RaymarineOrange.copy(alpha = arrowAlpha),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Black,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier.padding(start = 12.dp)
                )
            }
        }

        // Hardware-Accelerated Curved 60° Linear Graduation Tape
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(80.dp)
                .align(Alignment.BottomCenter)
        ) {
            val width = size.width
            val height = size.height
            val centerX = width / 2f

            // Upper curved arch line (convex arc across 60° tape)
            val archPath = Path().apply {
                moveTo(0f, 22f)
                quadraticTo(centerX, 2f, width, 22f)
            }
            drawPath(
                path = archPath,
                color = Zinc700,
                style = Stroke(width = 1.5f)
            )

            // 60-degree scale: 1 degree = (width / 60) pixels
            val pxPerDeg = width / 60f
            val minVisibleDeg = (effectiveHeading - 30f).toInt()
            val maxVisibleDeg = (effectiveHeading + 30f).toInt()

            val textPaint = android.graphics.Paint().apply {
                color = android.graphics.Color.WHITE
                textSize = 28f
                textAlign = android.graphics.Paint.Align.CENTER
                isAntiAlias = true
                typeface = android.graphics.Typeface.MONOSPACE
            }

            val cardinalPaint = android.graphics.Paint().apply {
                color = android.graphics.Color.parseColor("#FACC15") // Raymarine Yellow
                textSize = 34f
                textAlign = android.graphics.Paint.Align.CENTER
                isAntiAlias = true
                isFakeBoldText = true
                typeface = android.graphics.Typeface.DEFAULT_BOLD
            }

            for (deg in minVisibleDeg..maxVisibleDeg) {
                val offsetDeg = deg - effectiveHeading
                val x = centerX + (offsetDeg * pxPerDeg)
                if (x < -10f || x > width + 10f) continue

                // Calculate baseline y following the arch
                val normX = (x - centerX) / (width / 2f)
                val archY = 2f + (normX * normX * 20f)

                val normalizedDeg = ((deg % 360) + 360) % 360

                when {
                    normalizedDeg % 10 == 0 -> {
                        // Major 10° tick
                        drawLine(
                            color = PureWhite,
                            start = Offset(x, archY),
                            end = Offset(x, archY + 22f),
                            strokeWidth = 2.2f
                        )

                        // Cardinal or Numeric label
                        val label = when (normalizedDeg) {
                            0 -> "N"
                            90 -> "E"
                            180 -> "S"
                            270 -> "W"
                            else -> String.format("%03d", normalizedDeg)
                        }

                        if (normalizedDeg % 90 == 0) {
                            drawContext.canvas.nativeCanvas.drawText(label, x, archY + 48f, cardinalPaint)
                        } else {
                            drawContext.canvas.nativeCanvas.drawText(label, x, archY + 44f, textPaint)
                        }
                    }
                    normalizedDeg % 5 == 0 -> {
                        // Medium 5° tick
                        drawLine(
                            color = Zinc400,
                            start = Offset(x, archY),
                            end = Offset(x, archY + 14f),
                            strokeWidth = 1.4f
                        )
                    }
                    else -> {
                        // Minor 1° tick
                        drawLine(
                            color = Zinc700,
                            start = Offset(x, archY),
                            end = Offset(x, archY + 8f),
                            strokeWidth = 1.0f
                        )
                    }
                }
            }

            // Gliding Yellow Diamond for Waypoint Target Bearing
            if (targetBearingDeg != null) {
                var wpDiff = (targetBearingDeg - effectiveHeading) % 360f
                if (wpDiff > 180f) wpDiff -= 360f
                if (wpDiff < -180f) wpDiff += 360f

                val clampedDiff = wpDiff.coerceIn(-28f, 28f)
                val wpX = centerX + (clampedDiff * pxPerDeg)
                val normX = (wpX - centerX) / (width / 2f)
                val wpArchY = 2f + (normX * normX * 20f)

                // Diamond icon
                val diamondPath = Path().apply {
                    moveTo(wpX, wpArchY - 2f)
                    lineTo(wpX + 8f, wpArchY + 10f)
                    lineTo(wpX, wpArchY + 22f)
                    lineTo(wpX - 8f, wpArchY + 10f)
                    close()
                }
                drawPath(path = diamondPath, color = RaymarineYellow)
                drawPath(path = diamondPath, color = PureBlack, style = Stroke(width = 1.5f))
            }

            // Center Lubber Line (orange vertical indicator at dead center)
            drawLine(
                color = RaymarineOrange,
                start = Offset(centerX, 2f),
                end = Offset(centerX, 32f),
                strokeWidth = 3.5f
            )
        }
    }
}
