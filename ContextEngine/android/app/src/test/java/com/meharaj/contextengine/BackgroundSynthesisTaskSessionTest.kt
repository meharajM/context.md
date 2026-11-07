package com.meharaj.contextengine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.TimeUnit

class BackgroundSynthesisTaskSessionTest {
    @Test
    fun `explicit JavaScript result wakes worker without waiting for task lifecycle callback`() {
        val session = BackgroundSynthesisTaskSession()

        assertTrue(session.report(retry = false))

        assertTrue(session.awaitResultReported(0, TimeUnit.MILLISECONDS))
        assertFalse(session.awaitFinished(0, TimeUnit.MILLISECONDS))
        assertEquals(BackgroundSynthesisTaskSession.RESULT_COMPLETED, session.result())
    }

    @Test
    fun `only matching headless task completion releases worker`() {
        val session = BackgroundSynthesisTaskSession()
        session.onTaskStarted(42)

        session.onTaskFinished(41)
        assertFalse(session.awaitFinished(0, TimeUnit.MILLISECONDS))

        session.onTaskFinished(42)
        assertTrue(session.awaitFinished(0, TimeUnit.MILLISECONDS))
    }

    @Test
    fun `worker succeeds only after JavaScript reports completed result`() {
        val session = BackgroundSynthesisTaskSession()
        session.report(retry = false)
        session.onTaskStarted(7)
        session.onTaskFinished(7)

        assertTrue(session.awaitResultReported(0, TimeUnit.MILLISECONDS))
        assertEquals(BackgroundSynthesisTaskSession.RESULT_COMPLETED, session.result())
    }

    @Test
    fun `missing or retry report keeps worker result retryable`() {
        val session = BackgroundSynthesisTaskSession()
        assertEquals(BackgroundSynthesisTaskSession.RESULT_RETRY, session.result())
        assertTrue(session.report(retry = true))
        assertFalse(session.report(retry = false))
        assertTrue(session.awaitResultReported(0, TimeUnit.MILLISECONDS))
        assertEquals(BackgroundSynthesisTaskSession.RESULT_RETRY, session.result())
    }

    @Test
    fun `capture and synthesis workers report to their own sessions`() {
        val synthesis = BackgroundSynthesisTaskCoordinator.begin("synthesis-1", captureProcessing = false)!!
        val capture = BackgroundSynthesisTaskCoordinator.begin("capture-1", captureProcessing = true)!!
        assertEquals(null, BackgroundSynthesisTaskCoordinator.begin("synthesis-2", captureProcessing = false))
        try {
            assertTrue(BackgroundSynthesisTaskCoordinator.report("capture-1", retry = false))
            assertTrue(BackgroundSynthesisTaskCoordinator.report("synthesis-1", retry = true))
            assertEquals(BackgroundSynthesisTaskSession.RESULT_COMPLETED, capture.result())
            assertEquals(BackgroundSynthesisTaskSession.RESULT_RETRY, synthesis.result())
        } finally {
            BackgroundSynthesisTaskCoordinator.finish("synthesis-1", synthesis)
            BackgroundSynthesisTaskCoordinator.finish("capture-1", capture)
        }
    }
}
