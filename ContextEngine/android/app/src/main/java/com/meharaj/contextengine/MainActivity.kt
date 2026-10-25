package com.meharaj.contextengine

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    if (EventEmitter.dispatchHeadsetMediaButtonEvent(event)) return true
    return super.dispatchKeyEvent(event)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleAssistantCapture(intent)
    handleQuickCapture(intent)
    handleQuickRecord(intent)
    handleStopActiveRecording(intent)
  }

  override fun onResume() {
    super.onResume()
    val manager = AppWidgetManager.getInstance(this)
    val widgetIds = manager.getAppWidgetIds(ComponentName(this, QuickCaptureWidgetProvider::class.java))
    QuickCaptureWidgetProvider().onUpdate(this, manager, widgetIds)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleAssistantCapture(intent)
    handleQuickCapture(intent)
    handleQuickRecord(intent)
    handleStopActiveRecording(intent)
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
    const val ACTION_STOP_ACTIVE_RECORDING = "com.meharaj.contextengine.action.STOP_ACTIVE_RECORDING"
    private const val ASSISTANT_CONTENT_KEY = "assistant_content"
  }
}
