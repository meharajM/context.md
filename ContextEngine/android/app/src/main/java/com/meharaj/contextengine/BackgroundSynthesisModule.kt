package com.meharaj.contextengine

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executor

class BackgroundSynthesisModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BackgroundSynthesisModule"

    @ReactMethod
    fun scheduleQueuedSynthesis(promise: Promise) {
        try {
            val operation = BackgroundSynthesisWorker.enqueue(reactApplicationContext)
            operation.result.addListener({
                try {
                    operation.result.get()
                    promise.resolve(true)
                } catch (error: Exception) {
                    Log.w(TAG, "Could not enqueue idle synthesis work.", error)
                    promise.reject("BACKGROUND_SYNTHESIS_SCHEDULE_FAILED", "Could not schedule idle synthesis.", error)
                }
            }, DIRECT_EXECUTOR)
        } catch (error: Exception) {
            Log.w(TAG, "Could not enqueue idle synthesis work.", error)
            promise.reject("BACKGROUND_SYNTHESIS_SCHEDULE_FAILED", "Could not schedule idle synthesis.", error)
        }
    }

    @ReactMethod
    fun reportQueuedSynthesisResult(retry: Boolean, promise: Promise) {
        try {
            val accepted = BackgroundSynthesisTaskCoordinator.report(retry)
            Log.i(TAG, "Idle synthesis result reported (retry=$retry, accepted=$accepted)")
            promise.resolve(accepted)
        } catch (error: Exception) {
            promise.reject("BACKGROUND_SYNTHESIS_RESULT_FAILED", "Could not report idle synthesis completion.", error)
        }
    }

    @ReactMethod
    fun readQuickTextOutbox(promise: Promise) {
        try {
            val entries = Arguments.createArray()
            QuickTextOutbox.read(reactApplicationContext).forEach { entry ->
                entries.pushMap(Arguments.createMap().apply {
                    putString("noteId", entry.noteId)
                    putString("text", entry.text)
                    putDouble("createdAt", entry.createdAt.toDouble())
                })
            }
            promise.resolve(entries)
        } catch (error: Exception) {
            promise.reject("QUICK_TEXT_READ_FAILED", "Could not read saved text", error)
        }
    }

    @ReactMethod
    fun acknowledgeQuickText(noteId: String, promise: Promise) {
        try {
            QuickTextOutbox.acknowledge(reactApplicationContext, noteId)
            promise.resolve(true)
        } catch (error: Exception) {
            promise.reject("QUICK_TEXT_ACK_FAILED", "Could not acknowledge saved text", error)
        }
    }

    private companion object {
        const val TAG = "BackgroundSynthesis"
        val DIRECT_EXECUTOR = Executor { command -> command.run() }
    }
}
