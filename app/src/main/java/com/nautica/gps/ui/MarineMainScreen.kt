package com.nautica.gps.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nautica.gps.model.MarineTelemetryState
import com.nautica.gps.model.SavedRoute
import com.nautica.gps.model.WaveFilterLevel
import com.nautica.gps.model.WaypointTarget
import com.nautica.gps.ui.components.*
import com.nautica.gps.ui.theme.PureBlack
import com.nautica.gps.ui.theme.Zinc950

@Composable
fun MarineMainScreen(
    state: MarineTelemetryState,
    savedRoutes: List<SavedRoute>,
    onAddWaypoint: (WaypointTarget) -> Unit,
    onUpdateWaypoint: (String, Double, Double) -> Unit,
    onDeleteWaypoint: (String) -> Unit,
    onSelectWaypoint: (String?) -> Unit,
    onClearRoute: () -> Unit,
    onSaveRoute: (String) -> Unit,
    onLoadRoute: (SavedRoute, Boolean) -> Unit,
    onDeleteSavedRoute: (String) -> Unit,
    onToggleAutoFollow: () -> Unit,
    onResetTrip: () -> Unit,
    onChangeWaveFilter: (WaveFilterLevel) -> Unit,
    onToggleMagnetic: () -> Unit,
    onToggleSimulator: () -> Unit,
    onSimSpeedChange: (Double) -> Unit,
    onSimHeadingChange: (Float) -> Unit,
    simSpeedKnots: Double = 0.0,
    simHeadingDeg: Float = 0f
) {
    var isMenuDrawerOpen by remember { mutableStateOf(false) }
    var isLayersOpen by remember { mutableStateOf(false) }
    var isSavedRoutesOpen by remember { mutableStateOf(false) }
    var isSaveDialogOpen by remember { mutableStateOf(false) }
    var routeNameInput by remember { mutableStateOf("") }

    val effectiveLat = state.latitude ?: 41.1865 // Default Mediterranean Arcipelago La Maddalena
    val effectiveLon = state.longitude ?: 9.4125

    Scaffold(
        containerColor = PureBlack
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
            ) {
                // 1. Top Curved Linear Compass (60° Window + Yellow Diamond + Steering Arrows)
                CurvedLinearCompass(
                    headingDeg = state.headingDeg,
                    targetBearingDeg = state.targetBearingDeg
                )

                // 2. Raymarine i50 Digital Speedometer + Trip Telemetry Register
                RaymarineSpeedometer(
                    speedKnots = state.speedKnots,
                    speedKmh = state.speedKmh,
                    maxSpeedKnots = state.maxSpeedKnots,
                    avgSpeedKnots = state.avgSpeedKnots,
                    tripDistanceNm = state.tripDistanceNm,
                    tripDurationSec = state.tripDurationSec,
                    gpsStatus = state.gpsStatus,
                    accuracyMeters = state.accuracyMeters
                )

                Spacer(modifier = Modifier.height(6.dp))

                // 3. Enlarged Nautical Chart Viewport (with OpenSeaMap, wake track, draggable waypoints)
                NauticalMapView(
                    boatLat = effectiveLat,
                    boatLon = effectiveLon,
                    boatHeading = state.headingDeg,
                    track = state.track,
                    routePoints = state.routePoints,
                    selectedWaypointId = state.selectedWaypointId,
                    isAutoFollow = state.isAutoFollow,
                    onAddWaypoint = onAddWaypoint,
                    onUpdateWaypoint = onUpdateWaypoint,
                    onDeleteWaypoint = onDeleteWaypoint,
                    onSelectWaypoint = onSelectWaypoint,
                    onToggleAutoFollow = onToggleAutoFollow,
                    onOpenLayers = { isLayersOpen = true },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(380.dp)
                        .padding(horizontal = 12.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                // 4. Active Route Telemetry & Controls Panel
                ActiveRoutePanel(
                    routePoints = state.routePoints,
                    selectedWaypointId = state.selectedWaypointId,
                    targetBearingDeg = state.targetBearingDeg,
                    nextLegDistanceNm = state.nextLegDistanceNm,
                    totalRouteDistanceNm = state.totalRouteDistanceNm,
                    speedKnots = state.speedKnots,
                    onClearRoute = onClearRoute,
                    onDeleteSelectedPoint = onDeleteWaypoint,
                    onDeselectPoint = { onSelectWaypoint(null) },
                    onOpenSaveDialog = {
                        routeNameInput = "Rotta ${savedRoutes.size + 1}"
                        isSaveDialogOpen = true
                    },
                    onOpenSavedRoutes = { isSavedRoutesOpen = true },
                    modifier = Modifier.padding(horizontal = 12.dp)
                )

                Spacer(modifier = Modifier.height(20.dp))
            }

            // Top-Right Menu Trigger Button (Menu Drawer)
            IconButton(
                onClick = { isMenuDrawerOpen = true },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(8.dp)
                    .size(40.dp)
                    .background(Zinc950.copy(alpha = 0.85f), RoundedCornerShape(8.dp))
            ) {
                Icon(
                    Icons.Default.Menu,
                    contentDescription = "Apri impostazioni e menu",
                    tint = androidx.compose.ui.graphics.Color.White
                )
            }
        }

        // Top-Right Slide-Over Menu Drawer Sheet
        MenuDrawerSheet(
            isOpen = isMenuDrawerOpen,
            onClose = { isMenuDrawerOpen = false },
            waveFilter = state.waveFilter,
            onChangeWaveFilter = onChangeWaveFilter,
            useMagneticWhenStopped = state.useMagneticWhenStopped,
            onToggleMagnetic = onToggleMagnetic,
            onResetTrip = onResetTrip,
            track = state.track,
            isSimulatorActive = state.isSimulatorActive,
            simSpeedKnots = simSpeedKnots,
            simHeadingDeg = simHeadingDeg,
            onToggleSimulator = onToggleSimulator,
            onSimSpeedChange = onSimSpeedChange,
            onSimHeadingChange = onSimHeadingChange
        )

        // Layers & INT-1 Legend Bottom Sheet
        LayersLegendSheet(
            isOpen = isLayersOpen,
            onClose = { isLayersOpen = false }
        )

        // Saved Routes Dialog Modal
        SavedRoutesDialog(
            isOpen = isSavedRoutesOpen,
            savedRoutes = savedRoutes,
            onClose = { isSavedRoutesOpen = false },
            onLoadRoute = onLoadRoute,
            onDeleteRoute = onDeleteSavedRoute
        )

        // Save Current Route Dialog
        if (isSaveDialogOpen) {
            AlertDialog(
                onDismissRequest = { isSaveDialogOpen = false },
                title = { Text("Salva Rotta Attiva") },
                text = {
                    OutlinedTextField(
                        value = routeNameInput,
                        onValueChange = { routeNameInput = it },
                        label = { Text("Nome della rotta") },
                        singleLine = true
                    )
                },
                confirmButton = {
                    Button(onClick = {
                        onSaveRoute(routeNameInput)
                        isSaveDialogOpen = false
                    }) {
                        Text("Salva")
                    }
                },
                dismissButton = {
                    TextButton(onClick = { isSaveDialogOpen = false }) {
                        Text("Annulla")
                    }
                }
            )
        }
    }
}
