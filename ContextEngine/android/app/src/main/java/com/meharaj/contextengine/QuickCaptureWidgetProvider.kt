package com.meharaj.contextengine

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews

class QuickCaptureWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { manager.updateAppWidget(it, remoteViews(context, it)) }
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle) {
        manager.updateAppWidget(appWidgetId, remoteViews(context, appWidgetId))
    }

    companion object {
        private const val FEEDBACK_PREFS = "quick-capture-widget"
        private const val FEEDBACK_TEXT = "feedback-text"
        private const val FEEDBACK_AT = "feedback-at"
        private const val FEEDBACK_DURATION_MS = 1_700L

        fun refresh(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val provider = ComponentName(context, QuickCaptureWidgetProvider::class.java)
            manager.getAppWidgetIds(provider).forEach { manager.updateAppWidget(it, remoteViews(context, it)) }
        }

        fun showSaved(context: Context) {
            saveFeedback(context, "Saved")
            refresh(context)
            Handler(Looper.getMainLooper()).postDelayed({
                clearFeedbackIfExpired(context)
                refresh(context)
            }, FEEDBACK_DURATION_MS)
        }

        fun showError(context: Context, message: String) {
            saveFeedback(context, message)
            refresh(context)
            Handler(Looper.getMainLooper()).postDelayed({
                clearFeedbackIfExpired(context)
                refresh(context)
            }, FEEDBACK_DURATION_MS)
        }

        private fun clearFeedbackIfExpired(context: Context) {
            val prefs = context.getSharedPreferences(FEEDBACK_PREFS, Context.MODE_PRIVATE)
            if (System.currentTimeMillis() - prefs.getLong(FEEDBACK_AT, 0L) >= FEEDBACK_DURATION_MS) clearFeedback(context)
        }

        fun clearFeedback(context: Context) {
            context.getSharedPreferences(FEEDBACK_PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        }

        private fun saveFeedback(context: Context, message: String) {
            context.getSharedPreferences(FEEDBACK_PREFS, Context.MODE_PRIVATE).edit()
                .putString(FEEDBACK_TEXT, message)
                .putLong(FEEDBACK_AT, System.currentTimeMillis())
                .apply()
        }

        internal fun remoteViews(context: Context, widgetId: Int): RemoteViews {
            val views = RemoteViews(context.packageName, R.layout.quick_capture_widget)
            val width = AppWidgetManager.getInstance(context).getAppWidgetOptions(widgetId)
                .getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
            val showActionLabels = width >= 240 || context.resources.configuration.fontScale <= 1.3f
            views.setViewVisibility(R.id.quick_capture_widget_record_label, if (showActionLabels) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.quick_capture_widget_write_label, if (showActionLabels) View.VISIBLE else View.GONE)
            val recordingSince = WidgetVoiceCaptureService.recordingStartedAtElapsed
            val isSaving = WidgetVoiceCaptureService.isFinalizing
            val feedbackPrefs = context.getSharedPreferences(FEEDBACK_PREFS, Context.MODE_PRIVATE)
            val feedback = feedbackPrefs.getString(FEEDBACK_TEXT, null)
            val feedbackIsFresh = System.currentTimeMillis() - feedbackPrefs.getLong(FEEDBACK_AT, 0L) < FEEDBACK_DURATION_MS
            val showSaved = feedbackIsFresh && feedback == "Saved" && recordingSince == null
            val showError = recordingSince == null && !isSaving && feedbackIsFresh && feedback != null && feedback != "Saved"

            views.setViewVisibility(R.id.quick_capture_widget_idle, if (recordingSince == null && !isSaving && !showSaved && !showError) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.quick_capture_widget_recording, if (recordingSince != null || isSaving) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.quick_capture_widget_saved, if (showSaved && !isSaving) View.VISIBLE else View.GONE)
            views.setViewVisibility(
                R.id.quick_capture_widget_feedback,
                if (showError) View.VISIBLE else View.GONE,
            )

            if (recordingSince != null) {
                views.setChronometer(R.id.quick_capture_widget_timer, recordingSince, "%s", true)
                views.setContentDescription(R.id.quick_capture_widget_recording, context.getString(R.string.quick_record_widget_recording_description))
            }
            views.setViewVisibility(R.id.quick_capture_widget_live_dot, if (recordingSince != null && !isSaving) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.quick_capture_widget_progress, if (isSaving) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.quick_capture_widget_recording_label, if (isSaving) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.quick_capture_widget_timer, if (recordingSince != null && !isSaving) View.VISIBLE else View.GONE)
            views.setViewVisibility(R.id.quick_capture_widget_stop, if (recordingSince != null && !isSaving) View.VISIBLE else View.GONE)
            if (feedbackIsFresh && feedback != null && feedback != "Saved") {
                views.setTextViewText(R.id.quick_capture_widget_feedback, feedback)
            }

            val startIntent = Intent(context, QuickCaptureWidgetActionReceiver::class.java).setAction(QuickCaptureWidgetActionReceiver.ACTION_START)
            val writeIntent = Intent(context, QuickCaptureActivity::class.java).setAction(QuickCaptureActivity.ACTION_WRITE)
            val stopIntent = Intent(context, QuickCaptureWidgetActionReceiver::class.java).setAction(QuickCaptureWidgetActionReceiver.ACTION_STOP)
            views.setOnClickPendingIntent(
                R.id.quick_record_widget_button,
                PendingIntent.getBroadcast(context, widgetId * 10 + 1, startIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
            )
            views.setOnClickPendingIntent(
                R.id.quick_capture_widget_button,
                PendingIntent.getActivity(context, widgetId * 10 + 2, writeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
            )
            views.setOnClickPendingIntent(
                R.id.quick_capture_widget_stop,
                PendingIntent.getBroadcast(context, widgetId * 10 + 3, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
            )
            return views
        }
    }
}
