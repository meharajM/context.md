package com.meharaj.contextengine

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.os.SystemClock
import androidx.core.content.ContextCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.rule.GrantPermissionRule
import androidx.work.WorkManager
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class WidgetVoiceCaptureInstrumentedTest {
    @get:Rule
    val microphonePermission: GrantPermissionRule = GrantPermissionRule.grant(Manifest.permission.RECORD_AUDIO)

    @Test(timeout = 120_000)
    fun backgroundCaptureFinalizesDurableAudioAndQueuesSynthesis() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext.applicationContext
        val workManager = WorkManager.getInstance(context)
        val audioDirectory = File(context.filesDir, "retained-audio")
        val existingNames = audioDirectory.listFiles().orEmpty().mapTo(mutableSetOf()) { it.name }
        val existingWorkIds = workManager.getWorkInfosForUniqueWork(BACKGROUND_SYNTHESIS_WORK_NAME)
            .get(15, TimeUnit.SECONDS)
            .mapTo(mutableSetOf()) { it.id }
        var activity: Activity? = null
        var capturedAudio: File? = null
        var enqueuedWork: androidx.work.WorkInfo? = null

        try {
            val captureIntent = Intent(context, QuickCaptureActivity::class.java)
                .setAction(QuickCaptureActivity.ACTION_MIC_PERMISSION)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            activity = instrumentation.startActivitySync(captureIntent)

            ContextCompat.startForegroundService(
                context,
                Intent(context, WidgetVoiceCaptureService::class.java)
                    .setAction(WidgetVoiceCaptureService.ACTION_START),
            )
            assertTrue("The microphone service should enter recording state", waitUntil(15_000) {
                WidgetVoiceCaptureService.recordingStartedAtElapsed != null
            })
            val activeAudio = audioDirectory.listFiles().orEmpty().firstOrNull { file ->
                file.name !in existingNames && file.name.endsWith(".wav")
            }
            assertNotNull("The active recording should already have its durable WAV", activeAudio)
            capturedAudio = checkNotNull(activeAudio)
            assertTrue("The active recording should already have its recovery descriptor", File(capturedAudio.absolutePath + ".capture.json").isFile)
            assertEqualsAscii("RIFF", capturedAudio.readBytes(), 0)
            instrumentation.runOnMainSync { activity!!.moveTaskToBack(true) }
            SystemClock.sleep(2_000)

            context.startService(
                Intent(context, WidgetVoiceCaptureService::class.java)
                    .setAction(WidgetVoiceCaptureService.ACTION_STOP),
            )
            assertTrue("The microphone service should finish after Stop", waitUntil(15_000) {
                WidgetVoiceCaptureService.recordingStartedAtElapsed == null && !WidgetVoiceCaptureService.isFinalizing
            })

            val audio = audioDirectory.listFiles().orEmpty().firstOrNull { file ->
                file.name !in existingNames && file.name.endsWith(".wav")
            }
            assertNotNull("Stop should persist a retained WAV", audio)
            capturedAudio = checkNotNull(audio)
            val wav = capturedAudio.readBytes()
            assertTrue("The WAV should contain PCM beyond its header", wav.size > 44)
            assertEqualsAscii("RIFF", wav, 0)
            assertEqualsAscii("WAVE", wav, 8)
            assertEqualsAscii("data", wav, 36)

            val noteId = "voice-retained-${capturedAudio.name.removePrefix("contextengine-retained-").removeSuffix(".wav")}"
            val descriptor = File(capturedAudio.absolutePath + ".capture.json")
            val noteExists = {
                File(context.filesDir, "topics").listFiles().orEmpty().any { file ->
                    file.extension.equals("md", ignoreCase = true) && runCatching { file.readText().contains(noteId) }.getOrDefault(false)
                }
            }
            assertTrue(
                "The audio must remain recoverable until background processing persists its Inbox note",
                waitUntil(15_000) { descriptor.isFile || noteExists() },
            )
            val recovery = descriptor.takeIf(File::isFile)?.let { JSONObject(it.readText()) }
            if (recovery != null) {
                assertEquals(noteId, recovery.getString("noteId"))
                assertEquals(capturedAudio.absolutePath, recovery.getString("audioPath"))
            }
            assertFalse("The file should not be left in its temporary recording state", audioDirectory.listFiles().orEmpty().any {
                it.name !in existingNames && it.name.endsWith(".part")
            })

            val workDeadline = SystemClock.uptimeMillis() + 15_000
            var newWork = emptyList<androidx.work.WorkInfo>()
            while (newWork.isEmpty() && SystemClock.uptimeMillis() < workDeadline) {
                newWork = workManager.getWorkInfosForUniqueWork(BACKGROUND_SYNTHESIS_WORK_NAME)
                    .get(5, TimeUnit.SECONDS)
                    .filterNot { it.id in existingWorkIds }
                if (newWork.isEmpty()) SystemClock.sleep(100)
            }
            assertTrue("Stop should enqueue durable background synthesis", newWork.isNotEmpty())
            enqueuedWork = newWork.first()
        } finally {
            if (WidgetVoiceCaptureService.recordingStartedAtElapsed != null) {
                runCatching {
                    context.startService(
                        Intent(context, WidgetVoiceCaptureService::class.java)
                            .setAction(WidgetVoiceCaptureService.ACTION_STOP),
                    )
                }
                waitUntil(15_000) {
                    WidgetVoiceCaptureService.recordingStartedAtElapsed == null && !WidgetVoiceCaptureService.isFinalizing
                }
            }
            enqueuedWork?.let { runCatching { workManager.cancelWorkById(it.id).result.get(15, TimeUnit.SECONDS) } }
            capturedAudio?.let {
                it.delete()
                File(it.absolutePath + ".capture.json").delete()
            }
            instrumentation.runOnMainSync { activity?.finish() }
        }
    }

    private fun waitUntil(timeoutMs: Long, condition: () -> Boolean): Boolean {
        val deadline = SystemClock.uptimeMillis() + timeoutMs
        while (!condition() && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(100)
        return condition()
    }

    private fun assertEqualsAscii(expected: String, bytes: ByteArray, offset: Int) {
        assertTrue("WAV is too short to contain $expected", bytes.size >= offset + expected.length)
        assertTrue("Expected $expected WAV chunk", expected.toByteArray(Charsets.US_ASCII).contentEquals(bytes.copyOfRange(offset, offset + expected.length)))
    }
}
