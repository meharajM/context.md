package com.meharaj.contextengine

import android.app.Notification
import android.app.NotificationManager
import android.content.ContextWrapper
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class QuickTextCaptureInstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext

    @Test
    fun malformedRecordDoesNotBlockLaterCapturesOrDeleteOriginalText() {
        val root = File(context.cacheDir, "outbox-test-${UUID.randomUUID()}").apply { mkdirs() }
        val isolated = object : ContextWrapper(context) {
            override fun getFilesDir() = root
        }
        try {
            val directory = File(root, "quick-text-outbox").apply { mkdirs() }
            val corrupt = File(directory, "quick-text-00000000-0000-0000-0000-000000000000.json")
            corrupt.writeText("{truncated original text")
            val id = "quick-text-ffffffff-ffff-ffff-ffff-ffffffffffff"
            QuickTextOutbox.save(isolated, id, "later valid thought")
            QuickTextOutbox.save(isolated, id, "redelivery must not replace original")
            val entries = QuickTextOutbox.read(isolated)
            assertEquals(listOf(id), entries.map { it.noteId })
            assertEquals("later valid thought", entries.single().text)
            assertEquals("{truncated original text", corrupt.readText())
            QuickTextOutbox.acknowledge(isolated, id)
            assertTrue(QuickTextOutbox.read(isolated).isEmpty())
            assertTrue(corrupt.exists())
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun invalidTimestampIsRetainedWithoutBlockingLaterValidCapture() {
        val root = File(context.cacheDir, "outbox-test-${UUID.randomUUID()}").apply { mkdirs() }
        val isolated = object : ContextWrapper(context) {
            override fun getFilesDir() = root
        }
        try {
            val directory = File(root, "quick-text-outbox").apply { mkdirs() }
            val invalidId = "quick-text-00000000-0000-0000-0000-000000000000"
            val invalid = File(directory, "$invalidId.json")
            val original = JSONObject().put("noteId", invalidId).put("text", "retained thought")
                .put("createdAt", Long.MAX_VALUE).toString()
            invalid.writeText(original)
            val validId = "quick-text-ffffffff-ffff-ffff-ffff-ffffffffffff"
            QuickTextOutbox.save(isolated, validId, "later valid thought")

            assertEquals(listOf(validId), QuickTextOutbox.read(isolated).map { it.noteId })
            assertEquals(original, invalid.readText())
        } finally {
            root.deleteRecursively()
        }
    }

    @Test
    fun delayedResultCannotReplaceNewerPromptAndReplyIdentityStaysDistinct() {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(4202)
        var firstId: String? = null
        try {
            assertTrue(QuickTextCaptureReceiver.showReply(context))
            val first = awaitCapture(manager)
            firstId = first.extras.getString("captureId")!!
            assertTrue(QuickTextCaptureReceiver.showReply(context))
            val second = awaitCapture(manager, differentFrom = firstId)
            val secondId = second.extras.getString("captureId")!!
            assertNotEquals(first.actions.single().actionIntent, second.actions.single().actionIntent)
            val result = Notification.Builder(context, "quick-text-capture")
                .setSmallIcon(R.drawable.quick_capture_widget_write_icon)
                .setContentTitle("Saved result").build()
            QuickTextCaptureReceiver.notifySafely(context, firstId, result)
            assertEquals(secondId, awaitCapture(manager).extras.getString("captureId"))
            assertEquals("Write a thought", awaitCapture(manager).extras.getString(Notification.EXTRA_TITLE))
            QuickTextCaptureReceiver.notifySafely(context, firstId, result, retainIfStale = true)
            val failureDeadline = System.currentTimeMillis() + 2000
            while (manager.activeNotifications.none { it.tag == firstId } && System.currentTimeMillis() < failureDeadline) Thread.sleep(20)
            assertTrue(manager.activeNotifications.any { it.tag == firstId })
            assertEquals(secondId, awaitCapture(manager).extras.getString("captureId"))
            QuickTextCaptureReceiver.notifySafely(context, secondId, result)
            val deadline = System.currentTimeMillis() + 2000
            while (currentNotification(manager)?.extras?.getString(Notification.EXTRA_TITLE) != "Saved result" && System.currentTimeMillis() < deadline) Thread.sleep(20)
            assertEquals("Saved result", currentNotification(manager)?.extras?.getString(Notification.EXTRA_TITLE))
        } finally {
            manager.cancel(4202)
            firstId?.let { manager.cancel(it, 4202) }
        }
    }

    private fun currentNotification(manager: NotificationManager) = manager.activeNotifications.firstOrNull { it.id == 4202 && it.tag == null }?.notification

    private fun awaitCapture(manager: NotificationManager, differentFrom: String? = null): Notification {
        val deadline = System.currentTimeMillis() + 2000
        while (System.currentTimeMillis() < deadline) {
            val notification = currentNotification(manager)
            val id = notification?.extras?.getString("captureId")
            if (id != null && id != differentFrom) return notification
            Thread.sleep(20)
        }
        error("Capture notification did not appear")
    }
}
