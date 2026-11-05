package com.nautica.gps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nautica.gps.model.GpsStatus
import com.nautica.gps.ui.theme.*
import com.nautica.gps.utils.NauticalMath
import kotlin.math.roundToInt

@Composable
fun RaymarineSpeedometer(
    speedKnots: Double,
    speedKmh: Double,
    maxSpeedKnots: Double,
    avgSpeedKnots: Double,
    tripDistanceNm: Double,
    tripDurationSec: Long,
    gpsStatus: GpsStatus,
    accuracyMeters: Float?,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(PureBlack)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Main Giant Speedometer Display
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.Bottom
        ) {
            Text(
                text = String.format("%04.1f", speedKnots),
                color = PureWhite,
                fontSize = 82.sp,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                lineHeight = 82.sp,
                letterSpacing = (-1.5).sp
            )
            Text(
                text = "KTS",
                color = RaymarineYellow,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.padding(bottom = 12.dp, start = 8.dp)
            )
        }

        // Sub-register in km/h + GPS Lock Status Indicator
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // km/h Sub-Register
            Text(
                text = String.format("%.1f km/h", speedKmh),
                color = Zinc400,
                fontSize = 14.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.SemiBold
            )

            // GPS Lock Status Indicator
            val (statusText, statusColor) = when (gpsStatus) {
                GpsStatus.ACTIVE -> Pair(
                    accuracyMeters?.let { "● GPS ±${(it + 0.5f).toInt()}m" } ?: "● GPS ATTIVO",
                    RaymarineGreen
                )
                GpsStatus.SEARCHING -> Pair("▲ RICERCA GPS...", RaymarineYellow)
                GpsStatus.DENIED -> Pair("✖ PERMESSO NEGATO", RaymarineRed)
                GpsStatus.UNAVAILABLE -> Pair("✖ SEGNALE ASSENTE", RaymarineRed)
            }
            Text(
                text = statusText,
                color = statusColor,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Trip Telemetry Card: Max, Avg, Distance, Duration
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Zinc950, RoundedCornerShape(10.dp))
                .border(1.dp, Zinc800, RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Max Speed
            Column(horizontalAlignment = Alignment.Start) {
                Text("MAX", color = Zinc400, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(
                    String.format("%.1f kt", maxSpeedKnots),
                    color = PureWhite,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            // Avg Speed
            Column(horizontalAlignment = Alignment.Start) {
                Text("MEDIA", color = Zinc400, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(
                    String.format("%.1f kt", avgSpeedKnots),
                    color = PureWhite,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            // Trip Distance
            Column(horizontalAlignment = Alignment.Start) {
                Text("DISTANZA", color = Zinc400, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(
                    String.format("%.2f NM", tripDistanceNm),
                    color = RaymarineCyan,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }

            // Duration
            Column(horizontalAlignment = Alignment.End) {
                Text("TEMPO", color = Zinc400, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text(
                    NauticalMath.formatDuration(tripDurationSec),
                    color = PureWhite,
                    fontSize = 13.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
