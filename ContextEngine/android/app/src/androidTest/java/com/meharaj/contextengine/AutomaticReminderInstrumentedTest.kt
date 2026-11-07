package com.meharaj.contextengine

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class AutomaticReminderInstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext
    private fun allowTestNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            InstrumentationRegistry.getInstrumentation().uiAutomation
                .executeShellCommand("pm grant ${context.packageName} ${Manifest.permission.POST_NOTIFICATIONS}").close()
        }
    }
    @Test fun generationValidationUpgradeAndCancellation() {
        val file = File(context.cacheDir, "reminder-test-${UUID.randomUUID()}.json")
        val scheduler = AutomaticReminderScheduler(context, file)
        try {
            assertFalse(JSONObject(scheduler.getState()).getBoolean("enabled"))
            val generation = JSONObject(scheduler.setEnabled(true)).getLong("enabledAt")
            assertEquals(generation, JSONObject(scheduler.setEnabled(true)).getLong("enabledAt"))
            val id = "test-${UUID.randomUUID()}"
            fun plan(title: String) = JSONObject().put("title", title).put("category", "errand").put("priority", "normal")
                .put("fireAt", System.currentTimeMillis() + 3600000).put("expiresAt", System.currentTimeMillis() + 7200000).toString()
            assertFalse(scheduler.reconcileNote(id, "v1", generation - 1, false, plan("Stale")))
            assertTrue(scheduler.reconcileNote(id, "v1", generation, false, plan("Fallback")))
            val before = file.readText()
            try { scheduler.reconcileNote(id, "v2", generation, true, "{\"title\":false}"); fail("Invalid input accepted") } catch (_: IllegalArgumentException) {} catch (_: org.json.JSONException) {}
            assertEquals(before, file.readText())
            scheduler.reconcileNote(id, "v1", generation, true, plan("AI"))
            assertEquals("AI", JSONObject(scheduler.getState()).getJSONArray("records").getJSONObject(0).getString("title"))
            // A stale action cannot complete a scheduled record.
            scheduler.handle(Intent().setAction("done").putExtra("noteId", id).putExtra("fingerprint", "v1").putExtra("enabledAt", generation - 1))
            assertEquals("scheduled", JSONObject(scheduler.getState()).getJSONArray("records").getJSONObject(0).getString("status"))
            val delivered = JSONObject(file.readText())
            delivered.getJSONArray("records").getJSONObject(0).put("status", "delivered")
            file.writeText(delivered.toString())
            scheduler.reconcileNote(id, "v1", generation, true, plan("Must not replay"))
            assertEquals("delivered", JSONObject(scheduler.getState()).getJSONArray("records").getJSONObject(0).getString("status"))
            scheduler.handle(Intent().setAction("snooze").putExtra("noteId", id).putExtra("fingerprint", "v1").putExtra("enabledAt", generation))
            assertEquals("scheduled", JSONObject(scheduler.getState()).getJSONArray("records").getJSONObject(0).getString("status"))
            val nearExpiry = JSONObject(file.readText())
            nearExpiry.getJSONArray("records").getJSONObject(0).put("status", "delivered").put("fireAt", System.currentTimeMillis() - 1000).put("expiresAt", System.currentTimeMillis() + 60000)
            file.writeText(nearExpiry.toString())
            scheduler.handle(Intent().setAction("snooze").putExtra("noteId", id).putExtra("fingerprint", "v1").putExtra("enabledAt", generation))
            assertEquals("delivered", JSONObject(scheduler.getState()).getJSONArray("records").getJSONObject(0).getString("status"))
            scheduler.handle(Intent().setAction("done").putExtra("noteId", id).putExtra("fingerprint", "v1").putExtra("enabledAt", generation))
            assertEquals("done", JSONObject(scheduler.getState()).getJSONArray("records").getJSONObject(0).getString("status"))
            assertFalse(scheduler.cancelMissingNotes(emptyList(), generation - 1))
            assertTrue(scheduler.cancelMissingNotes(emptyList(), generation))
            assertEquals(0, JSONObject(scheduler.getState()).getJSONArray("records").length())
            scheduler.reconcileNote(id, "v2", generation, false, plan("Another"))
            scheduler.setEnabled(false)
            assertEquals(0, JSONObject(scheduler.getState()).getJSONArray("records").length())
            assertFalse(scheduler.reconcileNote(id, "v2", generation, true, plan("Late")))
            assertTrue(JSONObject(scheduler.setEnabled(true)).getLong("enabledAt") > generation)
        } finally { runCatching { scheduler.setEnabled(false) }; file.delete(); File(file.path + ".bak").delete() }
    }
    @Test fun corruptStateIsPreserved() {
        val file = File(context.cacheDir, "reminder-corrupt-${UUID.randomUUID()}.json")
        file.writeText("broken state")
        try {
            try { AutomaticReminderScheduler(context, file).setEnabled(false); fail("Corrupt state silently reset") } catch (_: org.json.JSONException) {}
            assertEquals("broken state", file.readText())
        } finally { file.delete() }
    }
    @Test fun semanticallyCorruptStateIsPreservedBeforeDisable() {
        val file = File(context.cacheDir, "reminder-invalid-${UUID.randomUUID()}.json")
        val invalidStates = listOf(
            "{\"enabled\":true,\"enabledAt\":1,\"records\":[{}]}",
            "{\"enabled\":true,\"enabledAt\":1.5,\"records\":[]}",
            "{\"enabled\":true,\"enabledAt\":1,\"records\":[{\"noteId\":\"test\",\"fingerprint\":\"v1\",\"inferredWithAi\":false,\"status\":\"unknown\"}]}"
        )
        try {
            for (bytes in invalidStates) {
                file.writeText(bytes)
                try { AutomaticReminderScheduler(context, file).setEnabled(false); fail("Invalid stored record overwritten") }
                catch (_: IllegalArgumentException) {} catch (_: org.json.JSONException) {}
                assertEquals(bytes, file.readText())
            }
        } finally { file.delete() }
    }

    @Test fun dueReminderPostsPrivateNotificationAndDoneClearsIt() {
        allowTestNotifications()
        val file = File(context.cacheDir, "reminder-fire-${UUID.randomUUID()}.json")
        val scheduler = AutomaticReminderScheduler(context, file)
        val manager = context.getSystemService(NotificationManager::class.java)
        val id = "test-notification-${UUID.randomUUID()}"
        val tag = "automatic-reminder:$id"
        try {
            val generation = JSONObject(scheduler.setEnabled(true)).getLong("enabledAt")
            val now = System.currentTimeMillis()
            val plan = JSONObject().put("title", "Test reminder").put("category", "shopping").put("priority", "normal")
                .put("fireAt", now + 2000).put("expiresAt", now + 3600000).toString()
            assertTrue(scheduler.reconcileNote(id, "v1", generation, true, plan))
            Thread.sleep(2200)
            scheduler.handle(Intent().setAction("fire").putExtra("noteId", id).putExtra("fingerprint", "v1").putExtra("enabledAt", generation))
            val notification = manager.activeNotifications.firstOrNull { it.tag == tag }?.notification
            assertNotNull("due reminder was not posted", notification)
            assertEquals(Notification.VISIBILITY_PRIVATE, notification!!.visibility)
            assertEquals(2, notification.actions.size)
            scheduler.handle(Intent().setAction("done").putExtra("noteId", id).putExtra("fingerprint", "v1").putExtra("enabledAt", generation))
            val clearDeadline = System.currentTimeMillis() + 2000
            while (manager.activeNotifications.any { it.tag == tag } && System.currentTimeMillis() < clearDeadline) Thread.sleep(20)
            assertTrue("Done should clear the reminder notification", manager.activeNotifications.none { it.tag == tag })
            assertEquals("done", JSONObject(scheduler.getState()).getJSONArray("records").getJSONObject(0).getString("status"))
        } finally {
            runCatching { scheduler.setEnabled(false) }
            file.delete()
            File(file.path + ".bak").delete()
        }
    }

}
