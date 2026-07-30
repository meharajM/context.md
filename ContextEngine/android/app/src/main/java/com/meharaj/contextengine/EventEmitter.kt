package com.meharaj.contextengine

import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.*
import com.facebook.react.common.LifecycleState
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

/**
 * Android native module mirroring iOS EventEmitter.
 * Exposes announceGuidance via Android TextToSpeech and allows emitting events
 * to JavaScript (e.g. headset actions or voice trigger integrations).
 */
class EventEmitter(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    override fun getName(): String = "EventEmitter"

    private var tts: TextToSpeech? = null
    private var isTtsInitialized = false
    private val headsetMediaButtonController = HeadsetMediaButtonController(
        context = reactContext,
        onTriplePress = { sendEvent(HEADSET_TRIPLE_TAP_EVENT, null) },
    )

    init {
        companionEventEmitter = this
        reactContext.addLifecycleEventListener(this)
        headsetMediaButtonController.setActive(reactContext.lifecycleState == LifecycleState.RESUMED)
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
        if (eventName == ASSISTANT_CAPTURE_EVENT) {
            flushPendingAssistantCapture()
        }
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

    private fun flushPendingAssistantCapture() {
        val content = synchronized(EventEmitter::class.java) {
            pendingAssistantCapture.also { pendingAssistantCapture = null }
        } ?: return

        sendEvent(ASSISTANT_CAPTURE_EVENT, Arguments.createMap().apply {
            putString("content", content)
        })
    }

    override fun onHostResume() {
        headsetMediaButtonController.setActive(true)
    }

    override fun onHostPause() {
        headsetMediaButtonController.setActive(false)
    }

    override fun onHostDestroy() {
        headsetMediaButtonController.setActive(false)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        reactContext.removeLifecycleEventListener(this)
        headsetMediaButtonController.release()
        tts?.stop()
        tts?.shutdown()
        tts = null
        isTtsInitialized = false
        if (companionEventEmitter == this) {
            companionEventEmitter = null
        }
    }

    companion object {
        private const val ASSISTANT_CAPTURE_EVENT = "AssistantCaptureRequested"
        private const val HEADSET_TRIPLE_TAP_EVENT = "HeadsetTripleTapRequested"
        private var companionEventEmitter: EventEmitter? = null
        private var pendingAssistantCapture: String? = null

        fun queueAssistantCapture(content: String) {
            val emitter = synchronized(EventEmitter::class.java) {
                pendingAssistantCapture = content
                companionEventEmitter
            }
            emitter?.flushPendingAssistantCapture()
        }

        /**
         * Static helper to dispatch native events from other contexts (e.g. BroadcastReceivers).
         */
        fun sendEventToJs(eventName: String, params: WritableMap?) {
            companionEventEmitter?.sendEvent(eventName, params)
        }
    }
}
