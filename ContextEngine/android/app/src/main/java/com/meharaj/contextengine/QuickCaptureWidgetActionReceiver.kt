package com.meharaj.contextengine

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import java.io.File

class QuickCaptureWidgetActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_START -> {
                if (WidgetVoiceCaptureService.recordingStartedAtElapsed != null) return
                QuickCaptureWidgetProvider.clearFeedback(context)
                if (!CapturePreferences.read(context).voice) {
                    QuickCaptureWidgetProvider.showError(context, "Voice notes are off in Settings")
                    return
                }
                val whisperModel = File(context.filesDir, "models/whisper-tiny.en-q5_1.bin")
                if (!whisperModel.isFile || whisperModel.length() != WHISPER_MODEL_SIZE) {
                    QuickCaptureWidgetProvider.showError(context, context.getString(R.string.quick_capture_widget_voice_setup))
                    return
                }
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                    context.startActivity(
                        Intent(context, QuickCaptureActivity::class.java)
                            .setAction(QuickCaptureActivity.ACTION_MIC_PERMISSION)
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                    )
                    return
                }
                try {
                    ContextCompat.startForegroundService(
                        context,
                        Intent(context, WidgetVoiceCaptureService::class.java).setAction(WidgetVoiceCaptureService.ACTION_START),
                    )
                } catch (error: Exception) {
                    Log.e(TAG, "Could not start widget voice capture", error)
                    QuickCaptureWidgetProvider.showError(context, "Couldn't start recording")
                }
            }

            ACTION_STOP -> {
                try {
                    context.startService(
                        Intent(context, WidgetVoiceCaptureService::class.java).setAction(WidgetVoiceCaptureService.ACTION_STOP),
                    )
                } catch (error: Exception) {
                    Log.e(TAG, "Could not stop widget voice capture", error)
                    QuickCaptureWidgetProvider.showError(context, "Couldn't stop recording")
                }
            }
        }
    }

    companion object {
        const val ACTION_START = "com.meharaj.contextengine.widget.START_RECORDING"
        const val ACTION_STOP = "com.meharaj.contextengine.widget.STOP_RECORDING"
        private const val WHISPER_MODEL_SIZE = 32_166_155L
        private const val TAG = "WidgetCapture"
    }
}
