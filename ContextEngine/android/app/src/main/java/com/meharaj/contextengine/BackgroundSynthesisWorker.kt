package com.meharaj.contextengine

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Operation
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener
import java.util.concurrent.TimeUnit
import java.util.concurrent.CountDownLatch

internal const val BACKGROUND_SYNTHESIS_WORK_NAME = "context-engine-opportunistic-synthesis"

class BackgroundSynthesisWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val activityManager = applicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo().also(activityManager::getMemoryInfo)
        val powerManager = applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        val thermalBusy = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            powerManager.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE

        return when (
            BackgroundSynthesisReadiness.evaluate(
                availableMemoryBytes = memoryInfo.availMem,
                lowMemory = memoryInfo.lowMemory,
                thermalBusy = thermalBusy,
                deviceInteractive = powerManager.isInteractive,
            )
        ) {
            BackgroundSynthesisReadiness.Decision.WAIT -> Result.retry()
            BackgroundSynthesisReadiness.Decision.READY -> runHeadlessQueue()
        }
    }

    private fun runHeadlessQueue(): Result {
        val reactApplication = applicationContext as? ReactApplication ?: return Result.retry()
        try {
            val reactHost = reactApplication.reactHost ?: return Result.retry()
            val startTask = reactHost.start()
            if (!startTask.waitForCompletion(REACT_START_TIMEOUT_MS, TimeUnit.MILLISECONDS) || startTask.isFaulted()) {
                Log.w(TAG, "React Native host did not start for idle synthesis", startTask.getError())
                return Result.retry()
            }
        } catch (error: Exception) {
            Log.w(TAG, "Could not initialize React Native for idle synthesis; WorkManager will retry", error)
            return Result.retry()
        }

        val reactHost = reactApplication.reactHost ?: return Result.retry()
        val reactContext = reactHost.currentReactContext ?: return Result.retry()
        if (!reactContext.hasActiveReactInstance()) return Result.retry()

        val headlessContext = HeadlessJsTaskContext.getInstance(reactContext)
        if (headlessContext.hasActiveTasks()) {
            Log.i(TAG, "Another Headless JS task is active; idle synthesis will retry")
            return Result.retry()
        }

        val session = BackgroundSynthesisTaskCoordinator.begin() ?: return Result.retry()
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
        try {
            val startSignal = CountDownLatch(1)
            var startFailure: Exception? = null
            val posted = UiThreadUtil.runOnUiThread {
                try {
                    headlessContext.startTask(
                        HeadlessJsTaskConfig(
                            TASK_NAME,
                            Arguments.createMap(),
                            TASK_TIMEOUT_MS,
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
                return Result.retry()
            }
            if (startFailure != null) {
                Log.w(TAG, "React Native rejected the idle synthesis task", startFailure)
                return Result.retry()
            }

            val deadline = SystemClock.elapsedRealtime() + TASK_WAIT_TIMEOUT_MS
            while (!session.awaitResultReported(1, TimeUnit.SECONDS)) {
                if (session.awaitFinished(0, TimeUnit.MILLISECONDS)) {
                    Log.w(TAG, "Headless task finished without reporting its synthesis result")
                    return Result.retry()
                }
                if (isStopped || SystemClock.elapsedRealtime() >= deadline) {
                    Log.w(TAG, "Headless synthesis did not report before the WorkManager window ended")
                    return Result.retry()
                }
            }
            // The JS result is sent from the task's finalizer. Give RN a short grace period to
            // deliver the task-finished callback while keeping the result acknowledgement as the
            // authoritative Worker completion signal.
            session.awaitFinished(TASK_FINISH_GRACE_MS, TimeUnit.MILLISECONDS)
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
            return Result.retry()
        } finally {
            headlessContext.removeTaskEventListener(taskListener)
            BackgroundSynthesisTaskCoordinator.finish(session)
        }

        return if (session.result() == BackgroundSynthesisTaskSession.RESULT_COMPLETED) {
            Result.success()
        } else {
            Result.retry()
        }
    }

    companion object {
        private const val TAG = "BackgroundSynthesis"
        private const val TASK_NAME = "ContextEngineBackgroundSynthesis"
        private const val TASK_WAIT_TIMEOUT_MS = 8 * 60 * 1000L + 30 * 1000L
        private const val TASK_TIMEOUT_MS = 8 * 60 * 1000L
        private const val TASK_FINISH_GRACE_MS = 2_000L
        private const val REACT_START_TIMEOUT_MS = 45_000L
        private const val START_TASK_TIMEOUT_MS = 10_000L

        fun constraints(): Constraints = Constraints.Builder()
            .setRequiresBatteryNotLow(true)
            .setRequiresStorageNotLow(true)
            .build()

        fun enqueue(context: Context): Operation {
            val request = OneTimeWorkRequestBuilder<BackgroundSynthesisWorker>()
                .setConstraints(constraints())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            return WorkManager.getInstance(context).enqueueUniqueWork(
                BACKGROUND_SYNTHESIS_WORK_NAME,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request,
            )
        }
    }
}
