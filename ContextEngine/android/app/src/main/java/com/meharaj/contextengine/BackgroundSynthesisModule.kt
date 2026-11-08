package com.meharaj.contextengine

import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

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
    fun scheduleModelDownloads(modelId: String, downloadWhisperModel: Boolean, promise: Promise) {
        try {
            val operations = BackgroundSynthesisWorker.enqueueModelDownloads(
                reactApplicationContext,
                modelId.takeIf(String::isNotBlank),
                downloadWhisperModel,
            )
            if (operations.isEmpty()) {
                promise.resolve(true)
                return
            }
            val remaining = AtomicInteger(operations.size)
            val settled = AtomicBoolean(false)
            operations.forEach { operation ->
                operation.result.addListener({
                    try {
                        operation.result.get()
                        if (remaining.decrementAndGet() == 0 && settled.compareAndSet(false, true)) {
                            promise.resolve(true)
                        }
                    } catch (error: Exception) {
                        if (settled.compareAndSet(false, true)) {
                            Log.w(TAG, "Could not enqueue model download continuation.", error)
                            promise.reject(
                                "BACKGROUND_MODEL_DOWNLOAD_SCHEDULE_FAILED",
                                "Could not schedule model download continuation.",
                                error,
                            )
                        }
                    }
                }, DIRECT_EXECUTOR)
            }
        } catch (error: Exception) {
            Log.w(TAG, "Could not enqueue model download continuation.", error)
            promise.reject(
                "BACKGROUND_MODEL_DOWNLOAD_SCHEDULE_FAILED",
                "Could not schedule model download continuation.",
                error,
            )
        }
    }

    @ReactMethod
    fun scheduleUserInitiatedModelDownload(
        modelId: String,
        downloadWhisperModel: Boolean,
        estimatedBytes: Double,
        promise: Promise,
    ) {
        try {
            val normalizedModelId = modelId.takeIf(String::isNotBlank)
            require(normalizedModelId != null || downloadWhisperModel)
            require(estimatedBytes.isFinite() && estimatedBytes > 0 && estimatedBytes <= Long.MAX_VALUE.toDouble())
            if (normalizedModelId != null) {
                require(normalizedModelId.matches(Regex("[a-z0-9][a-z0-9-]{0,63}")))
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                promise.resolve(false)
                return
            }
            BackgroundSynthesisWorker.cancelModelDownloads(
                reactApplicationContext,
                normalizedModelId,
                downloadWhisperModel,
            ).forEach { it.result.get(5, TimeUnit.SECONDS) }
            promise.resolve(
                UserInitiatedModelDownloadJobs.schedule(
                    reactApplicationContext,
                    normalizedModelId,
                    downloadWhisperModel,
                    estimatedBytes.toLong(),
                ),
            )
        } catch (error: Exception) {
            Log.w(TAG, "Could not schedule a user-initiated model download.", error)
            promise.reject(
                "BACKGROUND_MODEL_DOWNLOAD_SCHEDULE_FAILED",
                "Could not schedule the model download to continue in the background.",
                error,
            )
        }
    }

    @ReactMethod
    fun reportQueuedSynthesisResult(retry: Boolean, workId: String, promise: Promise) {
        try {
            val accepted = BackgroundSynthesisTaskCoordinator.report(workId, retry)
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
