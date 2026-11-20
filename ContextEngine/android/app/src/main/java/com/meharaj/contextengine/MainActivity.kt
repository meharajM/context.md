package com.meharaj.contextengine

import android.app.Activity
import android.app.AlertDialog
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import android.view.KeyEvent
import androidx.activity.result.contract.ActivityResultContracts
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

class MainActivity : ReactActivity() {
  private val appUpdateManager by lazy { AppUpdateManagerFactory.create(this) }
  private var updateListenerRegistered = false
  private var updateCheckInFlight = false
  private var updateFlowAttemptedThisActivity = false
  private var updateReadyPromptedThisActivity = false
  private var activeUpdateVersionCode: Int? = null
  private var updateReadyDialog: AlertDialog? = null

  private val appUpdateStateListener = InstallStateUpdatedListener { state ->
    if (state.installStatus() == InstallStatus.DOWNLOADED) {
      showDownloadedUpdatePrompt()
    }
  }

  private val updateFlowLauncher = registerForActivityResult(
    ActivityResultContracts.StartIntentSenderForResult(),
  ) { result ->
    val versionCode = activeUpdateVersionCode
    if (result.resultCode == Activity.RESULT_CANCELED && versionCode != null) {
      rememberUpdatePromptDismissal(versionCode)
    }
    if (result.resultCode != Activity.RESULT_OK) {
      activeUpdateVersionCode = null
    }
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (EventEmitter.dispatchHeadsetMediaButtonEvent(event)) return true
    return super.dispatchKeyEvent(event)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleAssistantCapture(intent)
    handleQuickCapture(intent)
    handleQuickRecord(intent)
    handleMeetingMode(intent)
    handleStopActiveRecording(intent)
    handleIncomingSharedContent(intent)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    // Bridgeless React Native logs a soft exception when Activity focus arrives before its context.
    if ((application as MainApplication).reactHost.currentReactContext != null) {
      super.onWindowFocusChanged(hasFocus)
    }
  }

  override fun onResume() {
    super.onResume()
    registerForUpdateStatus()
    checkForPlayUpdate()
    val manager = AppWidgetManager.getInstance(this)
    val widgetIds = manager.getAppWidgetIds(ComponentName(this, QuickCaptureWidgetProvider::class.java))
    QuickCaptureWidgetProvider().onUpdate(this, manager, widgetIds)
  }

  override fun onPause() {
    if (updateListenerRegistered) {
      appUpdateManager.unregisterListener(appUpdateStateListener)
      updateListenerRegistered = false
    }
    super.onPause()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleAssistantCapture(intent)
    handleQuickCapture(intent)
    handleQuickRecord(intent)
    handleMeetingMode(intent)
    handleStopActiveRecording(intent)
    handleIncomingSharedContent(intent)
  }

  private fun handleIncomingSharedContent(intent: Intent?) {
    if (intent?.action != Intent.ACTION_SEND) return
    val text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.trim().orEmpty()
    if (text.isEmpty()) {
      intent.action = null
      intent.removeExtra(Intent.EXTRA_TEXT)
      return
    }
    try {
      IncomingShareOutbox.save(this, text)
    } catch (error: Exception) {
      android.util.Log.e("MainActivity", "Could not save text shared to Thought Notes", error)
      Toast.makeText(this, "Couldn't receive shared text. Please try sharing it again.", Toast.LENGTH_LONG).show()
      return
    }
    intent.action = null
    intent.removeExtra(Intent.EXTRA_TEXT)
    EventEmitter.notifyIncomingSharedContentAvailable()
  }

  private fun registerForUpdateStatus() {
    if (!updateListenerRegistered) {
      appUpdateManager.registerListener(appUpdateStateListener)
      updateListenerRegistered = true
    }
  }

