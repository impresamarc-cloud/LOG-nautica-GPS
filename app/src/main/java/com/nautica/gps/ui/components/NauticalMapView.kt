package com.nautica.gps.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.view.MotionEvent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.nautica.gps.model.TrackPoint
import com.nautica.gps.model.WaypointTarget
import com.nautica.gps.ui.theme.*
import com.nautica.gps.utils.NauticalMath
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polyline
import org.osmdroid.views.overlay.TilesOverlay

@Composable
fun NauticalMapView(
    boatLat: Double,
    boatLon: Double,
    boatHeading: Float?,
    track: List<TrackPoint>,
    routePoints: List<WaypointTarget>,
    selectedWaypointId: String?,
    isAutoFollow: Boolean,
    onAddWaypoint: (WaypointTarget) -> Unit,
    onUpdateWaypoint: (String, Double, Double) -> Unit,
    onDeleteWaypoint: (String) -> Unit,
    onSelectWaypoint: (String?) -> Unit,
    onToggleAutoFollow: () -> Unit,
    onOpenLayers: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var mapView by remember { mutableStateOf<MapView?>(null) }

    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, Zinc700, RoundedCornerShape(12.dp))
    ) {
        AndroidView(
            factory = { ctx ->
                Configuration.getInstance().load(ctx, ctx.getSharedPreferences("osmdroid", Context.MODE_PRIVATE))
                MapView(ctx).apply {
                    setTileSource(TileSourceFactory.MAPNIK)
                    setMultiTouchControls(true)
                    isTilesScaledToDpi = true
                    zoomController.setVisibility(org.osmdroid.views.CustomZoomButtonsController.Visibility.NEVER)
                    controller.setZoom(14.0)

                    // OpenSeaMap Seamark Overlay
                    val seamarkOverlay = TilesOverlay(
                        org.osmdroid.tileprovider.MapTileProviderBasic(
                            ctx,
                            org.osmdroid.tileprovider.tilesource.XYTileSource(
                                "OpenSeaMap",
                                0, 18, 256, ".png",
                                arrayOf("https://tiles.openseamap.org/seamark/")
                            )
                        ),
                        ctx
                    ).apply {
                        loadingBackgroundColor = android.graphics.Color.TRANSPARENT
                    }
                    overlays.add(seamarkOverlay)

                    // Single map tap listener to add point or deselect
                    val mapEventsOverlay = org.osmdroid.views.overlay.MapEventsOverlay(object :
                        org.osmdroid.events.MapEventsReceiver {
                        override fun singleTapConfirmedHelper(p: GeoPoint): Boolean {
                            if (selectedWaypointId != null) {
                                onSelectWaypoint(null)
                            } else {
                                onAddWaypoint(WaypointTarget(lat = p.latitude, lon = p.longitude))
                            }
                            return true
                        }

                        override fun longPressHelper(p: GeoPoint): Boolean = false
                    })
                    overlays.add(0, mapEventsOverlay)

                    mapView = this
                }
            },
            update = { map ->
                map.overlays.removeAll { it is Marker || (it is Polyline && it.id != "persistent") }

                val boatPoint = GeoPoint(boatLat, boatLon)

                // 1. Executed GPS Wake Trail (Cyan line)
                if (track.size >= 2) {
                    val trackPoints = track.map { GeoPoint(it.lat, it.lon) } + boatPoint
                    val wakeLine = Polyline().apply {
                        setPoints(trackPoints)
                        outlinePaint.color = android.graphics.Color.parseColor("#38BDF8")
                        outlinePaint.strokeWidth = 6.0f
                    }
                    map.overlays.add(wakeLine)
                }

                // 2. Heading Projection Line (Orange line)
                if (boatHeading != null) {
                    val destCoord = NauticalMath.computeDestinationPoint(boatLat, boatLon, boatHeading, 24.0 * 1852.0)
                    val headingLine = Polyline().apply {
                        setPoints(listOf(boatPoint, GeoPoint(destCoord.first, destCoord.second)))
                        outlinePaint.color = android.graphics.Color.parseColor("#FF6B00")
                        outlinePaint.strokeWidth = 4.5f
                    }
                    map.overlays.add(headingLine)
                }

                // 3. Multi-point Active Route Polyline
                if (routePoints.isNotEmpty()) {
                    val routeGeoPoints = mutableListOf(boatPoint)
                    routePoints.forEach { routeGeoPoints.add(GeoPoint(it.lat, it.lon)) }
                    val routeLine = Polyline().apply {
                        setPoints(routeGeoPoints)
                        outlinePaint.color = android.graphics.Color.parseColor("#FACC15")
                        outlinePaint.strokeWidth = 5.0f
                    }
                    map.overlays.add(routeLine)
                }

                // 4. Waypoint Markers (with Red 'X' delete button and drag capability)
                routePoints.forEachIndexed { idx, pt ->
                    val wpMarker = Marker(map).apply {
                        position = GeoPoint(pt.lat, pt.lon)
                        setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                        isDraggable = true

                        val isSelected = pt.id == selectedWaypointId
                        icon = createWaypointDrawable(context, idx + 1, isSelected)

                        setOnMarkerClickListener { _, _ ->
                            if (isSelected) {
                                // Tapping the 'X' or selected marker immediately deletes it
                                onDeleteWaypoint(pt.id)
                            } else {
                                onSelectWaypoint(pt.id)
                            }
                            true
                        }

                        setOnMarkerDragListener(object : Marker.OnMarkerDragListener {
                            override fun onMarkerDragStart(marker: Marker) {}
                            override fun onMarkerDrag(marker: Marker) {}
                            override fun onMarkerDragEnd(marker: Marker) {
                                onUpdateWaypoint(pt.id, marker.position.latitude, marker.position.longitude)
                            }
                        })
                    }
                    map.overlays.add(wpMarker)
                }

                // 5. Vessel Marker (Cyan arrow with heading rotation)
                val boatMarker = Marker(map).apply {
                    position = boatPoint
                    setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
                    rotation = boatHeading ?: 0f
                    icon = createVesselDrawable(context)
                }
                map.overlays.add(boatMarker)

                // Auto-follow positioning at 25% from bottom of viewport
                if (isAutoFollow) {
                    map.controller.animateTo(boatPoint)
                }
                map.invalidate()
            },
            modifier = Modifier.fillMaxSize()
        )

        // Compact Square Map Controls on the Right (w-8 h-8 equivalent)
        Column(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Centra Barca (Crosshair icon)
            IconButton(
                onClick = onToggleAutoFollow,
                modifier = Modifier
                    .size(34.dp)
                    .background(if (isAutoFollow) RaymarineYellow.copy(alpha = 0.25f) else Zinc950.copy(alpha = 0.9f), RoundedCornerShape(6.dp))
                    .border(1.dp, if (isAutoFollow) RaymarineYellow else Zinc700, RoundedCornerShape(6.dp))
            ) {
                Icon(
                    imageVector = Icons.Default.GpsFixed,
                    contentDescription = "Centra sulla barca",
                    tint = if (isAutoFollow) RaymarineYellow else PureWhite,
                    modifier = Modifier.size(18.dp)
                )
            }

            // Livelli e Legenda (Layers icon)
            IconButton(
                onClick = onOpenLayers,
                modifier = Modifier
                    .size(34.dp)
                    .background(Zinc950.copy(alpha = 0.9f), RoundedCornerShape(6.dp))
                    .border(1.dp, Zinc700, RoundedCornerShape(6.dp))
            ) {
                Icon(
                    imageVector = Icons.Default.Layers,
                    contentDescription = "Livelli e Legenda",
                    tint = RaymarineCyan,
                    modifier = Modifier.size(18.dp)
                )
            }
        }
    }
}

