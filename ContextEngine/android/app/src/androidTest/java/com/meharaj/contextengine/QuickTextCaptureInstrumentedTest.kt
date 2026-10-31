package com.meharaj.contextengine

import android.app.Notification
import android.app.NotificationManager
import android.content.ContextWrapper
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.widget.TextView
import android.widget.FrameLayout
import android.widget.RemoteViews
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import kotlin.math.roundToInt

@RunWith(AndroidJUnit4::class)
class QuickTextCaptureInstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext

    @Test
    fun captureWidgetFitsItsMinimumAndExpandedWidths() {
        val appearances = listOf(false to 1f, true to 1f, false to 1.3f, true to 1.3f)
        appearances.forEach { (night, fontScale) ->
            val config = Configuration(context.resources.configuration).apply {
                uiMode = (uiMode and Configuration.UI_MODE_NIGHT_MASK.inv()) or
                    if (night) Configuration.UI_MODE_NIGHT_YES else Configuration.UI_MODE_NIGHT_NO
                this.fontScale = fontScale
            }
            val themed = android.view.ContextThemeWrapper(context.createConfigurationContext(config), R.style.AppTheme)
            val density = themed.resources.displayMetrics.density
            listOf(180 to 60, 180 to 100, 360 to 60, 360 to 100).forEach { (widthDp, heightDp) ->
                val widget = RemoteViews(context.packageName, R.layout.quick_capture_widget)
                    .apply(themed, FrameLayout(themed))
                val widthPx = (widthDp * density).roundToInt()
                val heightPx = (heightDp * density).roundToInt()
                fun measure() {
                    widget.measure(
                        View.MeasureSpec.makeMeasureSpec(widthPx, View.MeasureSpec.EXACTLY),
                        View.MeasureSpec.makeMeasureSpec(heightPx, View.MeasureSpec.EXACTLY),
                    )
                    widget.layout(0, 0, widthPx, heightPx)
                }
                fun preview(state: String) {
                    if (fontScale != 1f || heightDp != 100 ||
                        InstrumentationRegistry.getArguments().getString("captureWidgetPreviews") != "true") return
                    val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
                    widget.draw(Canvas(bitmap))
                    File(context.getExternalFilesDir(null), "widget-${if (night) "dark" else "light"}-$widthDp-$state.png")
                        .outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                    bitmap.recycle()
                }
                measure()
                assertEquals("Launcher height must not stretch capture controls", (60 * density).roundToInt(),
                    widget.findViewById<View>(R.id.quick_capture_widget_bar).height)
                listOf(
                    Triple(R.id.quick_capture_widget_button, R.id.quick_capture_widget_write_label, "Write"),
                    Triple(R.id.quick_record_widget_button, R.id.quick_capture_widget_record_label, "Record"),
                ).forEach { (viewId, labelId, label) ->
                    val button = widget.findViewById<View>(viewId)
                    val text = widget.findViewById<TextView>(labelId)
                    assertEquals(label, text.text.toString())
                    assertTrue("$label needs a 48dp target",
                        button.height >= (48 * density).roundToInt() && button.width >= (48 * density).roundToInt())
                    assertEquals("$label must not truncate at $widthDp dp and font scale $fontScale", 0, text.layout.getEllipsisCount(0))
                    assertTrue("$label must fit at $widthDp dp and font scale $fontScale",
                        text.left >= 0 && text.right <= button.width)
                    assertTrue("$label needs an accessible description", !button.contentDescription.isNullOrBlank())
                }
                preview("idle")
                widget.findViewById<View>(R.id.quick_capture_widget_idle).visibility = View.GONE
                widget.findViewById<View>(R.id.quick_capture_widget_recording).visibility = View.VISIBLE
                val timer = widget.findViewById<TextView>(R.id.quick_capture_widget_timer)
                timer.text = "1:23:45"
                measure()
                assertTrue("Stop remains a 48dp target",
                    widget.findViewById<View>(R.id.quick_capture_widget_stop).height >= (48 * density).roundToInt())
                assertTrue("Long recording counter must fit", timer.layout.getLineWidth(0) <= timer.width)
                timer.text = "0:18"
                measure()
                preview("recording")
                listOf(R.id.quick_capture_widget_timer, R.id.quick_capture_widget_stop, R.id.quick_capture_widget_live_dot)
                    .forEach { widget.findViewById<View>(it).visibility = View.GONE }
                widget.findViewById<View>(R.id.quick_capture_widget_recording_label).visibility = View.VISIBLE
                widget.findViewById<View>(R.id.quick_capture_widget_progress).visibility = View.VISIBLE
                measure()
                preview("saving")
            }
        }
    }

    @Test
    fun compactWidgetKeepsAccessibleActionsAtLargeTextSize() {
        val config = Configuration(context.resources.configuration).apply { fontScale = 2f }
        val themed = android.view.ContextThemeWrapper(context.createConfigurationContext(config), R.style.AppTheme)
        val widget = QuickCaptureWidgetProvider.remoteViews(themed, 0).apply(themed, FrameLayout(themed))
        val density = themed.resources.displayMetrics.density
        widget.measure(
            View.MeasureSpec.makeMeasureSpec((180 * density).roundToInt(), View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec((60 * density).roundToInt(), View.MeasureSpec.EXACTLY),
        )
        widget.layout(0, 0, widget.measuredWidth, widget.measuredHeight)
        listOf(R.id.quick_capture_widget_record_label, R.id.quick_capture_widget_write_label).forEach {
            assertEquals(View.GONE, widget.findViewById<View>(it).visibility)
        }
        listOf(R.id.quick_record_widget_button, R.id.quick_capture_widget_button).forEach {
            val action = widget.findViewById<View>(it)
            assertTrue(action.width >= (48 * density).roundToInt() && action.height >= (48 * density).roundToInt())
            assertTrue(!action.contentDescription.isNullOrBlank())
        }
    }

    @Test
    fun incomingShareStaysPendingUntilTheUserSavesIt() {
        val root = File(context.cacheDir, "share-outbox-test-${UUID.randomUUID()}").apply { mkdirs() }
        val isolated = object : ContextWrapper(context) {
            override fun getFilesDir() = root
        }
        try {
            val entry = IncomingShareOutbox.save(isolated, "  text shared from another app  ")
            assertEquals("text shared from another app", entry.text)
            assertEquals(listOf(entry), IncomingShareOutbox.read(isolated))
            IncomingShareOutbox.acknowledge(isolated, entry.id)
            assertTrue(IncomingShareOutbox.read(isolated).isEmpty())
        } finally {
            root.deleteRecursively()
        }
    }

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
