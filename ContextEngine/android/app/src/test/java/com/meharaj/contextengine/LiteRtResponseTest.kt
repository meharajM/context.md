package com.meharaj.contextengine

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import org.junit.Assert.*
import org.junit.Test

class LiteRtResponseTest {
    @Test
    fun `streamed chunks form complete JSON without cancelling successful inference`() = runBlocking {
        var cancelled = false
        val result = collectLiteRtResponse(
            flowOf("{\"topic\":", "\"Work\"}"),
            1_000,
        ) { cancelled = true }

        assertEquals("{\"topic\":\"Work\"}", result)
        assertFalse(cancelled)
    }

    @Test
    fun `timeout cancels native inference before conversation closes`() = runBlocking {
        val cleanup = mutableListOf<String>()
        val conversation = AutoCloseable { cleanup.add("close") }
        try {
            conversation.use {
                collectLiteRtResponse(flow { awaitCancellation() }, 25) { cleanup.add("cancel") }
            }
            fail("Expected synthesis timeout")
        } catch (_: TimeoutCancellationException) {
            assertEquals(listOf("cancel", "close"), cleanup)
        }
    }

    @Test
    fun `runtime failure is preserved when native cancellation also fails`() = runBlocking {
        val failure = IllegalStateException("native inference failed")
        val cleanupFailure = IllegalStateException("native cancellation failed")
        try {
            collectLiteRtResponse(flow { throw failure }, 1_000) { throw cleanupFailure }
            fail("Expected inference failure")
        } catch (error: IllegalStateException) {
            assertEquals(failure.message, error.message)
            assertArrayEquals(arrayOf(cleanupFailure), error.suppressed)
        }
    }

    @Test
    fun `native library errors cancel inference and remain recoverable`() = runBlocking {
        val failure = UnsatisfiedLinkError("native library missing")
        var cancelled = false
        try {
            collectLiteRtResponse(flow { throw failure }, 1_000) { cancelled = true }
            fail("Expected native library error")
        } catch (error: UnsatisfiedLinkError) {
            assertEquals(failure.message, error.message)
            assertTrue(cancelled)
        }
    }

    @Test
    fun `module cancellation stops native inference`() = runBlocking {
        val started = CompletableDeferred<Unit>()
        var cancelled = false
        val job = launch {
            collectLiteRtResponse(flow {
                started.complete(Unit)
                awaitCancellation()
            }, 1_000) { cancelled = true }
        }
        started.await()
        job.cancelAndJoin()
        assertTrue(cancelled)
    }
}
