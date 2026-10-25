package com.meharaj.contextengine

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HeadsetTriplePressGateTest {
    @Test
    fun `three raw taps inside the window trigger once`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(uptimeMillis = { now })

        assertFalse(gate.recordRawTap())
        now += 400L
        assertFalse(gate.recordRawTap())
        now += 400L
        assertTrue(gate.recordRawTap())
    }

    @Test
    fun `raw taps outside the window do not form a triple press`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(uptimeMillis = { now })

        assertFalse(gate.recordRawTap())
        now += 700L
        assertFalse(gate.recordRawTap())
        now += 700L
        assertFalse(gate.recordRawTap())
    }

    @Test
    fun `repeated physical triples are debounced`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(uptimeMillis = { now })

        assertFalse(gate.recordRawTap())
        now += 100L
        assertFalse(gate.recordRawTap())
        now += 100L
        assertTrue(gate.recordRawTap())
        now += 100L
        assertFalse(gate.recordRawTap())
        now += 100L
        assertFalse(gate.recordRawTap())
        now += 100L
        assertFalse(gate.recordRawTap())
        now += 1_200L
        assertFalse(gate.recordRawTap())
        now += 100L
        assertFalse(gate.recordRawTap())
        now += 100L
        assertTrue(gate.recordRawTap())
    }

    @Test
    fun `same media key event delivered by activity and session counts once`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(uptimeMillis = { now })

        assertFalse(gate.recordRawTap(eventTime = now))
        assertFalse(gate.recordRawTap(eventTime = now))
        now += 200L
        assertFalse(gate.recordRawTap(eventTime = now))
        now += 200L
        assertTrue(gate.recordRawTap(eventTime = now))
        assertFalse(gate.recordRawTap(eventTime = now))
    }

    @Test
    fun `mapped headset trigger clears partial taps and debounces duplicate delivery`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(uptimeMillis = { now })

        assertFalse(gate.recordRawTap())
        assertTrue(gate.recordMappedTrigger())
        assertFalse(gate.recordMappedTrigger())
        now += 1_500L
        assertFalse(gate.recordRawTap())
        now += 300L
        assertFalse(gate.recordRawTap())
        now += 300L
        assertTrue(gate.recordRawTap())
    }

    @Test
    fun `reset clears partial taps and debounce state`() {
        var now = 1_000L
        val gate = HeadsetTriplePressGate(uptimeMillis = { now })

        assertFalse(gate.recordRawTap())
        now += 300L
        assertFalse(gate.recordRawTap())
        now += 300L
        assertTrue(gate.recordRawTap())
        gate.reset()
        assertFalse(gate.recordRawTap())
        now += 300L
        assertFalse(gate.recordRawTap())
        now += 300L
        assertTrue(gate.recordRawTap())

        gate.reset()
        assertFalse(gate.recordRawTap())
        now += 300L
        assertFalse(gate.recordRawTap())
        gate.reset()
        now += 300L
        assertFalse(gate.recordRawTap())
    }
}
