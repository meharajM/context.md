package com.meharaj.contextengine

import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.*
import com.facebook.react.common.LifecycleState
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.view.KeyEvent
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
    @Volatile
    private var headsetTriggerEnabled = false
    private var lockScreenCaptureEnabled = false
    private val audioInputRouter by lazy { AudioInputRouter(reactContext) }
    private val headsetMediaButtonController by lazy {
        HeadsetMediaButtonController(
            context = reactContext,
            onTriplePress = { queueVoiceCaptureRequest() },
        )
    }

    init {
        companionEventEmitter = this
        reactContext.addLifecycleEventListener(this)
        if (VOICE_INTEGRATIONS_RELEASED) initializeVoiceIntegrations()
    }

    private fun initializeVoiceIntegrations() {
        syncHeadsetControllerState()
        tts = TextToSpeech(reactContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                isTtsInitialized = true
            }
        }
    }

    @ReactMethod
    fun announceGuidance(text: String) {
        if (!VOICE_INTEGRATIONS_RELEASED || text.isBlank()) return
        if (isTtsInitialized) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "guidance")
        }
    }

    @ReactMethod
    fun startAudioInputRouting(promise: Promise) {
        if (!VOICE_INTEGRATIONS_RELEASED) {
            promise.resolve("phone")
            return
        }
        audioInputRouter.start(promise)
    }

    @ReactMethod
    fun stopAudioInputRouting(promise: Promise) {
        audioInputRouter.stop(promise)
    }

    @ReactMethod
    fun startActiveRecordingService(promise: Promise) {
        synchronized(EventEmitter::class.java) {
            if (pendingActiveRecordingServiceStart != null) {
                promise.reject("ACTIVE_RECORDING_START_IN_PROGRESS", "Recording service is already starting")
                return
            }
            pendingActiveRecordingServiceStart = promise
        }
        try {
            ActiveRecordingService.start(reactContext)
        } catch (error: Throwable) {
            notifyActiveRecordingServiceStartFailed(error)
        }
    }

    @ReactMethod
    fun stopActiveRecordingService(promise: Promise) {
        synchronized(EventEmitter::class.java) { pendingActiveRecordingServiceStops += promise }
        try {
            if (!ActiveRecordingService.stop(reactContext)) {
                resolvePendingActiveRecordingServiceStops()
            }
        } catch (error: Throwable) {
            val wasPending = synchronized(EventEmitter::class.java) {
                pendingActiveRecordingServiceStops.remove(promise)
            }
            if (wasPending) {
                promise.reject("ACTIVE_RECORDING_STOP_FAILED", "Failed to stop the recording service", error)
            }
        }
    }

    @ReactMethod
    fun setHeadsetTriggerEnabled(enabled: Boolean) {
        if (!VOICE_INTEGRATIONS_RELEASED || !HEADSET_TRIGGER_RELEASED) return
        headsetTriggerEnabled = enabled
        headsetMediaButtonController.setTriggerEnabled(enabled)
        syncHeadsetControllerState()
    }

    @ReactMethod
    fun setLockScreenCaptureEnabled(enabled: Boolean, promise: Promise) {
        if (!VOICE_INTEGRATIONS_RELEASED || !LOCK_SCREEN_CAPTURE_RELEASED) {
            promise.resolve(false)
            return
        }
        try {
            lockScreenCaptureEnabled = enabled
            if (enabled) {
                LockScreenCaptureService.start(reactContext)
            } else {
                LockScreenCaptureService.stop(reactContext)
            }
            syncHeadsetControllerState()
            promise.resolve(true)
        } catch (error: Throwable) {
            promise.reject("LOCK_SCREEN_CAPTURE_ERROR", "Failed to update lock-screen headset capture", error)
        }
    }

    // Required for NativeEventEmitter compatibility on JS side
    @ReactMethod
    fun addListener(eventName: String) {
        if (eventName == ASSISTANT_CAPTURE_EVENT) {
            flushPendingAssistantCapture()
        } else if (eventName == QUICK_CAPTURE_EVENT) {
            synchronized(EventEmitter::class.java) { quickCaptureListenerRegistered = true }
            flushPendingQuickCaptureRequests()
        } else if (eventName == QUICK_RECORD_EVENT) {
            synchronized(EventEmitter::class.java) { quickRecordListenerRegistered = true }
            flushPendingQuickRecordRequests()
        } else if (eventName == ACTIVE_RECORDING_STOP_EVENT) {
            synchronized(EventEmitter::class.java) { activeRecordingStopListenerRegistered = true }
            flushPendingActiveRecordingStopRequests()
        } else if (eventName == VOICE_CAPTURE_EVENT) {
            synchronized(EventEmitter::class.java) { voiceCaptureListenerRegistered = true }
            flushPendingVoiceCaptureRequests()
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

    private fun flushPendingQuickCaptureRequests() {
        val requestCount = synchronized(EventEmitter::class.java) {
            pendingQuickCaptureRequests.also { pendingQuickCaptureRequests = 0 }
        }
        repeat(requestCount) { sendEvent(QUICK_CAPTURE_EVENT, null) }
    }

    private fun flushPendingQuickRecordRequests() {
        val requestCount = synchronized(EventEmitter::class.java) {
            pendingQuickRecordRequests.also { pendingQuickRecordRequests = 0 }
        }
        repeat(requestCount) { sendEvent(QUICK_RECORD_EVENT, null) }
    }

    private fun flushPendingActiveRecordingStopRequests() {
        val requestCount = synchronized(EventEmitter::class.java) {
            pendingActiveRecordingStopRequests.also { pendingActiveRecordingStopRequests = 0 }
        }
        repeat(requestCount) { sendEvent(ACTIVE_RECORDING_STOP_EVENT, null) }
    }

    private fun flushPendingVoiceCaptureRequests() {
        val requestCount = synchronized(EventEmitter::class.java) {
            pendingVoiceCaptureRequests.also { pendingVoiceCaptureRequests = 0 }
        }
        repeat(requestCount) { sendEvent(VOICE_CAPTURE_EVENT, null) }
    }

    private fun onLockScreenCaptureServiceStopped() {
        if (!lockScreenCaptureEnabled) return
        lockScreenCaptureEnabled = false
        syncHeadsetControllerState()
        sendEvent(LOCK_SCREEN_CAPTURE_DISABLED_EVENT, null)
    }

    override fun onHostResume() {
        syncHeadsetControllerState()
    }

    override fun onHostPause() {
        syncHeadsetControllerState()
    }

    override fun onHostDestroy() {
        lockScreenCaptureEnabled = false
        if (VOICE_INTEGRATIONS_RELEASED) LockScreenCaptureService.stop(reactContext)
        if (VOICE_INTEGRATIONS_RELEASED) audioInputRouter.release()
        syncHeadsetControllerState()
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        reactContext.removeLifecycleEventListener(this)
        lockScreenCaptureEnabled = false
        if (VOICE_INTEGRATIONS_RELEASED) LockScreenCaptureService.stop(reactContext)
        if (VOICE_INTEGRATIONS_RELEASED) audioInputRouter.release()
        if (VOICE_INTEGRATIONS_RELEASED) headsetMediaButtonController.release()
        tts?.stop()
        tts?.shutdown()
        tts = null
        isTtsInitialized = false
        if (companionEventEmitter == this) {
            companionEventEmitter = null
        }
        synchronized(EventEmitter::class.java) { quickCaptureListenerRegistered = false }
        synchronized(EventEmitter::class.java) { quickRecordListenerRegistered = false }
        synchronized(EventEmitter::class.java) { voiceCaptureListenerRegistered = false }
        synchronized(EventEmitter::class.java) { activeRecordingStopListenerRegistered = false }
        rejectPendingActiveRecordingServiceStart(IllegalStateException("React Native is shutting down"))
        ActiveRecordingService.stop(reactContext)
    }

    companion object {
        // Keep unverified headset button triggers out of v1; on-screen capture stays enabled.
        private const val VOICE_INTEGRATIONS_RELEASED = true
        private const val HEADSET_TRIGGER_RELEASED = false
        private const val LOCK_SCREEN_CAPTURE_RELEASED = false
        private const val ASSISTANT_CAPTURE_RELEASED = false
        private const val ASSISTANT_CAPTURE_EVENT = "AssistantCaptureRequested"
        private const val QUICK_CAPTURE_EVENT = "QuickCaptureRequested"
        private const val QUICK_RECORD_EVENT = "QuickRecordRequested"
        private const val VOICE_CAPTURE_EVENT = "VoiceCaptureRequested"
        private const val ACTIVE_RECORDING_STOP_EVENT = "ActiveRecordingStopRequested"
        private const val LOCK_SCREEN_CAPTURE_DISABLED_EVENT = "LockScreenCaptureDisabled"
        private var companionEventEmitter: EventEmitter? = null
        private var pendingAssistantCapture: String? = null
        private var pendingQuickCaptureRequests = 0
        private var quickCaptureListenerRegistered = false
        private var pendingQuickRecordRequests = 0
        private var quickRecordListenerRegistered = false
        private var pendingVoiceCaptureRequests = 0
        private var voiceCaptureListenerRegistered = false
        private var pendingActiveRecordingStopRequests = 0
        private var activeRecordingStopListenerRegistered = false
        private var pendingActiveRecordingServiceStart: Promise? = null
        private val pendingActiveRecordingServiceStops = mutableListOf<Promise>()

        fun notifyLockScreenCaptureServiceStopped() {
            companionEventEmitter?.onLockScreenCaptureServiceStopped()
        }

        fun notifyActiveRecordingServiceStarted() {
            val promise = synchronized(EventEmitter::class.java) {
                pendingActiveRecordingServiceStart.also { pendingActiveRecordingServiceStart = null }
            }
            promise?.resolve(null)
        }

        fun notifyActiveRecordingServiceStartFailed(error: Throwable) {
            rejectPendingActiveRecordingServiceStart(error)
        }

        fun notifyActiveRecordingServiceStopped() {
            rejectPendingActiveRecordingServiceStart(
                IllegalStateException("Recording service stopped before it was ready"),
            )
            resolvePendingActiveRecordingServiceStops()
        }

        private fun resolvePendingActiveRecordingServiceStops() {
            val promises = synchronized(EventEmitter::class.java) {
                pendingActiveRecordingServiceStops.toList().also { pendingActiveRecordingServiceStops.clear() }
            }
            promises.forEach { it.resolve(null) }
        }

        private fun rejectPendingActiveRecordingServiceStart(error: Throwable) {
            val promise = synchronized(EventEmitter::class.java) {
                pendingActiveRecordingServiceStart.also { pendingActiveRecordingServiceStart = null }
            }
            promise?.reject("ACTIVE_RECORDING_START_FAILED", "Could not start recording service", error)
        }

        fun dispatchHeadsetMediaButtonEvent(event: KeyEvent): Boolean {
            val emitter = companionEventEmitter?.takeIf { it.headsetTriggerEnabled } ?: return false
            return emitter.headsetMediaButtonController.handleMediaButtonKeyEvent(event)
        }

        fun queueAssistantCapture(content: String) {
            if (!ASSISTANT_CAPTURE_RELEASED) return
            val emitter = synchronized(EventEmitter::class.java) {
                pendingAssistantCapture = content
                companionEventEmitter
            }
            emitter?.flushPendingAssistantCapture()
        }

        fun queueQuickCaptureRequest() {
            val emitter = synchronized(EventEmitter::class.java) {
                pendingQuickCaptureRequests += 1
                companionEventEmitter.takeIf { quickCaptureListenerRegistered }
            }
            emitter?.flushPendingQuickCaptureRequests()
        }

        fun queueQuickRecordRequest() {
            val emitter = synchronized(EventEmitter::class.java) {
                pendingQuickRecordRequests += 1
                companionEventEmitter.takeIf { quickRecordListenerRegistered }
            }
            emitter?.flushPendingQuickRecordRequests()
        }

        fun queueActiveRecordingStopRequest() {
            val emitter = synchronized(EventEmitter::class.java) {
                pendingActiveRecordingStopRequests += 1
                companionEventEmitter.takeIf { activeRecordingStopListenerRegistered }
            }
            emitter?.flushPendingActiveRecordingStopRequests()
        }

        private fun queueVoiceCaptureRequest() {
            val emitter = synchronized(EventEmitter::class.java) {
                pendingVoiceCaptureRequests += 1
                companionEventEmitter.takeIf { voiceCaptureListenerRegistered }
            }
            emitter?.flushPendingVoiceCaptureRequests()
        }

        /**
         * Static helper to dispatch native events from other contexts (e.g. BroadcastReceivers).
         */
        fun sendEventToJs(eventName: String, params: WritableMap?) {
            companionEventEmitter?.sendEvent(eventName, params)
        }
    }

    private fun syncHeadsetControllerState() {
        if (!VOICE_INTEGRATIONS_RELEASED || !HEADSET_TRIGGER_RELEASED) return
        val hostResumed = reactContext.lifecycleState == LifecycleState.RESUMED
        headsetMediaButtonController.setActive(
            headsetTriggerEnabled &&
                (lockScreenCaptureEnabled || hostResumed),
        )
        headsetMediaButtonController.setForegroundActivity(
            reactContext.currentActivity.takeIf { headsetTriggerEnabled && hostResumed },
        )
    }
}
