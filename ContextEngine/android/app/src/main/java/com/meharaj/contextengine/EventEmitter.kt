package com.meharaj.contextengine

import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

/**
 * Android native module mirroring iOS EventEmitter.
 * Exposes announceGuidance via Android TextToSpeech and allows emitting events
 * to JavaScript (e.g. headset actions or voice trigger integrations).
 */
class EventEmitter(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "EventEmitter"

    private var tts: TextToSpeech? = null
    private var isTtsInitialized = false

    init {
        companionEventEmitter = this
        tts = TextToSpeech(reactContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                isTtsInitialized = true
            }
        }
    }

    @ReactMethod
    fun announceGuidance(text: String) {
        if (text.isBlank()) return
        if (isTtsInitialized) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "guidance")
        }
    }

    // Required for NativeEventEmitter compatibility on JS side
    @ReactMethod
    fun addListener(eventName: String) {
        // Intentionally no-op
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Intentionally no-op
    }

    /**
     * Helper method to send events to JavaScript.
     */
    fun sendEvent(eventName: String, params: WritableMap?) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        tts?.stop()
        tts?.shutdown()
        tts = null
        isTtsInitialized = false
        if (companionEventEmitter == this) {
            companionEventEmitter = null
        }
    }

    companion object {
        private var companionEventEmitter: EventEmitter? = null

        /**
         * Static helper to dispatch native events from other contexts (e.g. BroadcastReceivers).
         */
        fun sendEventToJs(eventName: String, params: WritableMap?) {
            companionEventEmitter?.sendEvent(eventName, params)
        }
    }
}
