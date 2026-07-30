package com.meharaj.contextengine

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HeadsetTriplePressGateTest {
    @Test
    fun `three raw taps inside the window trigger once`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(elapsedRealtime = { now })

        assertFalse(gate.recordRawTap())
        now += 400L
        assertFalse(gate.recordRawTap())
        now += 400L
        assertTrue(gate.recordRawTap())
    }

    @Test
    fun `raw taps outside the window do not form a triple press`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(elapsedRealtime = { now })

        assertFalse(gate.recordRawTap())
        now += 700L
        assertFalse(gate.recordRawTap())
        now += 700L
        assertFalse(gate.recordRawTap())
    }

    @Test
    fun `mapped skip-back commands are debounced`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(elapsedRealtime = { now })

        assertTrue(gate.recordMappedTriplePress())
        now += 1_499L
        assertFalse(gate.recordMappedTriplePress())
        now += 1L
        assertTrue(gate.recordMappedTriplePress())
    }

    @Test
    fun `mapped command suppresses a duplicate raw triple`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(elapsedRealtime = { now })

        assertTrue(gate.recordMappedTriplePress())
        now += 200L
        assertFalse(gate.recordRawTap())
        now += 200L
        assertFalse(gate.recordRawTap())
        now += 200L
        assertFalse(gate.recordRawTap())
    }

    @Test
    fun `reset clears partial taps and debounce state`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(elapsedRealtime = { now })

        assertTrue(gate.recordMappedTriplePress())
        gate.reset()
        assertTrue(gate.recordMappedTriplePress())

        gate.reset()
        assertFalse(gate.recordRawTap())
        now += 300L
        assertFalse(gate.recordRawTap())
        gate.reset()
        now += 300L
        assertFalse(gate.recordRawTap())
    }
}
