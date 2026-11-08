package com.meharaj.contextengine

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

internal object BackgroundSynthesisTaskRunner {
    fun run(
        applicationContext: Context,
        remindersOnly: Boolean = false,
        synthesisModelId: String? = null,
        downloadWhisperModel: Boolean = false,
        captureProcessing: Boolean = false,
        userInitiatedModelDownload: Boolean = false,
        isStopped: () -> Boolean = { false },
    ): Boolean {
        val reactApplication = applicationContext as? ReactApplication ?: return true
        try {
            val reactHost = reactApplication.reactHost ?: return true
            val startTask = reactHost.start()
            if (!startTask.waitForCompletion(REACT_START_TIMEOUT_MS, TimeUnit.MILLISECONDS) || startTask.isFaulted()) {
                Log.w(TAG, "React Native host did not start for idle synthesis", startTask.getError())
                return true
            }
        } catch (error: Exception) {
            Log.w(TAG, "Could not initialize React Native for idle synthesis; WorkManager will retry", error)
            return true
        }

        val reactHost = reactApplication.reactHost ?: return true
        val reactContext = reactHost.currentReactContext ?: return true
        if (!reactContext.hasActiveReactInstance()) return true

        val headlessContext = HeadlessJsTaskContext.getInstance(reactContext)
        if (!captureProcessing && headlessContext.hasActiveTasks()) {
            Log.i(TAG, "Another Headless JS task is active; idle synthesis will retry")
            return true
        }

        val workId = UUID.randomUUID().toString()
        val session = BackgroundSynthesisTaskCoordinator.begin(workId, captureProcessing) ?: return true
        val taskListener = object : HeadlessJsTaskEventListener {
            override fun onHeadlessJsTaskStart(taskId: Int) {
                Log.d(TAG, "Headless idle synthesis started (task $taskId)")
                session.onTaskStarted(taskId)
            }

            override fun onHeadlessJsTaskFinish(taskId: Int) {
                Log.d(TAG, "Headless idle synthesis finished (task $taskId)")
                session.onTaskFinished(taskId)
            }
        }

        headlessContext.addTaskEventListener(taskListener)
        var startedTaskId = -1
        try {
            val startSignal = CountDownLatch(1)
            var startFailure: Exception? = null
            val posted = UiThreadUtil.runOnUiThread {
                try {
                    val isModelDownload = synthesisModelId != null || downloadWhisperModel
                    startedTaskId = headlessContext.startTask(
                        HeadlessJsTaskConfig(
                            TASK_NAME,
                            Arguments.createMap().apply {
                                putBoolean(BackgroundSynthesisWorker.REMINDERS_ONLY, remindersOnly)
                                putBoolean(BackgroundSynthesisWorker.CAPTURE_PROCESSING, captureProcessing)
                                putString(BACKGROUND_WORK_ID, workId)
                                synthesisModelId?.let { putString(BackgroundSynthesisWorker.SYNTHESIS_MODEL_ID, it) }
                                putBoolean(BackgroundSynthesisWorker.DOWNLOAD_WHISPER_MODEL, downloadWhisperModel)
                                putBoolean(BackgroundSynthesisWorker.USER_INITIATED_MODEL_DOWNLOAD, userInitiatedModelDownload)
                            },
                            if (isModelDownload) MODEL_DOWNLOAD_TASK_TIMEOUT_MS else TASK_TIMEOUT_MS,
                            true,
                        ),
                    )
                } catch (error: Exception) {
                    startFailure = error
                } finally {
                    startSignal.countDown()
                }
            }
            if (!posted || !startSignal.await(START_TASK_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
                Log.w(TAG, "Could not dispatch idle synthesis to the React Native thread")
                return true
            }
            if (startFailure != null) {
                Log.w(TAG, "React Native rejected the idle synthesis task", startFailure)
                return true
            }

            val timeoutMs = if (synthesisModelId != null || downloadWhisperModel) {
                MODEL_DOWNLOAD_TASK_WAIT_TIMEOUT_MS
            } else {
                TASK_WAIT_TIMEOUT_MS
            }
            val deadline = SystemClock.elapsedRealtime() + timeoutMs
            while (!session.awaitResultReported(1, TimeUnit.SECONDS)) {
                if (session.awaitFinished(0, TimeUnit.MILLISECONDS)) {
                    Log.w(TAG, "Headless task finished without reporting its synthesis result")
                    return true
                }
                if (isStopped() || SystemClock.elapsedRealtime() >= deadline) {
                    Log.w(TAG, "Headless synthesis did not report before the WorkManager window ended")
                    return true
                }
            }
            // The JS result is sent from the task's finalizer. Give RN a short grace period to
            // deliver the task-finished callback while keeping the result acknowledgement authoritative.
            if (!session.awaitFinished(TASK_FINISH_GRACE_MS, TimeUnit.MILLISECONDS)) {
                if (startedTaskId >= 0 && headlessContext.isTaskRunning(startedTaskId)) {
                    Log.w(TAG, "Headless task reported its result but stayed active; releasing task $startedTaskId")
                    headlessContext.finishTask(startedTaskId)
                }
            }
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
            return true
        } finally {
            if (startedTaskId >= 0 && headlessContext.isTaskRunning(startedTaskId)) {
                Log.w(TAG, "Releasing unfinished headless task $startedTaskId after worker exit")
                headlessContext.finishTask(startedTaskId)
            }
            headlessContext.removeTaskEventListener(taskListener)
            BackgroundSynthesisTaskCoordinator.finish(workId, session)
        }

        return session.result() != BackgroundSynthesisTaskSession.RESULT_COMPLETED
    }

    private const val BACKGROUND_WORK_ID = "backgroundWorkId"
    private const val TASK_NAME = "ContextEngineBackgroundSynthesis"
    private const val TAG = "BackgroundSynthesis"
    private const val TASK_WAIT_TIMEOUT_MS = 8 * 60 * 1000L + 30 * 1000L
    private const val TASK_TIMEOUT_MS = 8 * 60 * 1000L
    private val MODEL_DOWNLOAD_TASK_TIMEOUT_MS = TimeUnit.HOURS.toMillis(5)
    private val MODEL_DOWNLOAD_TASK_WAIT_TIMEOUT_MS = MODEL_DOWNLOAD_TASK_TIMEOUT_MS + TimeUnit.MINUTES.toMillis(5)
    private const val TASK_FINISH_GRACE_MS = 2_000L
    private const val REACT_START_TIMEOUT_MS = 45_000L
    private const val START_TASK_TIMEOUT_MS = 10_000L
}
