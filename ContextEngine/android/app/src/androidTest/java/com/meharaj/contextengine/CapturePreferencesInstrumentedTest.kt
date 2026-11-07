package com.meharaj.contextengine

import android.content.Intent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CapturePreferencesInstrumentedTest {
    @Test
    fun readsBothCaptureSwitchesFromCurrentPreferences() {
        assertEquals(
            CaptureSettings(text = false, voice = false),
            CapturePreferences.parse("""{"version":2,"revision":4,"manualCaptureEnabled":false,"pushToRecordEnabled":false}""")?.settings,
        )
    }

    @Test
    fun defaultsLegacyPreferencesToEnabledCapture() {
        assertEquals(
            CaptureSettings(text = true, voice = true),
            CapturePreferences.parse("""{"version":1,"revision":4}""")?.settings,
        )
    }

    @Test
    fun ignoresMalformedPreferences() {
        assertNull(CapturePreferences.parse("{partial"))
    }

    @Test
    fun widgetRecordingHonorsSavedVoiceSwitch() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val preference = java.io.File(context.filesDir, "setup/preferences-0.json")
        val previous = preference.takeIf(java.io.File::isFile)?.readText()
        preference.parentFile?.mkdirs()
        preference.writeText("""{"version":2,"revision":9000000000000000,"liteRtEnabled":true,"selectedModelId":"gemma3-1b-it","manualCaptureEnabled":true,"pushToRecordEnabled":false}""")
        try {
            QuickCaptureWidgetActionReceiver().onReceive(
                context,
                Intent(context, QuickCaptureWidgetActionReceiver::class.java)
                    .setAction(QuickCaptureWidgetActionReceiver.ACTION_START),
            )
            assertNull(WidgetVoiceCaptureService.recordingStartedAtElapsed)
            assertFalse(WidgetVoiceCaptureService.isFinalizing)
        } finally {
            if (previous == null) preference.delete() else preference.writeText(previous)
        }
    }
}
