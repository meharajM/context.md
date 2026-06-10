package com.meharaj.contextengine

import android.media.MediaPlayer
import android.net.Uri
import com.facebook.react.bridge.*
import java.io.File

/**
 * Android native module mirroring iOS AudioPlayerModule.
 * Plays local audio capture files using Android MediaPlayer.
 */
class AudioPlayerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AudioPlayerModule"

    private var mediaPlayer: MediaPlayer? = null

    @ReactMethod
    fun play(filePath: String, promise: Promise) {
        val cleanPath = filePath.replace("file://", "")
        val file = File(cleanPath)
        if (!file.exists()) {
            promise.reject("AUDIO_FILE_NOT_FOUND", "Audio file not found at: $cleanPath")
            return
        }

        try {
            stopPlayer()
            mediaPlayer = MediaPlayer().apply {
                setDataSource(reactContext, Uri.fromFile(file))
                prepare()
                start()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_PLAY_ERROR", "Failed to play audio file: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stop() {
        stopPlayer()
    }

    private fun stopPlayer() {
        mediaPlayer?.let {
            try {
                if (it.isPlaying) {
                    it.stop()
                }
                it.release()
            } catch (_: Exception) {
                // Ignore errors during cleanup/stop
            }
        }
        mediaPlayer = null
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopPlayer()
    }
}
