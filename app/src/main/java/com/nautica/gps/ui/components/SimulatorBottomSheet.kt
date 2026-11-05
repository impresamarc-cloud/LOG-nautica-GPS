package com.nautica.gps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nautica.gps.ui.theme.*

@Composable
fun SimulatorBottomSheet(
    isSimulatorActive: Boolean,
    simSpeedKnots: Double,
    simHeadingDeg: Float,
    onToggleSimulator: () -> Unit,
    onSpeedChange: (Double) -> Unit,
    onHeadingChange: (Float) -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Zinc950, RoundedCornerShape(12.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Simulatore di Bordo",
                color = PureWhite,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
            Switch(
                checked = isSimulatorActive,
                onCheckedChange = { onToggleSimulator() },
                colors = SwitchDefaults.colors(checkedThumbColor = RaymarineYellow, checkedTrackColor = Zinc800)
            )
        }

        if (isSimulatorActive) {
            // Speed Throttle
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Manetta Motore", color = Zinc400, fontSize = 12.sp)
                    Text(
                        String.format("%.1f nodi", simSpeedKnots),
                        color = RaymarineYellow,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
                Slider(
                    value = simSpeedKnots.toFloat(),
                    onValueChange = { onSpeedChange(it.toDouble()) },
                    valueRange = 0f..35f,
                    colors = SliderDefaults.colors(thumbColor = RaymarineYellow, activeTrackColor = RaymarineYellow)
                )
            }

            // Heading Control
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text("Rotta Timone", color = Zinc400, fontSize = 12.sp)
                    Text(
                        String.format("%03d°", simHeadingDeg.toInt()),
                        color = RaymarineCyan,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        fontWeight = FontWeight.Bold
                    )
                }
                Slider(
                    value = simHeadingDeg,
                    onValueChange = { onHeadingChange(it) },
                    valueRange = 0f..359f,
                    colors = SliderDefaults.colors(thumbColor = RaymarineCyan, activeTrackColor = RaymarineCyan)
                )
            }
        }
    }
}