  private fun checkForPlayUpdate() {
    if (updateCheckInFlight || updateFlowAttemptedThisActivity) return
    updateCheckInFlight = true

    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { info ->
        updateCheckInFlight = false
        if (isFinishing || isDestroyed) return@addOnSuccessListener

        val versionCode = info.availableVersionCode()
        if (info.installStatus() == InstallStatus.DOWNLOADED) {
          activeUpdateVersionCode = versionCode
          showDownloadedUpdatePrompt()
          return@addOnSuccessListener
        }

        if (
          info.installStatus() == InstallStatus.PENDING ||
            info.installStatus() == InstallStatus.DOWNLOADING ||
            info.installStatus() == InstallStatus.INSTALLING ||
            info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
        ) {
          return@addOnSuccessListener
        }

        if (
          info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE ||
            !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) ||
            updatePromptDismissedRecently(versionCode)
        ) {
          return@addOnSuccessListener
        }

        updateFlowAttemptedThisActivity = true
        activeUpdateVersionCode = versionCode
        try {
          appUpdateManager.startUpdateFlowForResult(
            info,
            updateFlowLauncher,
            AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
          )
        } catch (error: Exception) {
          android.util.Log.w("MainActivity", "Could not start Google Play update flow", error)
        }
      }
      .addOnFailureListener { error ->
        updateCheckInFlight = false
        android.util.Log.d("MainActivity", "Google Play update check unavailable", error)
      }
  }

  private fun showDownloadedUpdatePrompt() {
    val versionCode = activeUpdateVersionCode ?: return
    if (
      updateReadyPromptedThisActivity || updateReadyDialog?.isShowing == true ||
        isFinishing || isDestroyed || updatePromptDismissedRecently(versionCode)
    ) {
      return
    }

    updateReadyPromptedThisActivity = true
    updateReadyDialog = AlertDialog.Builder(this)
      .setTitle(R.string.play_update_ready_title)
      .setMessage(R.string.play_update_ready_message)
      .setPositiveButton(R.string.play_update_restart) { _, _ ->
        appUpdateManager.completeUpdate()
          .addOnFailureListener { error ->
            android.util.Log.w("MainActivity", "Could not complete Google Play update", error)
          }
      }
      .setNegativeButton(R.string.play_update_later) { _, _ ->
        rememberUpdatePromptDismissal(versionCode)
      }
      .setOnCancelListener {
        rememberUpdatePromptDismissal(versionCode)
      }
      .create()
      .apply {
        setOnDismissListener { updateReadyDialog = null }
        show()
      }
  }

  private fun updatePromptDismissedRecently(versionCode: Int): Boolean {
    val preferences = getSharedPreferences(UPDATE_PREFERENCES, MODE_PRIVATE)
    val dismissedVersion = preferences.getInt(KEY_DISMISSED_UPDATE_VERSION, -1)
    val dismissedAt = preferences.getLong(KEY_DISMISSED_UPDATE_AT, 0L)
    return dismissedVersion == versionCode &&
      System.currentTimeMillis() - dismissedAt < UPDATE_PROMPT_COOLDOWN_MS
  }

  private fun rememberUpdatePromptDismissal(versionCode: Int) {
    getSharedPreferences(UPDATE_PREFERENCES, MODE_PRIVATE)
      .edit()
      .putInt(KEY_DISMISSED_UPDATE_VERSION, versionCode)
      .putLong(KEY_DISMISSED_UPDATE_AT, System.currentTimeMillis())
      .apply()
  }

  private fun handleAssistantCapture(intent: Intent?) {
    val content = intent?.getStringExtra(ASSISTANT_CONTENT_KEY)?.trim().orEmpty()
    if (content.isNotEmpty()) {
      EventEmitter.queueAssistantCapture(content)
    }
  }

  private fun handleQuickCapture(intent: Intent?) {
    if (intent?.action == ACTION_QUICK_CAPTURE) {
      intent.action = null
      EventEmitter.queueQuickCaptureRequest()
    }
  }

  private fun handleQuickRecord(intent: Intent?) {
    if (intent?.action == ACTION_QUICK_RECORD) {
      intent.action = null
      EventEmitter.queueQuickRecordRequest()
    }
  }

  private fun handleMeetingMode(intent: Intent?) {
    if (intent?.action == ACTION_OPEN_MEETING_MODE) {
      intent.action = null
      EventEmitter.queueMeetingModeRequest()
    }
  }

  private fun handleStopActiveRecording(intent: Intent?) {
    if (intent?.action == ACTION_STOP_ACTIVE_RECORDING) {
      intent.action = null
      EventEmitter.queueActiveRecordingStopRequest()
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ContextEngine"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  companion object {
    const val ACTION_QUICK_CAPTURE = "com.meharaj.contextengine.action.QUICK_CAPTURE"
    const val ACTION_QUICK_RECORD = "com.meharaj.contextengine.action.QUICK_RECORD"
    const val ACTION_OPEN_MEETING_MODE = "com.meharaj.contextengine.action.OPEN_MEETING_MODE"
    const val ACTION_STOP_ACTIVE_RECORDING = "com.meharaj.contextengine.action.STOP_ACTIVE_RECORDING"
    private const val ASSISTANT_CONTENT_KEY = "assistant_content"
    private const val UPDATE_PREFERENCES = "google_play_updates"
    private const val KEY_DISMISSED_UPDATE_VERSION = "dismissed_version_code"
    private const val KEY_DISMISSED_UPDATE_AT = "dismissed_at_ms"
    private const val UPDATE_PROMPT_COOLDOWN_MS = 7L * 24 * 60 * 60 * 1000
  }
}
