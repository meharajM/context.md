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
            BackgroundSynthesisReadiness.evaluate(2L * GIB, lowMemory = false, thermalBusy = false, deviceInteractive = false),
        )
    }

    @Test
    fun `waits for available memory and thermal recovery`() {
        assertEquals(
            BackgroundSynthesisReadiness.Decision.WAIT,
            BackgroundSynthesisReadiness.evaluate(512L * MIB, lowMemory = false, thermalBusy = false, deviceInteractive = false),
        )
        assertEquals(
            BackgroundSynthesisReadiness.Decision.WAIT,
            BackgroundSynthesisReadiness.evaluate(2L * GIB, lowMemory = false, thermalBusy = true, deviceInteractive = false),
        )
        assertEquals(
            BackgroundSynthesisReadiness.Decision.WAIT,
            BackgroundSynthesisReadiness.evaluate(2L * GIB, lowMemory = true, thermalBusy = false, deviceInteractive = false),
        )
    }

    @Test
    fun `runs only when memory and thermal conditions are suitable`() {
        assertEquals(
            BackgroundSynthesisReadiness.Decision.READY,
            BackgroundSynthesisReadiness.evaluate(2L * GIB, lowMemory = false, thermalBusy = false, deviceInteractive = false),
        )
    }

    @Test
    fun `waits until screen is off before background synthesis`() {
        assertEquals(
            BackgroundSynthesisReadiness.Decision.WAIT,
            BackgroundSynthesisReadiness.evaluate(
                2L * GIB,
                lowMemory = false,
                thermalBusy = false,
                deviceInteractive = true,
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
