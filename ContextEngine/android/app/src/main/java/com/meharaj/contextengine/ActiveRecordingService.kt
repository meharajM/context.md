package com.meharaj.contextengine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

internal class ActiveRecordingService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action != ACTION_START) {
            stopSelf(startId)
            return START_NOT_STICKY
        }

        try {
            ensureNotificationChannel()
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )
            EventEmitter.notifyActiveRecordingServiceStarted()
        } catch (error: Throwable) {
            EventEmitter.notifyActiveRecordingServiceStartFailed(error)
            stopForegroundCompat()
            stopSelf(startId)
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        stopForegroundCompat()
        super.onDestroy()
        EventEmitter.notifyActiveRecordingServiceStopped()
    }

    private fun buildNotification(): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this,
            REQUEST_OPEN_APP,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or pendingIntentImmutableFlag(),
        )
        val stopIntent = PendingIntent.getActivity(
            this,
            REQUEST_STOP_RECORDING,
            Intent(this, MainActivity::class.java)
                .setAction(MainActivity.ACTION_STOP_ACTIVE_RECORDING)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or pendingIntentImmutableFlag(),
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Recording voice note")
            .setContentText("Recording can continue while you use another app")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setContentIntent(openAppIntent)
            .addAction(android.R.drawable.ic_media_pause, "Stop", stopIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Active recording", NotificationManager.IMPORTANCE_LOW)
                .apply { description = "Shows while a voice note is being recorded" },
        )
    }

    private fun stopForegroundCompat() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    }

    private fun pendingIntentImmutableFlag(): Int =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0

    companion object {
        private const val ACTION_START = "com.meharaj.contextengine.action.START_ACTIVE_RECORDING"
        private const val CHANNEL_ID = "contextengine_active_recording"
        private const val NOTIFICATION_ID = 4103
        private const val REQUEST_OPEN_APP = 4103
        private const val REQUEST_STOP_RECORDING = 4104

        fun start(context: Context) {
            ContextCompat.startForegroundService(
                context,
                Intent(context, ActiveRecordingService::class.java).setAction(ACTION_START),
            )
        }

        fun stop(context: Context): Boolean =
            context.stopService(Intent(context, ActiveRecordingService::class.java))
    }
}
