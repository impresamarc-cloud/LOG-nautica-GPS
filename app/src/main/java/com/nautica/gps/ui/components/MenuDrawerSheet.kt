package com.nautica.gps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CompassCalibration
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nautica.gps.model.TrackPoint
import com.nautica.gps.model.WaveFilterLevel
import com.nautica.gps.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MenuDrawerSheet(
    isOpen: Boolean,
    onClose: () -> Unit,
    waveFilter: WaveFilterLevel,
    onChangeWaveFilter: (WaveFilterLevel) -> Unit,
    useMagneticWhenStopped: Boolean,
    onToggleMagnetic: () -> Unit,
    onResetTrip: () -> Unit,
    track: List<TrackPoint>,
    isSimulatorActive: Boolean,
    simSpeedKnots: Double,
    simHeadingDeg: Float,
    onToggleSimulator: () -> Unit,
    onSimSpeedChange: (Double) -> Unit,
    onSimHeadingChange: (Float) -> Unit
) {
    if (!isOpen) return

    ModalBottomSheet(
        onDismissRequest = onClose,
        containerColor = Zinc950,
        dragHandle = { BottomSheetDefaults.DragHandle(color = Zinc700) }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    "Impostazioni di Bordo",
                    color = PureWhite,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                IconButton(onClick = onClose) {
                    Icon(Icons.Default.Close, contentDescription = "Chiudi", tint = Zinc400)
                }
            }

            HorizontalDivider(color = Zinc800)

            // Wave Filter Selector (Filtro Ondoso EMA)
            Text("FILTRO SMORZAMENTO ONDE", color = Zinc400, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                WaveFilterLevel.values().forEach { level ->
                    val isSelected = level == waveFilter
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .background(if (isSelected) RaymarineYellow.copy(alpha = 0.2f) else PureBlack, RoundedCornerShape(8.dp))
                            .border(1.dp, if (isSelected) RaymarineYellow else Zinc800, RoundedCornerShape(8.dp))
                            .clickable { onChangeWaveFilter(level) }
                            .padding(vertical = 8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = when (level) {
                                WaveFilterLevel.OFF -> "OFF"
                                WaveFilterLevel.LOW -> "BASSO"
                                WaveFilterLevel.MED -> "MEDIO"
                                WaveFilterLevel.HIGH -> "ALTO"
                            },
                            color = if (isSelected) RaymarineYellow else Zinc400,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

            // Magnetic Compass fallback toggle
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(PureBlack, RoundedCornerShape(10.dp))
                    .border(1.dp, Zinc800, RoundedCornerShape(10.dp))
                    .padding(12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.CompassCalibration, contentDescription = null, tint = RaymarineCyan)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("Bussola Magnetica a Barca Ferma", color = PureWhite, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Text("Usa sensore giroscopio/magnetico < 0.5 kn", color = Zinc400, fontSize = 11.sp)
                    }
                }
                Switch(
                    checked = useMagneticWhenStopped,
                    onCheckedChange = { onToggleMagnetic() },
                    colors = SwitchDefaults.colors(checkedThumbColor = RaymarineCyan, checkedTrackColor = Zinc800)
                )
            }

            // Trip Reset Button
            Button(
                onClick = onResetTrip,
                modifier = Modifier.fillMaxWidth().height(44.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Zinc900),
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Zinc700)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, tint = RaymarineOrange)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Azzera Dati di Navigazione (Trip Reset)", color = PureWhite, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }

            // Speed History Profile Chart
            SpeedHistoryChart(track = track)

            // Simulator Panel
            SimulatorBottomSheet(
                isSimulatorActive = isSimulatorActive,
                simSpeedKnots = simSpeedKnots,
                simHeadingDeg = simHeadingDeg,
                onToggleSimulator = onToggleSimulator,
                onSpeedChange = onSimSpeedChange,
                onHeadingChange = onSimHeadingChange
            )

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
