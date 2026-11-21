package com.meharaj.contextengine

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat

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
        private const val TAG = "WidgetCapture"
    }
}
