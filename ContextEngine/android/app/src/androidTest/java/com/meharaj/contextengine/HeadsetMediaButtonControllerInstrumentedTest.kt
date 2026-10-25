package com.meharaj.contextengine

import android.content.Intent
import android.media.session.MediaController
import android.os.SystemClock
import android.view.KeyEvent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class HeadsetMediaButtonControllerInstrumentedTest {
    @Test
    fun wiredAndBluetoothMediaKeysShareTriplePressTrigger() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        var triggerCount = 0
        val controller = HeadsetMediaButtonController(context, { triggerCount += 1 })
        controller.setTriggerEnabled(true)
        controller.setActive(true)

        try {
            assertTrue(controller.handleKeyEvent(keyDown(100L, KeyEvent.KEYCODE_HEADSETHOOK)))
            assertTrue(controller.handleKeyEvent(keyDown(300L, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)))
            assertTrue(controller.handleKeyEvent(keyDown(500L, KeyEvent.KEYCODE_MEDIA_PREVIOUS)))
            assertEquals(1, triggerCount)

            assertTrue(controller.handleKeyEvent(keyDown(700L, KeyEvent.KEYCODE_MEDIA_PREVIOUS)))
            assertEquals("A single Previous Track press must not start recording", 1, triggerCount)
        } finally {
            controller.release()
        }
    }

    @Test
    fun disarmedControllerDoesNotConsumeMediaKeys() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        var triggerCount = 0
        val controller = HeadsetMediaButtonController(context, { triggerCount += 1 })
        controller.setActive(true)

        try {
            assertFalse(controller.handleKeyEvent(keyDown(100L, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)))
            assertEquals(0, triggerCount)
        } finally {
            controller.release()
        }
    }

    @Test
    fun rawKeysAndBluetoothTransportCommandsShareTriplePressGate() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        var now = 1_000L
        var triggerCount = 0
        val controller = HeadsetMediaButtonController(context, { triggerCount += 1 }, { now })
        controller.setTriggerEnabled(true)
        controller.setActive(true)

        try {
            assertTrue(controller.handleKeyEvent(keyDown(now, KeyEvent.KEYCODE_HEADSETHOOK)))
            assertTrue(controller.handleTransportPress())
            now += 300L
            assertTrue(controller.handleTransportPress())
            now += 300L
            assertTrue(controller.handleKeyEvent(keyDown(now, KeyEvent.KEYCODE_MEDIA_PLAY)))
            assertEquals(1, triggerCount)
        } finally {
            controller.release()
        }
    }

    @Test
    fun previousTrackTransportCommandStartsCaptureForHeadsetsThatCollapseTripleClick() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        var now = 1_000L
        var triggerCount = 0
        val controller = HeadsetMediaButtonController(context, { triggerCount += 1 }, { now })
        controller.setTriggerEnabled(true)
        controller.setActive(true)

        try {
            assertTrue(controller.handlePreviousTrackGesture())
            assertTrue(controller.handlePreviousTrackGesture())
            assertEquals(1, triggerCount)
            now += 1_500L
            assertTrue(controller.handlePreviousTrackGesture())
            assertEquals(2, triggerCount)
        } finally {
            controller.release()
        }
    }

    @Test
    fun mediaButtonPreviousEventUsesTheCollapsedTripleClickRoute() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        var triggerCount = 0
        val controller = HeadsetMediaButtonController(context, { triggerCount += 1 })
        controller.setTriggerEnabled(true)
        controller.setActive(true)

        try {
            assertTrue(controller.handleMediaButtonKeyEvent(keyDown(100L, KeyEvent.KEYCODE_MEDIA_PREVIOUS)))
            assertEquals(1, triggerCount)
        } finally {
            controller.release()
        }
    }

    @Test
    fun foregroundActivityIsBoundToTheArmedMediaSession() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val activity = instrumentation.startActivitySync(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        ) as MainActivity
        val controller = HeadsetMediaButtonController(context, {})
        controller.setTriggerEnabled(true)
        controller.setActive(true)

        try {
            controller.setForegroundActivity(activity)
            instrumentation.waitForIdleSync()
            assertNotNull(activity.mediaController)

            controller.setActive(false)
            instrumentation.waitForIdleSync()
            assertNull(activity.mediaController)
        } finally {
            controller.release()
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { activity.finish() }
        }
    }

    @Test
    fun foregroundActivityMediaControllerDeliversThreeKeysToCaptureSession() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val activity = instrumentation.startActivitySync(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        ) as MainActivity
        var triggerCount = 0
        val controller = HeadsetMediaButtonController(context, { triggerCount += 1 })
        controller.setTriggerEnabled(true)
        controller.setActive(true)

        try {
            controller.setForegroundActivity(activity)
            instrumentation.waitForIdleSync()
            val mediaController: MediaController = activity.mediaController
                ?: throw AssertionError("Armed activity must receive media keys through its MediaController")
            val start = SystemClock.uptimeMillis()

            instrumentation.runOnMainSync {
                mediaController.dispatchMediaButtonEvent(keyDown(start, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
                mediaController.dispatchMediaButtonEvent(keyDown(start + 250L, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
                mediaController.dispatchMediaButtonEvent(keyDown(start + 500L, KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE))
            }
            instrumentation.waitForIdleSync()

            assertEquals(1, triggerCount)
        } finally {
            controller.release()
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { activity.finish() }
        }
    }

    private fun keyDown(eventTime: Long, keyCode: Int) =
        KeyEvent(eventTime, eventTime, KeyEvent.ACTION_DOWN, keyCode, 0)
}
