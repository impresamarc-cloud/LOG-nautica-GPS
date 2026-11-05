package com.nautica.gps.model

enum class GpsStatus {
    SEARCHING,
    ACTIVE,
    DENIED,
    UNAVAILABLE
}

enum class WaveFilterLevel(val alpha: Double, val label: String) {
    OFF(1.0, "OFF (Istantaneo)"),
    LOW(0.55, "Basso (Mare poco mosso)"),
    MED(0.30, "Medio (Onda formata)"),
    HIGH(0.15, "Alto (Mare agitato)")
}

data class TrackPoint(
    val lat: Double,
    val lon: Double,
    val timestamp: Long = System.currentTimeMillis(),
    val speedKnots: Double = 0.0
)

data class WaypointTarget(
    val id: String = java.util.UUID.randomUUID().toString(),
    val lat: Double,
    val lon: Double
)

data class SavedRoute(
    val id: String = java.util.UUID.randomUUID().toString(),
    val name: String,
    val points: List<WaypointTarget>,
    val createdAt: Long = System.currentTimeMillis()
)

data class MarineTelemetryState(
    val speedKnots: Double = 0.0,
    val speedKmh: Double = 0.0,
    val maxSpeedKnots: Double = 0.0,
    val avgSpeedKnots: Double = 0.0,
    val tripDistanceNm: Double = 0.0,
    val tripDurationSec: Long = 0,
    val headingDeg: Float? = null,
    val targetBearingDeg: Float? = null,
    val nextLegDistanceNm: Double? = null,
    val totalRouteDistanceNm: Double? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val accuracyMeters: Float? = null,
    val gpsStatus: GpsStatus = GpsStatus.SEARCHING,
    val track: List<TrackPoint> = emptyList(),
    val routePoints: List<WaypointTarget> = emptyList(),
    val selectedWaypointId: String? = null,
    val isAutoFollow: Boolean = true,
    val waveFilter: WaveFilterLevel = WaveFilterLevel.MED,
    val useMagneticWhenStopped: Boolean = true,
    val isSimulatorActive: Boolean = false
)
