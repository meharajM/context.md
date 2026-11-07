package com.meharaj.contextengine

import android.app.Notification
import android.app.NotificationManager
import android.Manifest
import android.content.Intent
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.SystemClock
import android.os.Build
import android.view.View
import android.widget.EditText
import android.widget.TextView
import android.widget.FrameLayout
import android.widget.RemoteViews
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.WorkManager
import com.facebook.react.ReactApplication
import com.facebook.react.jstasks.HeadlessJsTaskContext
import org.junit.Assert.*
import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.TimeUnit
import kotlin.math.roundToInt

@RunWith(AndroidJUnit4::class)
class QuickTextCaptureInstrumentedTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext

    private fun allowTestNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            InstrumentationRegistry.getInstrumentation().uiAutomation
                .executeShellCommand("pm grant ${context.packageName} ${Manifest.permission.POST_NOTIFICATIONS}").close()
        }
    }

    @Test(timeout = 360_000)
    fun whisperDownloadContinuesAfterTheAppIsBackgrounded() {
        allowTestNotifications()
        val model = File(context.filesDir, "models/whisper-tiny.en-q5_1.bin")
        val temporaryDownload = File(model.absolutePath + ".download")
        val activeChunk = File(temporaryDownload.absolutePath + ".part")
        activeChunk.delete()
        temporaryDownload.delete()
        model.delete()

        val workManager = WorkManager.getInstance(context)
        val uniqueWorkName = "context-engine-whisper-download"
        workManager.cancelUniqueWork(uniqueWorkName).result.get(15, TimeUnit.SECONDS)
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        var mainActivity: android.app.Activity? = null
        try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: error("Could not resolve the isolated test app's launcher activity")
            mainActivity = instrumentation.startActivitySync(launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            val reactApplication = context as ReactApplication
            val reactDeadline = SystemClock.uptimeMillis() + 45_000
            while (reactApplication.reactHost?.currentReactContext?.hasActiveReactInstance() != true &&
                SystemClock.uptimeMillis() < reactDeadline) {
                SystemClock.sleep(250)
            }
            check(reactApplication.reactHost?.currentReactContext?.hasActiveReactInstance() == true) {
                "React Native did not become ready for background voice-model download"
            }
            val downloadDeadline = SystemClock.uptimeMillis() + TimeUnit.SECONDS.toMillis(60)
            while ((!activeChunk.isFile || activeChunk.length() == 0L) && !model.isFile &&
                SystemClock.uptimeMillis() < downloadDeadline) {
                SystemClock.sleep(100)
            }
            assertTrue("Whisper download must start before the app is backgrounded", activeChunk.isFile && activeChunk.length() > 0)
            instrumentation.runOnMainSync { mainActivity!!.moveTaskToBack(true) }

            val notifications = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val deadline = SystemClock.uptimeMillis() + TimeUnit.MINUTES.toMillis(5)
            var sawForegroundNotification = false
            while ((!sawForegroundNotification || model.length() != 32_166_155L) && SystemClock.uptimeMillis() < deadline) {
                sawForegroundNotification = sawForegroundNotification || notifications.activeNotifications.any {
                    it.notification.extras.getCharSequence(Notification.EXTRA_TITLE) == "Downloading on-device model"
                }
                SystemClock.sleep(100)
            }

            assertTrue("Whisper must download with no target Activity active", model.length() == 32_166_155L)
            assertTrue("The background voice download must expose its foreground notification", sawForegroundNotification)
            val actualSha256 = MessageDigest.getInstance("SHA-256").digest(model.readBytes())
                .joinToString("") { "%02x".format(it.toInt() and 0xff) }
            assertEquals("Downloaded Whisper must pass the pinned SHA-256 check", "c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b", actualSha256)

            val reactContext = checkNotNull(reactApplication.reactHost?.currentReactContext)
            val headlessTasks = HeadlessJsTaskContext.getInstance(reactContext)
            val taskDeadline = SystemClock.uptimeMillis() + 45_000
            while (headlessTasks.hasActiveTasks() && SystemClock.uptimeMillis() < taskDeadline) SystemClock.sleep(250)
            assertFalse("Background voice download must release its Headless JS task", headlessTasks.hasActiveTasks())
        } finally {
            instrumentation.runOnMainSync { mainActivity?.finish() }
            workManager.cancelUniqueWork(uniqueWorkName).result.get(15, TimeUnit.SECONDS)
        }
    }

    @Test(timeout = 360_000)
    fun widgetWriteCaptureRunsReminderAndSynthesisInBackground() {
        val model = File(context.filesDir, "models/gemma3-1b-it-int4.litertlm")
        org.junit.Assume.assumeTrue("Install the verified Gemma model under app-private files/models", model.isFile)

        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val previousReminderState = File(context.filesDir, "automatic-reminders.json")
            .takeIf(File::isFile)?.readBytes()
        var mainActivity: android.app.Activity? = null
        var captureActivity: QuickCaptureActivity? = null
        val noteText = "For Saturday’s community garden workday, confirm compost delivery, invite neighbors, and label the native seed trays before volunteers arrive."
        val topics = File(context.filesDir, "topics").apply { mkdirs() }
        val topicId = "widget-garden-${UUID.randomUUID()}"
        val topicFile = File(topics, "$topicId.md")
        val createdAt = java.time.Instant.now().toString()
        val seedText = "Coordinate monthly volunteer days for the community garden and keep compost, seeds, and planting tools ready."
        val metadata = JSONObject().put("noteId", topicId).put("createdAt", createdAt).put("updatedAt", createdAt)
            .put("sourceMetadata", JSONObject().put("kind", "text").put("transcript", seedText).put("noteId", topicId))
        topicFile.writeText("# Community Garden\n\n- [$createdAt] <!-- thought-note:v2 $metadata -->\n  | $seedText\n  <!-- /thought-note -->\n")

        try {
            AutomaticReminderScheduler(context).setEnabled(true)
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
                ?: error("Could not resolve the isolated test app's launcher activity")
            mainActivity = instrumentation.startActivitySync(launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            val reactApplication = context as ReactApplication
            val reactDeadline = SystemClock.uptimeMillis() + 45_000
            while (reactApplication.reactHost?.currentReactContext?.hasActiveReactInstance() != true &&
                SystemClock.uptimeMillis() < reactDeadline) {
                SystemClock.sleep(250)
            }
            check(reactApplication.reactHost?.currentReactContext?.hasActiveReactInstance() == true) {
                "React Native did not become ready for background capture"
            }
            instrumentation.runOnMainSync { mainActivity!!.moveTaskToBack(true) }
            val whisperModel = File(context.filesDir, "models/whisper-tiny.en-q5_1.bin")
            val downloadDeadline = SystemClock.uptimeMillis() + 180_000
            while (whisperModel.length() != 32_166_155L && SystemClock.uptimeMillis() < downloadDeadline) {
                SystemClock.sleep(500)
            }
            assertEquals("Whisper download must finish while the app is minimized", 32_166_155L, whisperModel.length())
            val reactContext = checkNotNull(reactApplication.reactHost?.currentReactContext)
            val headlessTasks = HeadlessJsTaskContext.getInstance(reactContext)
            val taskDeadline = SystemClock.uptimeMillis() + 45_000
            while (headlessTasks.hasActiveTasks() && SystemClock.uptimeMillis() < taskDeadline) SystemClock.sleep(250)
            assertFalse("A completed download must release its Headless JS task", headlessTasks.hasActiveTasks())

            val captureIntent = Intent(context, QuickCaptureActivity::class.java).apply {
                action = QuickCaptureActivity.ACTION_WRITE
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            captureActivity = instrumentation.startActivitySync(captureIntent) as QuickCaptureActivity
            instrumentation.runOnMainSync {
                captureActivity!!.findViewById<EditText>(R.id.quick_capture_input).setText(noteText)
                captureActivity!!.findViewById<TextView>(R.id.quick_capture_save).performClick()
            }
            instrumentation.runOnMainSync { mainActivity!!.moveTaskToBack(true) }

            val deadline = SystemClock.uptimeMillis() + 300_000
            var categorized: File? = null
            while (SystemClock.uptimeMillis() < deadline) {
                categorized = topics.listFiles().orEmpty().firstOrNull { file ->
                    !file.name.equals("inbox.md", ignoreCase = true) && runCatching { file.readText().contains(noteText) }.getOrDefault(false)
                }
                val stillInInbox = File(topics, "inbox.md").takeIf(File::isFile)?.readText()?.contains(noteText) == true
                if (categorized != null && !stillInInbox && QuickTextOutbox.read(context).none { it.text == noteText }) break
                SystemClock.sleep(500)
            }
            val result = categorized?.readText().orEmpty()
            assertTrue("Widget text must be synthesized into a topic while the app is backgrounded; outbox=${QuickTextOutbox.read(context)}",
                categorized != null && !File(topics, "inbox.md").takeIf(File::isFile)?.readText().orEmpty().contains(noteText))
            assertTrue("The synthesized topic must retain the captured source transcript", result.contains("\"transcript\":\"$noteText\""))
        } finally {
            instrumentation.runOnMainSync {
                captureActivity?.finish()
                mainActivity?.finish()
            }
            AutomaticReminderScheduler(context).setEnabled(false)
            if (previousReminderState != null) File(context.filesDir, "automatic-reminders.json").writeBytes(previousReminderState)
        }
    }

    @Test(timeout = 900_000)
    fun synthesisModelDownloadContinuesWithoutAnActiveApp() {
        allowTestNotifications()

        val model = File(context.filesDir, "models/gemma3-1b-it-int4.litertlm")
        model.delete()
        File(context.cacheDir, "litertlm-cache/gemma3-1b-it").deleteRecursively()

        val workManager = WorkManager.getInstance(context)
        val uniqueWorkName = "context-engine-model-download-gemma3-1b-it"
        workManager.cancelUniqueWork(uniqueWorkName).result.get(15, TimeUnit.SECONDS)
        try {
            BackgroundSynthesisWorker.enqueueModelDownloads(context, "gemma3-1b-it", false)
                .single().result.get(15, TimeUnit.SECONDS)

            val notifications = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val deadline = SystemClock.uptimeMillis() + TimeUnit.MINUTES.toMillis(10)
            var sawForegroundNotification = false
            while (model.length() != 584_417_280L && SystemClock.uptimeMillis() < deadline) {
                sawForegroundNotification = sawForegroundNotification || notifications.activeNotifications.any {
                    it.notification.extras.getCharSequence(Notification.EXTRA_TITLE) == "Downloading on-device model"
                }
                SystemClock.sleep(250)
            }

            assertTrue("Model download must expose its foreground notification", sawForegroundNotification)
            assertEquals("Model download must finish while no app Activity is active", 584_417_280L, model.length())
            val actualSha256 = MessageDigest.getInstance("SHA-256").let { digest ->
                model.inputStream().use { input ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val count = input.read(buffer)
                        if (count < 0) break
                        digest.update(buffer, 0, count)
                    }
                }
                digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
            }
            assertEquals("Downloaded model must pass the pinned SHA-256 check", "1325ae366d31950f137c9c357b9fa89448b176d76998180c08ceaca78bba98be", actualSha256)
        } finally {
            workManager.cancelUniqueWork(uniqueWorkName).result.get(15, TimeUnit.SECONDS)
        }
    }

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
