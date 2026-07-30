package com.meharaj.contextengine

import android.content.Context
import android.content.Intent
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
 * Most wired/Bluetooth controls translate a triple press into a single "previous" transport
 * command. Some devices instead forward three raw headset/play-pause key presses, so both forms
 * are accepted. The session is active only while the React host is resumed; keeping a fake media
 * session active in the background would steal controls from the user's real media app.
 */
internal class HeadsetMediaButtonController(
    context: Context,
    private val onTriplePress: () -> Unit,
    private val elapsedRealtime: () -> Long = SystemClock::elapsedRealtime,
) {
    private val triplePressGate = HeadsetTriplePressGate(elapsedRealtime)

    private val callback = object : MediaSession.Callback() {
        override fun onSkipToPrevious() {
            emitMappedTriplePress()
        }

        override fun onMediaButtonEvent(mediaButtonIntent: Intent): Boolean {
            val keyEvent = mediaButtonIntent.mediaButtonKeyEvent() ?: return false
            val isSupportedKey = keyEvent.keyCode == KeyEvent.KEYCODE_MEDIA_PREVIOUS ||
                keyEvent.keyCode == KeyEvent.KEYCODE_HEADSETHOOK ||
                keyEvent.keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE

            if (!isSupportedKey) {
                return super.onMediaButtonEvent(mediaButtonIntent)
            }

            // Consume both halves of supported key events but count only the first key-down.
            if (keyEvent.action != KeyEvent.ACTION_DOWN || keyEvent.repeatCount != 0) {
                return true
            }

            return when (keyEvent.keyCode) {
                KeyEvent.KEYCODE_MEDIA_PREVIOUS -> {
                    emitMappedTriplePress()
                    true
                }

                KeyEvent.KEYCODE_HEADSETHOOK,
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE,
                -> {
                    recordRawTap()
                    true
                }

                else -> false
            }
        }
    }

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
        setPlaybackState(
            PlaybackState.Builder()
                .setActions(
                    PlaybackState.ACTION_PLAY_PAUSE or
                        PlaybackState.ACTION_SKIP_TO_PREVIOUS,
                )
                .setState(PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 0f)
                .build(),
        )
    }

    fun setActive(active: Boolean) {
        if (mediaSession.isActive == active) return

        mediaSession.isActive = active
        if (!active) {
            triplePressGate.reset()
        }
    }

    fun release() {
        mediaSession.isActive = false
        mediaSession.setCallback(null)
        mediaSession.release()
        triplePressGate.reset()
    }

    private fun recordRawTap() {
        if (triplePressGate.recordRawTap()) {
            onTriplePress()
        }
    }

    private fun emitMappedTriplePress() {
        if (triplePressGate.recordMappedTriplePress()) {
            onTriplePress()
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
