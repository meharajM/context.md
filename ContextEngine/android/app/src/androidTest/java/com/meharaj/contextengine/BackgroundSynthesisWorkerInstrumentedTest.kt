package com.meharaj.contextengine

import android.content.Context
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.work.ListenableWorker
import androidx.work.testing.TestWorkerBuilder
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class BackgroundSynthesisWorkerInstrumentedTest {
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
                .firstOrNull { it.readText().contains("Note id: $noteId") }
            val sourceRemainsInInbox = File(context.filesDir, "topics/inbox.md")
                .takeIf(File::isFile)
                ?.readText()
                ?.contains("Note id: $noteId") == true

            assertTrue("The background task must persist the categorized note", categorizedNote != null)
            assertTrue(
                "The original capture must remain available as source metadata",
                categorizedNote?.readText()?.contains("Source transcript: $noteText") == true,
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
