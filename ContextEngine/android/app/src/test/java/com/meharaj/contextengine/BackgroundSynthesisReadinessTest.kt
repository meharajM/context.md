package com.meharaj.contextengine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BackgroundSynthesisReadinessTest {
    @Test
    fun `allows synthesis when current resources are suitable`() {
        assertEquals(
            BackgroundSynthesisReadiness.Decision.READY,
            BackgroundSynthesisReadiness.evaluate(2L * GIB, lowMemory = false, thermalBusy = false),
        )
    }

    @Test
    fun `waits for available memory and thermal recovery`() {
        assertEquals(
            BackgroundSynthesisReadiness.Decision.WAIT,
            BackgroundSynthesisReadiness.evaluate(512L * MIB, lowMemory = false, thermalBusy = false),
        )
        assertEquals(
            BackgroundSynthesisReadiness.Decision.WAIT,
            BackgroundSynthesisReadiness.evaluate(2L * GIB, lowMemory = false, thermalBusy = true),
        )
        assertEquals(
            BackgroundSynthesisReadiness.Decision.WAIT,
            BackgroundSynthesisReadiness.evaluate(2L * GIB, lowMemory = true, thermalBusy = false),
        )
    }

    @Test
    fun `runs only when memory and thermal conditions are suitable`() {
        assertEquals(
            BackgroundSynthesisReadiness.Decision.READY,
            BackgroundSynthesisReadiness.evaluate(2L * GIB, lowMemory = false, thermalBusy = false),
        )
    }

    @Test
    fun `allows background synthesis while the screen is on`() {
        assertEquals(
            BackgroundSynthesisReadiness.Decision.READY,
            BackgroundSynthesisReadiness.evaluate(
                2L * GIB,
                lowMemory = false,
                thermalBusy = false,
            ),
        )
    }

    @Test
    fun `constrains background scheduling by power and storage`() {
        val constraints = BackgroundSynthesisWorker.constraints()

        assertFalse(constraints.requiresDeviceIdle())
        assertTrue(constraints.requiresBatteryNotLow())
        assertTrue(constraints.requiresStorageNotLow())
    }

    private companion object {
        const val GIB = 1024L * 1024L * 1024L
        const val MIB = 1024L * 1024L
    }
}
