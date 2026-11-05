package com.nautica.gps.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nautica.gps.model.TrackPoint
import com.nautica.gps.ui.theme.*

@Composable
fun SpeedHistoryChart(
    track: List<TrackPoint>,
    modifier: Modifier = Modifier
) {
    val speedHistory = track.takeLast(40).map { it.speedKnots }
    val maxSpeed = (speedHistory.maxOrNull() ?: 10.0).coerceAtLeast(5.0)

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(PureBlack, RoundedCornerShape(10.dp))
            .border(1.dp, Zinc800, RoundedCornerShape(10.dp))
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Profilo Velocità Recente",
                color = PureWhite,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                String.format("Max %.1f kts", maxSpeed),
                color = RaymarineYellow,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(75.dp)
        ) {
            val width = size.width
            val height = size.height

            // Grid lines
            drawLine(color = Zinc800, start = Offset(0f, 0f), end = Offset(width, 0f), strokeWidth = 1f)
            drawLine(color = Zinc800, start = Offset(0f, height / 2f), end = Offset(width, height / 2f), strokeWidth = 1f)
            drawLine(color = Zinc800, start = Offset(0f, height), end = Offset(width, height), strokeWidth = 1f)

            if (speedHistory.size >= 2) {
                val stepX = width / (speedHistory.size - 1)
                val path = Path()

                speedHistory.forEachIndexed { i, speed ->
                    val x = i * stepX
                    val y = height - ((speed / maxSpeed) * height).toFloat().coerceIn(0f, height)
                    if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
                }

                // Cyan speed trail
                drawPath(path = path, color = RaymarineCyan, style = Stroke(width = 2.5f))

                // Area under curve
                val fillPath = Path().apply {
                    addPath(path)
                    lineTo(width, height)
                    lineTo(0f, height)
                    close()
                }
                drawPath(path = fillPath, color = RaymarineCyan.copy(alpha = 0.15f))
            }
        }
    }
}
