package com.nautica.gps.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BookmarkAdd
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Route
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nautica.gps.model.WaypointTarget
import com.nautica.gps.ui.theme.*
import com.nautica.gps.utils.NauticalMath

@Composable
fun ActiveRoutePanel(
    routePoints: List<WaypointTarget>,
    selectedWaypointId: String?,
    targetBearingDeg: Float?,
    nextLegDistanceNm: Double?,
    totalRouteDistanceNm: Double?,
    speedKnots: Double,
    onClearRoute: () -> Unit,
    onDeleteSelectedPoint: (String) -> Unit,
    onDeselectPoint: () -> Unit,
    onOpenSaveDialog: () -> Unit,
    onOpenSavedRoutes: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (routePoints.isEmpty()) {
        // Simple button to open Saved Routes Library
        Button(
            onClick = onOpenSavedRoutes,
            modifier = modifier
                .fillMaxWidth()
                .height(44.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Zinc900),
            shape = RoundedCornerShape(8.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Zinc700)
        ) {
            Icon(Icons.Default.Route, contentDescription = null, tint = RaymarineYellow, modifier = Modifier.size(18.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Libreria Rotte Salvate", color = PureWhite, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        return
    }

    val etaText = if (totalRouteDistanceNm != null && speedKnots >= 0.4) {
        val totalMins = ((totalRouteDistanceNm / speedKnots) * 60).toInt()
        val hrs = totalMins / 60
        val mins = totalMins % 60
        if (hrs > 0) "${hrs}h ${String.format("%02d", mins)}m" else "$mins min"
    } else "--"

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Zinc950, RoundedCornerShape(12.dp))
            .border(1.dp, RaymarineYellow.copy(alpha = 0.5f), RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Header with Route Stats and Trash Icon Button in Top-Right
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Route, contentDescription = null, tint = RaymarineYellow, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Pannello Rotta Attiva", color = RaymarineYellow, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                }
                Text(
                    text = "${routePoints.size} punti" +
                            (totalRouteDistanceNm?.let { String.format(" · Tot %.2f NM", it) } ?: "") +
                            if (etaText != "--") " · ETA $etaText" else "",
                    color = Zinc400,
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                )
            }

            // Trash Button in Top-Right Corner to Clear Route
            IconButton(
                onClick = onClearRoute,
                modifier = Modifier
                    .size(32.dp)
                    .background(RaymarineRed.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                    .border(1.dp, RaymarineRed.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
            ) {
                Icon(Icons.Default.Delete, contentDescription = "Elimina rotta", tint = RaymarineRed, modifier = Modifier.size(16.dp))
            }
        }

        // Active Leg Telemetry (WP 1 / N)
        if (targetBearingDeg != null && nextLegDistanceNm != null) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(PureBlack, RoundedCornerShape(8.dp))
                    .border(1.dp, Zinc800, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "WP 1/${routePoints.size} · Prua ${NauticalMath.formatHeading3Digits(targetBearingDeg)}°",
                    color = RaymarineYellow,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = String.format("Dist %.2f NM", nextLegDistanceNm),
                    color = PureWhite,
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        // Selected Waypoint Sub-bar with "Solo una X"
        if (selectedWaypointId != null) {
            val wpIndex = routePoints.indexOfFirst { it.id == selectedWaypointId } + 1
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(PureBlack, RoundedCornerShape(8.dp))
                    .border(1.dp, RaymarineYellow, RoundedCornerShape(8.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Punto $wpIndex selezionato",
                    color = RaymarineYellow,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )

                // Solo una X per eliminare il punto
                IconButton(
                    onClick = { onDeleteSelectedPoint(selectedWaypointId) },
                    modifier = Modifier
                        .size(30.dp)
                        .background(RaymarineRed.copy(alpha = 0.2f), RoundedCornerShape(6.dp))
                        .border(1.dp, RaymarineRed, RoundedCornerShape(6.dp))
                ) {
                    Icon(Icons.Default.Close, contentDescription = "Elimina punto", tint = RaymarineRed, modifier = Modifier.size(16.dp))
                }
            }
        }

        // Action Buttons: Salva rotta & Libreria rotte
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Button(
                onClick = onOpenSaveDialog,
                modifier = Modifier
                    .weight(1f)
                    .height(38.dp),
                colors = ButtonDefaults.buttonColors(containerColor = RaymarineYellow),
                shape = RoundedCornerShape(8.dp)
            ) {
                Icon(Icons.Default.BookmarkAdd, contentDescription = null, tint = PureBlack, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Salva rotta", color = PureBlack, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }

            Button(
                onClick = onOpenSavedRoutes,
                modifier = Modifier.height(38.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Zinc900),
                shape = RoundedCornerShape(8.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Zinc700)
            ) {
                Icon(Icons.Default.Route, contentDescription = null, tint = RaymarineYellow, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Libreria", color = PureWhite, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
