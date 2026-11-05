package com.nautica.gps.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.nautica.gps.MainActivity
import com.nautica.gps.R
import com.nautica.gps.utils.NauticalMath

class MarineNotificationHelper(private val context: Context) {

    companion object {
        const val CHANNEL_ID = "marine_nav_channel"
        const val NOTIFICATION_ID = 4040
    }

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    init {
        createNotificationChannel()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = context.getString(R.string.notification_channel_desc)
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }
    }

    fun buildNotification(
        speedKnots: Double,
        headingDeg: Float?,
        activeWaypointNum: Int?,
        distanceNm: Double?
    ): Notification {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val speedText = String.format("%.1f KTS", speedKnots)
        val headingText = NauticalMath.formatHeading3Digits(headingDeg)

        val contentTitle = "Log Nautico GPS · $speedText · $headingText°"
        val contentText = if (activeWaypointNum != null && distanceNm != null) {
            String.format("WP %d attivo · Distanza %.2f NM", activeWaypointNum, distanceNm)
        } else {
            "Tracciamento GPS attivo in background"
        }

        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle(contentTitle)
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
    }

    fun updateNotification(
        speedKnots: Double,
        headingDeg: Float?,
        activeWaypointNum: Int?,
        distanceNm: Double?
    ) {
        notificationManager.notify(
            NOTIFICATION_ID,
            buildNotification(speedKnots, headingDeg, activeWaypointNum, distanceNm)
        )
    }
}
