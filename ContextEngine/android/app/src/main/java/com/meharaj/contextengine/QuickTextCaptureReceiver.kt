package com.meharaj.contextengine

import android.Manifest
import android.app.ActivityOptions
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import java.util.UUID
import java.util.concurrent.Executors

class QuickTextCaptureReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ACTION_SHOW) {
            try {
                if (!showReply(context)) openComposer(context)
            } catch (error: Exception) {
                Log.w(TAG, "Could not show text capture notification", error)
                openComposer(context)
            }
            return
        }
        if (intent.action != ACTION_SAVE) return
        val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(INPUT_TEXT)?.toString()?.trim()
        val id = intent.getStringExtra(EXTRA_ID) ?: return
        if (text.isNullOrEmpty()) return
        val pending = goAsync()
        executor.execute {
            try {
                QuickTextOutbox.save(context, id, text)
                // The outbox is authoritative even when enqueue fails or Android delays work.
                try {
                    BackgroundSynthesisWorker.enqueue(context)
                } catch (error: Exception) {
                    Log.w(TAG, "Text saved; background scheduling failed", error)
                }
                notifySafely(context, id, notification(context, id)
                    .setContentTitle("Thought saved on this device")
                    .setContentText("It will appear in Inbox when background processing runs or you open the app.")
                    .setAutoCancel(true).build())
            } catch (error: Exception) {
                Log.e(TAG, "Could not save quick text", error)
                notifySafely(context, id, notification(context, id)
                    .setContentTitle("Thought was not saved")
                    .setContentText("Copy your text below and save it in Thought Notes.")
                    .setStyle(Notification.BigTextStyle().bigText(text))
                    .setRemoteInputHistory(arrayOf(text))
                    .build(), retainIfStale = true)
            } finally {
                pending.finish()
            }
        }
    }

    companion object {
        const val ACTION_SHOW = "com.meharaj.contextengine.QUICK_TEXT_SHOW"
        private const val ACTION_SAVE = "com.meharaj.contextengine.QUICK_TEXT_SAVE"
        private const val EXTRA_ID = "captureId"
        private const val INPUT_TEXT = "thought"
        private const val CHANNEL_ID = "quick-text-capture"
        private const val NOTIFICATION_ID = 4202
        private const val TAG = "QuickTextCapture"
        private val executor = Executors.newSingleThreadExecutor()
        private var latestCaptureId: String? = null

        @Synchronized
        internal fun notifySafely(context: Context, captureId: String, notification: Notification, retainIfStale: Boolean = false) {
            try {
                val manager = manager(context)
                val isCurrent = (latestCaptureId == null || latestCaptureId == captureId) && manager.activeNotifications.any {
                    it.id == NOTIFICATION_ID && it.tag == null && it.notification.extras.getString(EXTRA_ID) == captureId
                }
                if (isCurrent) manager.notify(NOTIFICATION_ID, notification)
                else if (retainIfStale) manager.notify(captureId, NOTIFICATION_ID, notification)
            } catch (error: Exception) {
                Log.w(TAG, "Could not update text capture notification", error)
            }
        }

        private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)

        private fun composerIntent(context: Context) = Intent(context, MainActivity::class.java).apply {
            action = MainActivity.ACTION_QUICK_CAPTURE
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        fun composerPendingIntent(context: Context, requestCode: Int): PendingIntent {
            val options = ActivityOptions.makeBasic()
            if (Build.VERSION.SDK_INT >= 35) {
                options.setPendingIntentCreatorBackgroundActivityStartMode(
                    if (Build.VERSION.SDK_INT >= 36) ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOW_ALWAYS
                    else ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
                )
            }
            return PendingIntent.getActivity(context, requestCode, composerIntent(context),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE, options.toBundle())
        }

        private fun openComposer(context: Context) {
            val options = ActivityOptions.makeBasic()
            if (Build.VERSION.SDK_INT >= 34) {
                options.setPendingIntentBackgroundActivityStartMode(
                    if (Build.VERSION.SDK_INT >= 36) ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOW_ALWAYS
                    else ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
                )
            }
            composerPendingIntent(context, NOTIFICATION_ID).send(context, 0, null, null, null, null, options.toBundle())
        }

        fun canShowReply(context: Context): Boolean {
            val manager = manager(context)
            if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
            if (!manager.areNotificationsEnabled()) return false
            return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
                manager.getNotificationChannel(CHANNEL_ID)?.importance != NotificationManager.IMPORTANCE_NONE
        }

        private fun notification(context: Context, captureId: String): Notification.Builder {
            val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(context, CHANNEL_ID)
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(context)
            }
            return builder.addExtras(Bundle().apply { putString(EXTRA_ID, captureId) })
                .setSmallIcon(R.drawable.quick_capture_widget_write_icon)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setContentIntent(composerPendingIntent(context, NOTIFICATION_ID))
        }

        @Synchronized
        internal fun showReply(context: Context): Boolean {
            val manager = manager(context)
            if (!canShowReply(context)) return false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Quick text capture", NotificationManager.IMPORTANCE_HIGH))
                if (manager.getNotificationChannel(CHANNEL_ID)?.importance == NotificationManager.IMPORTANCE_NONE) return false
            }
            val captureId = "quick-text-${UUID.randomUUID()}"
            val replyIntent = Intent(context, QuickTextCaptureReceiver::class.java).apply {
                action = ACTION_SAVE
                data = Uri.parse("contextengine://quick-text/$captureId")
                putExtra(EXTRA_ID, captureId)
            }
            val reply = PendingIntent.getBroadcast(context, NOTIFICATION_ID, replyIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
            val action = Notification.Action.Builder(null, "Write thought", reply)
                .addRemoteInput(RemoteInput.Builder(INPUT_TEXT).setLabel("Your thought").build())
                .setAllowGeneratedReplies(false).build()
            manager.notify(NOTIFICATION_ID, notification(context, captureId)
                .setContentTitle("Write a thought")
                .setContentText("Tap Write thought to save text without opening the app.")
                .addAction(action).build())
            latestCaptureId = captureId
            return true
        }
    }
}
