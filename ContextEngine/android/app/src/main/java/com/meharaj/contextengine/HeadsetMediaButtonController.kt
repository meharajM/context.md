package com.meharaj.contextengine

import android.app.PendingIntent
import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.session.MediaController
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent

/**
 * Owns the foreground-only MediaSession used by the optional headset capture trigger.
 *
 * Wired and Bluetooth controls use the same Android media key codes. The foreground Activity
 * sends keys here directly; the MediaSession also handles keys when Android routes them to it.
 * The session is active only while the React host is resumed or lock-screen capture is armed.
 */
internal class HeadsetMediaButtonController(
    context: Context,
    private val onTriplePress: () -> Unit,
    private val uptimeMillis: () -> Long = SystemClock::uptimeMillis,
) {
    private val triplePressGate = HeadsetTriplePressGate(uptimeMillis)
    private val mainHandler = Handler(Looper.getMainLooper())

    private val callback = object : MediaSession.Callback() {
        override fun onPlay() {
            handleTransportPress()
        }

        override fun onPause() {
            handleTransportPress()
        }

        override fun onSkipToPrevious() {
            handlePreviousTrackGesture()
        }

        override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
            val keyEvent = mediaButtonIntent.mediaButtonKeyEvent() ?: return false
            return handleMediaButtonKeyEvent(keyEvent) || super.onMediaButtonEvent(mediaButtonIntent)
        }
    }

    private val mediaButtonReceiver = ComponentName(context, HeadsetMediaButtonReceiver::class.java)
    private val mediaSession = MediaSession(context, SESSION_TAG).apply {
        // API 24-25 require these capabilities for the session stack to route hardware keys.
        // Newer releases deprecate the flags because MediaSession callbacks imply them, but
        // retaining them is harmless and keeps the minSdk path selectable without claiming that
        // Context Engine is actively playing media.
        @Suppress("DEPRECATION")
        setFlags(
            MediaSession.FLAG_HANDLES_MEDIA_BUTTONS or
                MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS,
        )
        setCallback(callback, Handler(Looper.getMainLooper()))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            setMediaButtonBroadcastReceiver(mediaButtonReceiver)
        } else {
            @Suppress("DEPRECATION")
            setMediaButtonReceiver(
                PendingIntent.getBroadcast(
                    context,
                    0,
                    Intent(Intent.ACTION_MEDIA_BUTTON).setComponent(mediaButtonReceiver),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
                ),
            )
        }
        setPlaybackState(
            PlaybackState.Builder()
                .setActions(
                    PlaybackState.ACTION_PLAY or
                        PlaybackState.ACTION_PAUSE or
                        PlaybackState.ACTION_PLAY_PAUSE or
                        PlaybackState.ACTION_SKIP_TO_PREVIOUS,
                )
                .setState(PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 0f)
                .build(),
        )
    }
    private val mediaController by lazy(LazyThreadSafetyMode.NONE) {
        MediaController(context, mediaSession.sessionToken)
    }
    @Volatile
    private var triggerEnabled = false
    @Volatile
    private var foregroundActivity: Activity? = null
    @Volatile
    private var attachedActivity: Activity? = null

    fun setTriggerEnabled(enabled: Boolean) {
        if (triggerEnabled == enabled) return
        triggerEnabled = enabled
        if (!enabled) triplePressGate.reset()
        syncActivityMediaController()
    }

    fun setActive(active: Boolean) {
        if (mediaSession.isActive != active) {
            mediaSession.isActive = active
            if (!active) {
                triplePressGate.reset()
            }
        }
        syncActivityMediaController()
    }

    fun setForegroundActivity(activity: Activity?) {
        foregroundActivity = activity
        syncActivityMediaController()
    }

    fun release() {
        foregroundActivity = null
        syncActivityMediaController()
        mediaSession.isActive = false
        mediaSession.setCallback(null)
        mediaSession.release()
        triplePressGate.reset()
    }

    fun handleKeyEvent(keyEvent: KeyEvent): Boolean {
        if (!triggerEnabled || !mediaSession.isActive) return false
        val isSupportedKey = keyEvent.keyCode == KeyEvent.KEYCODE_MEDIA_PREVIOUS ||
            keyEvent.keyCode == KeyEvent.KEYCODE_HEADSETHOOK ||
            keyEvent.keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ||
            keyEvent.keyCode == KeyEvent.KEYCODE_MEDIA_PLAY ||
            keyEvent.keyCode == KeyEvent.KEYCODE_MEDIA_PAUSE
        if (!isSupportedKey) return false

        // Consume key-up/repeat events, but count each physical key-down once.
        if (keyEvent.action == KeyEvent.ACTION_DOWN && keyEvent.repeatCount == 0 &&
            recordPress(keyEvent.eventTime)
        ) {
            onTriplePress()
        }
        return true
    }

    internal fun handleTransportPress(): Boolean {
        if (!triggerEnabled || !mediaSession.isActive) return false
        if (recordPress()) onTriplePress()
        return true
    }

    internal fun handlePreviousTrackGesture(): Boolean {
        if (!triggerEnabled || !mediaSession.isActive) return false
        // Some headsets report their physical triple-click as one Previous Track command.
        if (triplePressGate.recordMappedTrigger()) onTriplePress()
        return true
    }

    internal fun handleMediaButtonKeyEvent(keyEvent: KeyEvent): Boolean =
        if (keyEvent.keyCode == KeyEvent.KEYCODE_MEDIA_PREVIOUS &&
            keyEvent.action == KeyEvent.ACTION_DOWN && keyEvent.repeatCount == 0
        ) {
            handlePreviousTrackGesture()
        } else {
            handleKeyEvent(keyEvent)
        }

    private fun recordPress(eventTime: Long = uptimeMillis()) =
        triplePressGate.recordRawTap(eventTime)

    private fun syncActivityMediaController() {
        val nextActivity = foregroundActivity?.takeIf { triggerEnabled && mediaSession.isActive }
        val previousActivity = attachedActivity
        if (previousActivity === nextActivity) return

        attachedActivity = nextActivity
        mainHandler.post {
            previousActivity?.setMediaController(null)
            if (attachedActivity === nextActivity) {
                nextActivity?.setMediaController(mediaController)
            }
        }
    }

    private fun Intent.mediaButtonKeyEvent(): KeyEvent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        getParcelableExtra(Intent.EXTRA_KEY_EVENT, KeyEvent::class.java)
    } else {
        @Suppress("DEPRECATION")
        getParcelableExtra(Intent.EXTRA_KEY_EVENT)
    }

    companion object {
        private const val SESSION_TAG = "ContextEngineHeadsetTrigger"
    }
}
