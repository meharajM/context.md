package com.meharaj.contextengine

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker
import androidx.work.testing.TestWorkerBuilder
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class BackgroundSynthesisWorkerInstrumentedTest {
    @Test(timeout = 180_000)
    fun coldStartedWorkerRecoversWidgetVoiceTranscribesAndFilesIt() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
        val models = File(context.filesDir, "models")
        assumeTrue("Install the verified Gemma model into app-private files/models to run this test", File(models, "gemma3-1b-it-int4.litertlm").isFile)
        assumeTrue("Install Whisper into app-private files/models to run this test", File(models, "whisper-tiny.en-q5_1.bin").length() == 32_166_155L)

        val audioName = "contextengine-retained-voice-widget-${UUID.randomUUID()}.wav"
        val noteId = "voice-retained-${audioName.removePrefix("contextengine-retained-").removeSuffix(".wav")}"
        val inbox = File(context.filesDir, "topics/inbox.md")
        inbox.delete()
        File(context.filesDir, "retained-audio").deleteRecursively()
        val audio = File(context.filesDir, "retained-audio/$audioName")
        audio.parentFile?.mkdirs()
        InstrumentationRegistry.getInstrumentation().context.assets.open("jfk-retained.wav").use { input ->
            audio.outputStream().use(input::copyTo)
        }
        val timestamp = "2026-11-02T00:00:00.000Z"
        val sourceMetadata = JSONObject()
            .put("kind", "voice")
            .put("transcript", "Voice capture retained")
            .put("noteId", noteId)
            .put("audioFilePath", audio.absolutePath)
            .put("transcriptionError", "Background transcription pending")
        val metadata = JSONObject()
            .put("noteId", noteId)
            .put("createdAt", timestamp)
            .put("updatedAt", timestamp)
            .put("sourceMetadata", sourceMetadata)
        inbox.parentFile?.mkdirs()
        inbox.writeText(
            "# Inbox\n\n- [$timestamp] <!-- thought-note:v2 $metadata -->\n" +
                "  | Voice capture retained\n  <!-- /thought-note -->\n",
        )
        File(audio.absolutePath + ".capture.json").writeText(
            JSONObject()
                .put("version", 1)
                .put("noteId", noteId)
                .put("audioPath", audio.absolutePath)
                .put("sampleRate", 16_000)
                .put("channels", 1)
                .put("bitsPerSample", 16)
                .toString(),
        )

        val executor = Executors.newSingleThreadExecutor()
        try {
            val worker = TestWorkerBuilder<BackgroundSynthesisWorker>(context, executor).build()
            val result = worker.doWork()
            assertTrue("Expected voice worker success but got $result", result is ListenableWorker.Result.Success)

            val topicFiles = File(context.filesDir, "topics").listFiles().orEmpty()
                .filter { it.extension.equals("md", ignoreCase = true) }
            val categorized = topicFiles.filterNot { it.name.equals("inbox.md", ignoreCase = true) }
                .firstOrNull { it.readText().contains("\"noteId\":\"$noteId\"") }
            val categorizedText = categorized?.readText().orEmpty()
            val metadataLine = categorizedText.lineSequence().firstOrNull {
                "thought-note:v2" in it && "\"noteId\":\"$noteId\"" in it
            }
            val filedTranscript = metadataLine?.substringAfter("thought-note:v2 ")
                ?.substringBefore(" -->")
                ?.let { JSONObject(it).optJSONObject("sourceMetadata")?.optString("transcript") }
            val sourceRemainsInInbox = inbox.takeIf(File::isFile)?.readText()?.contains(noteId) == true

            assertTrue("The spoken note must be transcribed and filed by the headless worker", categorized != null)
            assertTrue("Voice source metadata must preserve a recognizable transcript", filedTranscript?.contains("ask not", ignoreCase = true) == true)
            assertFalse("The source must leave Inbox only after the topic copy is durable", sourceRemainsInInbox)
            assertFalse("The recovered audio must be cleaned up after successful filing", audio.exists())
            assertFalse("The completed recovery descriptor must be acknowledged", File(audio.absolutePath + ".capture.json").exists())
        } finally {
            executor.shutdownNow()
            executor.awaitTermination(5, TimeUnit.SECONDS)
        }
    }

    @Test(timeout = 180_000)
    fun coldStartedWorkerRunsHeadlessSynthesisAndFilesDurableInboxNote() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
        val model = File(context.filesDir, "models/gemma3-1b-it-int4.litertlm")
        assumeTrue("Install the verified Gemma model into app-private files/models to run this test", model.isFile)

        val noteId = "worker-test-${UUID.randomUUID()}"
        val noteText = "Remember to send the Acme client invoice tomorrow morning."
        appendInboxNote(context, noteId, noteText)

        val executor = Executors.newSingleThreadExecutor()
        try {
            val worker = TestWorkerBuilder<BackgroundSynthesisWorker>(context, executor).build()
            val result = worker.doWork()
            assertTrue("Expected worker success but got $result", result is ListenableWorker.Result.Success)

            val topicFiles = File(context.filesDir, "topics").listFiles().orEmpty()
                .filter { it.extension.equals("md", ignoreCase = true) }
            val categorizedNote = topicFiles.filterNot { it.name.equals("inbox.md", ignoreCase = true) }
                .firstOrNull { it.readText().contains("\"noteId\":\"$noteId\"") }
            val sourceRemainsInInbox = File(context.filesDir, "topics/inbox.md")
                .takeIf(File::isFile)
                ?.readText()
                ?.contains("Note id: $noteId") == true

            assertTrue("The background task must persist the categorized note", categorizedNote != null)
            assertTrue(
                "The original capture must remain available as source metadata",
                categorizedNote?.readText()?.contains("\"transcript\":\"$noteText\"") == true,
            )
            assertFalse("The Inbox source must remain until its categorized copy is durable", sourceRemainsInInbox)
        } finally {
            executor.shutdownNow()
            executor.awaitTermination(5, TimeUnit.SECONDS)
        }
    }

    private fun appendInboxNote(context: Context, noteId: String, text: String) {
        val inbox = File(context.filesDir, "topics/inbox.md")
        inbox.parentFile?.mkdirs()
        val existing = inbox.takeIf(File::isFile)?.readText().orEmpty()
        val timestamp = "2026-10-18T12:00:00.000Z"
        inbox.writeText(
            existing.trimEnd() +
                "\n\n- [$timestamp] $text\n" +
                "  Note id: $noteId\n" +
                "  Created at: $timestamp\n" +
                "  Updated at: $timestamp\n" +
                "  Source kind: TEXT\n" +
                "  Source transcript: $text\n" +
                "  Source note id: $noteId\n",
        )
    }
}
