package com.meharaj.contextengine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

class AutomaticReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        try { AutomaticReminderScheduler(context).handle(intent) }
        catch (error: Exception) { Log.e("AutomaticReminders", "Reminder action failed", error) }
    }
}

class AutomaticReminderRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in setOf(Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED)) return
        try { AutomaticReminderScheduler(context).getState() }
        catch (error: Exception) { Log.e("AutomaticReminders", "Reminder restore failed", error) }
    }
}
