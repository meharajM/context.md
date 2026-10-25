package com.meharaj.contextengine

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class QuickCaptureWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { widgetId ->
            val views = RemoteViews(context.packageName, R.layout.quick_capture_widget)
            val typeIntent = Intent(context, QuickTextCaptureReceiver::class.java).apply {
                action = QuickTextCaptureReceiver.ACTION_SHOW
            }
            val typeLaunch = if (QuickTextCaptureReceiver.canShowReply(context)) {
                PendingIntent.getBroadcast(
                    context,
                    widgetId,
                    typeIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
            } else {
                QuickTextCaptureReceiver.composerPendingIntent(context, widgetId)
            }
            val recordIntent = Intent(context, MainActivity::class.java).apply {
                action = MainActivity.ACTION_QUICK_RECORD
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            }
            val recordLaunch = PendingIntent.getActivity(
                context,
                widgetId,
                recordIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.quick_capture_widget_button, typeLaunch)
            views.setOnClickPendingIntent(R.id.quick_record_widget_button, recordLaunch)
            manager.updateAppWidget(widgetId, views)
        }
    }
}
