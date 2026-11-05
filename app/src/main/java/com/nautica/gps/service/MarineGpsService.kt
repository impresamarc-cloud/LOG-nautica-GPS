package com.nautica.gps.service

import android.annotation.SuppressLint
import android.app.Service
import android.content.Intent
import android.location.Location
import android.os.Binder
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import com.google.android.gms.location.*
import com.nautica.gps.audio.MarineAudioHelper
import com.nautica.gps.model.GpsStatus
import com.nautica.gps.model.MarineTelemetryState
import com.nautica.gps.model.TrackPoint
import com.nautica.gps.utils.NauticalMath
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

class MarineGpsService : Service() {

    private val binder = LocalBinder()
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var notificationHelper: MarineNotificationHelper
    private lateinit var audioHelper: MarineAudioHelper
    private var wakeLock: PowerManager.WakeLock? = null

    private val _telemetryState = MutableStateFlow(MarineTelemetryState())
    val telemetryState: StateFlow<MarineTelemetryState> = _telemetryState.asStateFlow()

    private var lastRecordedLat: Double? = null
    private var lastRecordedLon: Double? = null
    private var smoothedSpeedKnots = 0.0

    inner class LocalBinder : Binder() {
        fun getService(): MarineGpsService = this@MarineGpsService
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onCreate() {
        super.onCreate()
        notificationHelper = MarineNotificationHelper(this)
        audioHelper = MarineAudioHelper(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "LogNauticoGPS::MarineServiceWakeLock"
        )
        wakeLock?.acquire(24 * 60 * 60 * 1000L) // Safe 24h timeout

        startForeground(
            MarineNotificationHelper.NOTIFICATION_ID,
            notificationHelper.buildNotification(0.0, null, null, null)
        )

        setupLocationUpdates()
    }

    @SuppressLint("MissingPermission")
    private fun setupLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 1000L)
            .setMinUpdateIntervalMillis(500L)
            .setMinUpdateDistanceMeters(0.5f)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val loc = result.lastLocation ?: return
                processNewGpsFix(loc)
            }

            override fun onLocationAvailability(avail: LocationAvailability) {
                val isAvailable = avail.isLocationAvailable
                _telemetryState.update {
                    it.copy(gpsStatus = if (isAvailable) GpsStatus.ACTIVE else GpsStatus.SEARCHING)
                }
            }
        }

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (_: SecurityException) {
            _telemetryState.update { it.copy(gpsStatus = GpsStatus.DENIED) }
        }
    }

    private fun processNewGpsFix(loc: Location) {
        val rawSpeedMps = if (loc.hasSpeed()) loc.speed.toDouble() else 0.0
        val rawKnots = rawSpeedMps * 1.943844

        // Dead-band threshold: Below 0.3 knots consider stationary
        val effectiveKnots = if (rawKnots < 0.3) 0.0 else rawKnots

        // Exponential Moving Average filter based on current setting
        val alpha = _telemetryState.value.waveFilter.alpha
        smoothedSpeedKnots = (alpha * effectiveKnots) + ((1.0 - alpha) * smoothedSpeedKnots)
        val speedKmh = smoothedSpeedKnots * 1.852

        // GPS Course Over Ground heading when in motion
        val rawHeading = if (loc.hasBearing() && smoothedSpeedKnots >= 0.5) loc.bearing else null

        val currentLat = loc.latitude
        val currentLon = loc.longitude

        // Trip distance accumulation
        var deltaNm = 0.0
        if (lastRecordedLat != null && lastRecordedLon != null && smoothedSpeedKnots > 0.3) {
            val distMeters = NauticalMath.haversineDistanceMeters(
                lastRecordedLat!!,
                lastRecordedLon!!,
                currentLat,
                currentLon
            )
            // Filter abnormal GPS jumps (>100 meters per second)
            if (distMeters in 0.5..100.0) {
                deltaNm = distMeters / NauticalMath.METERS_PER_NAUTICAL_MILE
            }
        }
        lastRecordedLat = currentLat
        lastRecordedLon = currentLon

        val currentRoutes = _telemetryState.value.routePoints
        var targetBearing: Float? = null
        var nextLegDistNm: Double? = null

        if (currentRoutes.isNotEmpty()) {
            val targetWp = currentRoutes[0]
            val distMeters = NauticalMath.haversineDistanceMeters(
                currentLat,
                currentLon,
                targetWp.lat,
                targetWp.lon
            )
            nextLegDistNm = distMeters / NauticalMath.METERS_PER_NAUTICAL_MILE
            targetBearing = NauticalMath.computeTrueBearing(
                currentLat,
                currentLon,
                targetWp.lat,
                targetWp.lon
            )

            // Arrival alert (35m radius)
            if (distMeters <= NauticalMath.ARRIVAL_RADIUS_METERS) {
                audioHelper.playWaypointArrivalAlarm()
            }
        }

        val newTrackPoint = TrackPoint(
            lat = currentLat,
            lon = currentLon,
            speedKnots = smoothedSpeedKnots
        )

        _telemetryState.update { curr ->
            val newTrack = if (smoothedSpeedKnots > 0.4 || curr.track.isEmpty()) {
                (curr.track + newTrackPoint).takeLast(2000)
            } else {
                curr.track
            }
            val newMax = maxOf(curr.maxSpeedKnots, smoothedSpeedKnots)
            val newTripDist = curr.tripDistanceNm + deltaNm
            val newHeading = rawHeading ?: curr.headingDeg

            curr.copy(
                speedKnots = smoothedSpeedKnots,
                speedKmh = speedKmh,
                maxSpeedKnots = newMax,
                tripDistanceNm = newTripDist,
                headingDeg = newHeading,
                targetBearingDeg = targetBearing,
                nextLegDistanceNm = nextLegDistNm,
                latitude = currentLat,
                longitude = currentLon,
                accuracyMeters = if (loc.hasAccuracy()) loc.accuracy else null,
                gpsStatus = GpsStatus.ACTIVE,
                track = newTrack
            )
        }

        notificationHelper.updateNotification(
            speedKnots = smoothedSpeedKnots,
            headingDeg = _telemetryState.value.headingDeg,
            activeWaypointNum = if (currentRoutes.isNotEmpty()) 1 else null,
            distanceNm = nextLegDistNm
        )
    }

    fun updateRoutePoints(points: List<com.nautica.gps.model.WaypointTarget>) {
        _telemetryState.update { it.copy(routePoints = points) }
    }

    fun setSelectedWaypointId(id: String?) {
        _telemetryState.update { it.copy(selectedWaypointId = id) }
    }

    fun setWaveFilter(level: com.nautica.gps.model.WaveFilterLevel) {
        _telemetryState.update { it.copy(waveFilter = level) }
    }

    fun toggleAutoFollow() {
        _telemetryState.update { it.copy(isAutoFollow = !it.isAutoFollow) }
    }

    fun resetTrip() {
        _telemetryState.update {
            it.copy(
                maxSpeedKnots = 0.0,
                tripDistanceNm = 0.0,
                tripDurationSec = 0,
                track = emptyList()
            )
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        // If app is closed/swiped away from Recent Apps, stop everything immediately
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        audioHelper.release()
        if (wakeLock?.isHeld == true) {
            wakeLock?.release()
        }
    }
}
