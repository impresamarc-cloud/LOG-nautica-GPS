package com.nautica.gps.utils

import kotlin.math.*

object NauticalMath {
    const val METERS_PER_NAUTICAL_MILE = 1852.0
    const val ARRIVAL_RADIUS_METERS = 35.0

    fun haversineDistanceMeters(
        lat1: Double,
        lon1: Double,
        lat2: Double,
        lon2: Double
    ): Double {
        val r = 6371000.0 // Earth radius in meters
        val phi1 = Math.toRadians(lat1)
        val phi2 = Math.toRadians(lat2)
        val deltaPhi = Math.toRadians(lat2 - lat1)
        val deltaLambda = Math.toRadians(lon2 - lon1)

        val a = sin(deltaPhi / 2.0).pow(2) +
                cos(phi1) * cos(phi2) * sin(deltaLambda / 2.0).pow(2)
        val c = 2.0 * atan2(sqrt(a), sqrt(1.0 - a))
        return r * c
    }

    fun computeTrueBearing(
        lat1: Double,
        lon1: Double,
        lat2: Double,
        lon2: Double
    ): Float {
        val phi1 = Math.toRadians(lat1)
        val phi2 = Math.toRadians(lat2)
        val deltaLambda = Math.toRadians(lon2 - lon1)

        val y = sin(deltaLambda) * cos(phi2)
        val x = cos(phi1) * sin(phi2) - sin(phi1) * cos(phi2) * cos(deltaLambda)
        val initialBearing = atan2(y, x)
        val compassBearing = (Math.toDegrees(initialBearing) + 360.0) % 360.0
        return compassBearing.toFloat()
    }

    fun computeDestinationPoint(
        lat: Double,
        lon: Double,
        bearingDeg: Float,
        distanceMeters: Double
    ): Pair<Double, Double> {
        val r = 6371000.0
        val delta = distanceMeters / r
        val theta = Math.toRadians(bearingDeg.toDouble())

        val phi1 = Math.toRadians(lat)
        val lambda1 = Math.toRadians(lon)

        val phi2 = asin(sin(phi1) * cos(delta) + cos(phi1) * sin(delta) * cos(theta))
        val lambda2 = lambda1 + atan2(
            sin(theta) * sin(delta) * cos(phi1),
            cos(delta) - sin(phi1) * sin(phi2)
        )

        return Pair(Math.toDegrees(phi2), ((Math.toDegrees(lambda2) + 540.0) % 360.0) - 180.0)
    }

    fun formatNauticalCoord(coord: Double, isLat: Boolean): String {
        val hemisphere = if (isLat) {
            if (coord >= 0) "N" else "S"
        } else {
            if (coord >= 0) "E" else "W"
        }
        val absVal = abs(coord)
        val degrees = floor(absVal).toInt()
        val minutes = (absVal - degrees) * 60.0

        val degStr = if (isLat) {
            String.format("%02d", degrees)
        } else {
            String.format("%03d", degrees)
        }
        return String.format("%s°%06.3f' %s", degStr, minutes, hemisphere)
    }

    fun formatHeading3Digits(heading: Float?): String {
        if (heading == null || !heading.isFinite()) return "---"
        val norm = ((heading % 360.0f) + 360.0f) % 360.0f
        return String.format("%03d", (norm + 0.5f).toInt())
    }

    fun formatDuration(seconds: Long): String {
        val hrs = seconds / 3600
        val mins = (seconds % 3600) / 60
        val secs = seconds % 60
        return if (hrs > 0) {
            String.format("%02d:%02d:%02d", hrs, mins, secs)
        } else {
            String.format("%02d:%02d", mins, secs)
        }
    }
}