// Generate Raymarine Diamond Waypoint Icon with Red 'X' Delete Button
private fun createWaypointDrawable(context: Context, number: Int, isSelected: Boolean): android.graphics.drawable.BitmapDrawable {
    val size = 120
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val paint = Paint(Paint.ANTI_ALIAS_FLAG)

    // Center Diamond
    val centerX = size / 2f
    val centerY = size / 2f
    val diamondRadius = 38f

    val path = android.graphics.Path().apply {
        moveTo(centerX, centerY - diamondRadius)
        lineTo(centerX + diamondRadius, centerY)
        lineTo(centerX, centerY + diamondRadius)
        lineTo(centerX - diamondRadius, centerY)
        close()
    }

    paint.color = if (number == 1) android.graphics.Color.parseColor("#FACC15") else android.graphics.Color.parseColor("#18181B")
    paint.style = Paint.Style.FILL
    canvas.drawPath(path, paint)

    paint.color = android.graphics.Color.parseColor("#FACC15")
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 4.5f
    canvas.drawPath(path, paint)

    // Sequence Number
    paint.style = Paint.Style.FILL
    paint.color = if (number == 1) android.graphics.Color.BLACK else android.graphics.Color.parseColor("#FACC15")
    paint.textSize = 34f
    paint.textAlign = Paint.Align.CENTER
    paint.typeface = android.graphics.Typeface.DEFAULT_BOLD
    canvas.drawText(number.toString(), centerX, centerY + 12f, paint)

    // Red 'X' Delete Badge if Selected (Solo una X)
    if (isSelected) {
        val btnX = size - 22f
        val btnY = 22f
        val btnRadius = 20f

        paint.color = android.graphics.Color.parseColor("#EF4444")
        paint.style = Paint.Style.FILL
        canvas.drawCircle(btnX, btnY, btnRadius, paint)

        paint.color = android.graphics.Color.WHITE
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 3.5f
        canvas.drawCircle(btnX, btnY, btnRadius, paint)

        // Draw 'X'
        val arm = 8f
        canvas.drawLine(btnX - arm, btnY - arm, btnX + arm, btnY + arm, paint)
        canvas.drawLine(btnX + arm, btnY - arm, btnX - arm, btnY + arm, paint)
    }

    return android.graphics.drawable.BitmapDrawable(context.resources, bitmap)
}

// Generate Vessel Chevron Icon
private fun createVesselDrawable(context: Context): android.graphics.drawable.BitmapDrawable {
    val size = 90
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = android.graphics.Color.parseColor("#38BDF8") // Cyan
        style = Paint.Style.FILL
    }

    val path = android.graphics.Path().apply {
        moveTo(45f, 10f)
        lineTo(75f, 75f)
        lineTo(45f, 60f)
        lineTo(15f, 75f)
        close()
    }
    canvas.drawPath(path, paint)

    paint.color = android.graphics.Color.WHITE
    paint.style = Paint.Style.STROKE
    paint.strokeWidth = 3f
    canvas.drawPath(path, paint)

    return android.graphics.drawable.BitmapDrawable(context.resources, bitmap)
}
