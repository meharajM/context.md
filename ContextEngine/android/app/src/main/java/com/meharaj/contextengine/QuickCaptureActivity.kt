package com.meharaj.contextengine

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import java.util.UUID

class QuickCaptureActivity : Activity() {
    private lateinit var writeContent: View
    private lateinit var permissionContent: View
    private lateinit var input: EditText
    private lateinit var permissionButton: TextView
    private lateinit var permissionHint: TextView
    private var openingSettings = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_quick_capture)
        writeContent = findViewById(R.id.quick_capture_write_content)
        permissionContent = findViewById(R.id.quick_capture_permission_content)
        input = findViewById(R.id.quick_capture_input)
        permissionButton = findViewById(R.id.quick_capture_mic_continue)
        permissionHint = findViewById(R.id.quick_capture_mic_denied)
        findViewById<TextView>(R.id.quick_capture_close).setOnClickListener { finish() }
        findViewById<TextView>(R.id.quick_capture_save).setOnClickListener(::saveText)
        permissionButton.setOnClickListener { continueWithMicrophonePermission() }
        showIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        showIntent(intent)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_MICROPHONE) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            startWidgetRecording()
        } else {
            showPermissionDenied()
        }
    }

    override fun onResume() {
        super.onResume()
        if (openingSettings && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            openingSettings = false
            startWidgetRecording()
        }
    }

    private fun showIntent(intent: Intent?) {
        val requestPermission = intent?.action == ACTION_MIC_PERMISSION
        writeContent.visibility = if (requestPermission) View.GONE else View.VISIBLE
        permissionContent.visibility = if (requestPermission) View.VISIBLE else View.GONE
        if (!requestPermission) {
            window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
            input.requestFocus()
            input.post {
                (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
                    .showSoftInput(input, InputMethodManager.SHOW_IMPLICIT)
            }
        }
    }

    private fun saveText(view: View) {
        val text = input.text.toString().trim()
        if (text.isEmpty()) {
            input.error = getString(R.string.quick_capture_write_hint)
            input.requestFocus()
            return
        }
        try {
            QuickTextOutbox.save(this, "quick-text-${UUID.randomUUID()}", text)
            try {
                BackgroundSynthesisWorker.enqueue(this)
            } catch (_: Exception) {
                // The durable outbox is drained when the app next opens.
            }
            QuickCaptureWidgetProvider.showSaved(this)
            finish()
        } catch (error: Exception) {
            Toast.makeText(this, R.string.quick_capture_save_failed, Toast.LENGTH_SHORT).show()
        }
    }

    private fun continueWithMicrophonePermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            startWidgetRecording()
            return
        }
        if (!shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO) && permissionHint.visibility == View.VISIBLE) {
            openingSettings = true
            startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")),
            )
            return
        }
        requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), REQUEST_MICROPHONE)
    }

    private fun showPermissionDenied() {
        permissionHint.visibility = View.VISIBLE
        permissionButton.setText(
            if (shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)) {
                R.string.quick_capture_mic_try_again
            } else {
                R.string.quick_capture_mic_open_settings
            },
        )
    }

    private fun startWidgetRecording() {
        try {
            ContextCompat.startForegroundService(
                this,
                Intent(this, WidgetVoiceCaptureService::class.java).setAction(WidgetVoiceCaptureService.ACTION_START),
            )
            finish()
        } catch (_: Exception) {
            QuickCaptureWidgetProvider.showError(this, "Couldn't start recording")
            finish()
        }
    }

    companion object {
        const val ACTION_WRITE = "com.meharaj.contextengine.widget.WRITE"
        const val ACTION_MIC_PERMISSION = "com.meharaj.contextengine.widget.MIC_PERMISSION"
        private const val REQUEST_MICROPHONE = 7301
    }
}
