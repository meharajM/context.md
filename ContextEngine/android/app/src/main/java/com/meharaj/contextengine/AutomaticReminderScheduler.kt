package com.meharaj.contextengine

import android.Manifest
import android.app.*
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.util.AtomicFile
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** All entry points share one lock, including receiver actions and React Native calls. */
class AutomaticReminderScheduler(private val context: Context, file: File = File(context.filesDir, "automatic-reminders.json")) {
    private val storage = AtomicFile(file)
    companion object {
        private val lock = Any()
        private const val CHANNEL = "automatic-reminders"
        private const val YEAR = 366L * 24 * 60 * 60 * 1000
    }
    private fun read(): JSONObject {
        if (!storage.baseFile.exists() && !File(storage.baseFile.path + ".bak").exists())
            return JSONObject().put("enabled", false).put("enabledAt", 0L).put("records", JSONArray())
        val state = JSONObject(storage.openRead().bufferedReader().use { it.readText() })
        require(state.get("enabled") is Boolean)
        val enabledAt = storedInteger(state, "enabledAt")
        require(!state.getBoolean("enabled") || enabledAt > 0)
        val rows = state.getJSONArray("records")
        require(rows.length() <= 100000)
        val ids = HashSet<String>()
        for (i in 0 until rows.length()) {
            val row = rows.getJSONObject(i)
            require(row.get("noteId") is String && validText(row.getString("noteId"), 512))
            require(ids.add(row.getString("noteId")))
            require(row.get("fingerprint") is String && validText(row.getString("fingerprint"), 512))
            require(row.get("inferredWithAi") is Boolean && row.get("status") is String)
            val status = row.getString("status")
            require(status in listOf("none", "scheduled", "delivered", "done"))
            if (status != "none") {
                require(row.get("title") is String && validText(row.getString("title"), 160))
                require(row.get("category") is String && validText(row.getString("category"), 64))
                require(row.get("priority") is String && row.getString("priority") in listOf("low", "normal", "high"))
                val fire = storedInteger(row, "fireAt")
                val expiry = storedInteger(row, "expiresAt")
                require(fire > 0 && expiry > fire && expiry - fire <= YEAR)
            } else {
                require(listOf("title", "category", "priority", "fireAt", "expiresAt").none { row.has(it) })
            }
        }
        require(state.getBoolean("enabled") || rows.length() == 0)
        return state
    }
    private fun storedInteger(value: JSONObject, key: String): Long {
        require(value.get(key) is Number)
        val number = value.getDouble(key)
        require(number.isFinite() && number >= 0 && number <= 9007199254740991.0 && number == number.toLong().toDouble())
        return number.toLong()
    }
    private fun write(state: JSONObject) {
        val stream = storage.startWrite()
        try { stream.write(state.toString().toByteArray(Charsets.UTF_8)); storage.finishWrite(stream) }
        catch (error: Exception) { storage.failWrite(stream); throw error }
    }
    private fun records(state: JSONObject) = state.getJSONArray("records")
    private fun find(state: JSONObject, id: String): JSONObject? {
        val rows = records(state)
        return (0 until rows.length()).map { rows.getJSONObject(it) }.firstOrNull { it.getString("noteId") == id }
    }
    private fun validText(value: String, max: Int) = value.isNotBlank() && value.length <= max && value.none { it.isISOControl() }
    private fun generation(state: JSONObject, value: Long) = state.getBoolean("enabled") && state.getLong("enabledAt") == value
    private fun pending(row: JSONObject, generation: Long, action: String): PendingIntent {
        val intent = Intent(context, AutomaticReminderReceiver::class.java).apply {
            this.action = action
            data = Uri.Builder().scheme("context-reminder").authority(context.packageName)
                .appendPath(storage.baseFile.name).appendPath(generation.toString()).appendPath(row.getString("noteId"))
                .appendPath(row.getString("fingerprint")).appendPath(action).build()
            putExtra("noteId", row.getString("noteId")); putExtra("fingerprint", row.getString("fingerprint")); putExtra("enabledAt", generation)
        }
        return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    private fun cancel(row: JSONObject, generation: Long) {
        context.getSystemService(AlarmManager::class.java).cancel(pending(row, generation, "fire"))
        context.getSystemService(NotificationManager::class.java).cancel("automatic-reminder:" + row.getString("noteId"), 0)
    }
    private fun schedule(row: JSONObject, generation: Long) {
        if (row.getString("status") != "scheduled" || row.getLong("expiresAt") <= System.currentTimeMillis()) return
        context.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP, maxOf(System.currentTimeMillis() + 1000, row.getLong("fireAt")), pending(row, generation, "fire"))
    }
    fun getState(): String = synchronized(lock) {
        val state = read()
        if (state.getBoolean("enabled")) for (i in 0 until records(state).length()) {
            runCatching { schedule(records(state).getJSONObject(i), state.getLong("enabledAt")) }
        }
        state.toString()
    }
    fun setEnabled(enabled: Boolean): String = synchronized(lock) {
        val state = read()
        if (!enabled) {
            val previous = records(state)
            // Persist off first: already queued broadcasts cannot deliver during cancellation.
            state.put("enabled", false).put("records", JSONArray()); write(state)
            for (i in 0 until previous.length()) cancel(previous.getJSONObject(i), state.getLong("enabledAt"))
        } else if (!state.getBoolean("enabled")) {
            state.put("enabled", true).put("enabledAt", maxOf(System.currentTimeMillis(), state.getLong("enabledAt") + 1)); write(state)
        }
        state.toString()
    }
    fun reconcileNote(id: String, fingerprint: String, enabledAt: Long, ai: Boolean, plan: String): Boolean = synchronized(lock) {
        require(validText(id, 512) && validText(fingerprint, 512) && plan.length <= 4096)
        val now = System.currentTimeMillis()
        val parsed = if (plan.isEmpty()) null else JSONObject(plan).also {
            require(it.get("title") is String && validText(it.getString("title"), 160))
            require(it.get("category") is String && validText(it.getString("category"), 64))
            require(it.getString("priority") in listOf("low", "normal", "high"))
            require(it.get("fireAt") is Number && it.get("expiresAt") is Number)
            val fire = it.getDouble("fireAt"); val expiry = it.getDouble("expiresAt")
            require(fire.isFinite() && expiry.isFinite() && fire == fire.toLong().toDouble() && expiry == expiry.toLong().toDouble())
            require(fire > now && expiry > fire && expiry <= now + YEAR)
        }
        val state = read()
        if (!generation(state, enabledAt)) return@synchronized false
        val old = find(state, id)
        if (old != null && old.getString("fingerprint") == fingerprint) {
            if (old.getString("status") in listOf("delivered", "done")) return@synchronized true
            if (old.getBoolean("inferredWithAi") || !ai || old.optLong("expiresAt", Long.MAX_VALUE) <= now) return@synchronized true
        }
        val row = JSONObject().put("noteId", id).put("fingerprint", fingerprint).put("inferredWithAi", ai)
            .put("status", if (parsed == null) "none" else "scheduled")
        if (parsed != null) for (key in listOf("title", "category", "priority", "fireAt", "expiresAt")) row.put(key, parsed.get(key))
        val rows = records(state); val replacement = JSONArray()
        for (i in 0 until rows.length()) if (rows.getJSONObject(i).getString("noteId") != id) replacement.put(rows.getJSONObject(i))
        replacement.put(row); state.put("records", replacement); write(state)
        if (old != null) cancel(old, enabledAt)
        runCatching { schedule(row, enabledAt) }
        true
    }
    fun cancelMissingNotes(ids: List<String>, enabledAt: Long): Boolean = synchronized(lock) {
        require(ids.size <= 100000 && ids.all { validText(it, 512) })
        val state = read(); if (!generation(state, enabledAt)) return@synchronized false
        val keep = ids.toHashSet(); val rows = records(state); val retained = JSONArray(); val removed = mutableListOf<JSONObject>()
        for (i in 0 until rows.length()) { val row = rows.getJSONObject(i); if (row.getString("noteId") in keep) retained.put(row) else removed.add(row) }
        state.put("records", retained); write(state); removed.forEach { cancel(it, enabledAt) }; true
    }
    fun handle(intent: Intent) = synchronized(lock) {
        val state = read(); val gen = intent.getLongExtra("enabledAt", -1)
        if (!generation(state, gen)) return@synchronized
        val row = find(state, intent.getStringExtra("noteId") ?: return@synchronized) ?: return@synchronized
        if (row.getString("fingerprint") != intent.getStringExtra("fingerprint")) return@synchronized
        val now = System.currentTimeMillis()
        when (intent.action) {
            "done" -> { if (row.getString("status") != "delivered") return@synchronized; row.put("status", "done"); write(state); cancel(row, gen) }
            "snooze" -> {
                if (row.getString("status") != "delivered" || now + 900000 >= row.getLong("expiresAt")) return@synchronized
                row.put("status", "scheduled").put("fireAt", now + 900000); write(state); cancel(row, gen); schedule(row, gen)
            }
            "fire" -> {
                if (row.getString("status") != "scheduled" || now < row.getLong("fireAt") || now >= row.getLong("expiresAt")) return@synchronized
                if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return@synchronized
                val manager = context.getSystemService(NotificationManager::class.java)
                if (!manager.areNotificationsEnabled()) return@synchronized
                if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
                    NotificationChannel(CHANNEL, "Automatic reminders", NotificationManager.IMPORTANCE_DEFAULT))
                val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
                val category = row.getString("category")
                val content = if (row.getString("priority") == "high") "$category · High priority" else category
                builder.setSmallIcon(android.R.drawable.ic_popup_reminder)
                    .setContentTitle(row.getString("title")).setContentText(content)
                    .setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(open).setAutoCancel(true).setOnlyAlertOnce(true)
                    .addAction(Notification.Action.Builder(null, "Done", pending(row, gen, "done")).build())
                if (now + 900000 < row.getLong("expiresAt")) {
                    builder.addAction(Notification.Action.Builder(null, "Snooze 15 min", pending(row, gen, "snooze")).build())
                }
                val notification = builder.build()
                // Stable identity replaces a posted notification if persistence needs retrying.
                manager.notify("automatic-reminder:" + row.getString("noteId"), 0, notification)
                row.put("status", "delivered"); write(state)
            }
        }
    }
}
