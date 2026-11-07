package com.meharaj.contextengine

import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.content.pm.ServiceInfo
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.ForegroundInfo
import androidx.work.NetworkType
import androidx.work.OutOfQuotaPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.Operation
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import org.json.JSONObject
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener
import java.util.concurrent.TimeUnit
import java.util.concurrent.CountDownLatch
import java.util.UUID

internal const val BACKGROUND_SYNTHESIS_WORK_NAME = "context-engine-opportunistic-synthesis"

class BackgroundSynthesisWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val remindersOnly = inputData.getBoolean(REMINDERS_ONLY, false)
        if (remindersOnly && !remindersEnabled(applicationContext)) return Result.success()
        val synthesisModelId = inputData.getString(SYNTHESIS_MODEL_ID)?.takeIf(String::isNotBlank)
        val downloadWhisperModel = inputData.getBoolean(DOWNLOAD_WHISPER_MODEL, false)
        val captureProcessing = inputData.getBoolean(CAPTURE_PROCESSING, false)
        val modelDownload = synthesisModelId != null || downloadWhisperModel
        if (modelDownload && !promoteModelDownloadToForeground()) return Result.retry()
        if (captureProcessing && !promoteCaptureProcessingToForeground()) return Result.retry()

        val activityManager = applicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo().also(activityManager::getMemoryInfo)
        val powerManager = applicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        val thermalBusy = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            powerManager.currentThermalStatus >= PowerManager.THERMAL_STATUS_SEVERE

        if (remindersOnly) {
            if (memoryInfo.lowMemory || thermalBusy) return Result.retry()
            return runHeadlessQueue(true)
        }
        if (captureProcessing) return runHeadlessQueue(captureProcessing = true)
        if (modelDownload) return runHeadlessQueue(
            synthesisModelId = synthesisModelId,
            downloadWhisperModel = downloadWhisperModel,
        )

        return when (
            BackgroundSynthesisReadiness.evaluate(
                availableMemoryBytes = memoryInfo.availMem,
                lowMemory = memoryInfo.lowMemory,
                thermalBusy = thermalBusy,
            )
        ) {
            BackgroundSynthesisReadiness.Decision.WAIT -> Result.retry()
            BackgroundSynthesisReadiness.Decision.READY -> runHeadlessQueue()
        }
    }

    override fun getForegroundInfo(): ForegroundInfo = captureProcessingForegroundInfo()

    private fun promoteModelDownloadToForeground(): Boolean {
        return promoteToForeground(
            foregroundInfo(
                notificationId = MODEL_DOWNLOAD_NOTIFICATION_ID,
                channelId = MODEL_DOWNLOAD_CHANNEL,
                channelName = "Model downloads",
                title = "Downloading on-device model",
                message = "Download continues while you use other apps",
            ),
        )
    }

    private fun promoteCaptureProcessingToForeground(): Boolean = promoteToForeground(captureProcessingForegroundInfo())

    private fun captureProcessingForegroundInfo(): ForegroundInfo = foregroundInfo(
        notificationId = CAPTURE_PROCESSING_NOTIFICATION_ID,
        channelId = CAPTURE_PROCESSING_CHANNEL,
        channelName = "Background capture",
        title = "Processing saved note",
        message = "Transcription and organizing continue in the background",
    )

    private fun foregroundInfo(
        notificationId: Int,
        channelId: String,
        channelName: String,
        title: String,
        message: String,
    ): ForegroundInfo {
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager.getNotificationChannel(channelId) == null) {
            manager.createNotificationChannel(NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_LOW))
        }
        val openApp = PendingIntent.getActivity(
            applicationContext,
            notificationId,
            Intent(applicationContext, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0,
        )
        val notification = NotificationCompat.Builder(applicationContext, channelId)
            .setSmallIcon(R.drawable.quick_capture_notification_icon)
            .setContentTitle(title)
            .setContentText(message)
            .setContentIntent(openApp)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setProgress(0, 0, true)
            .build()
        val foregroundInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ForegroundInfo(
                notificationId,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
            )
        } else {
            ForegroundInfo(notificationId, notification)
        }
        return foregroundInfo
    }

    private fun promoteToForeground(foregroundInfo: ForegroundInfo): Boolean = try {
            setForegroundAsync(foregroundInfo).get(15, TimeUnit.SECONDS)
            true
        } catch (error: Exception) {
            Log.w(TAG, "Could not start the visible background worker", error)
            false
        }

    private fun runHeadlessQueue(
        remindersOnly: Boolean = false,
        synthesisModelId: String? = null,
        downloadWhisperModel: Boolean = false,
        captureProcessing: Boolean = false,
    ): Result {
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
        if (!captureProcessing && headlessContext.hasActiveTasks()) {
            Log.i(TAG, "Another Headless JS task is active; idle synthesis will retry")
            return Result.retry()
        }

        val workId = UUID.randomUUID().toString()
        val session = BackgroundSynthesisTaskCoordinator.begin(workId, captureProcessing) ?: return Result.retry()
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
                                putBoolean(REMINDERS_ONLY, remindersOnly)
                                putBoolean(CAPTURE_PROCESSING, captureProcessing)
                                putString(BACKGROUND_WORK_ID, workId)
                                synthesisModelId?.let { putString(SYNTHESIS_MODEL_ID, it) }
                                putBoolean(DOWNLOAD_WHISPER_MODEL, downloadWhisperModel)
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
                return Result.retry()
            }
            if (startFailure != null) {
                Log.w(TAG, "React Native rejected the idle synthesis task", startFailure)
                return Result.retry()
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
            if (!session.awaitFinished(TASK_FINISH_GRACE_MS, TimeUnit.MILLISECONDS)) {
                if (startedTaskId >= 0 && headlessContext.isTaskRunning(startedTaskId)) {
                    Log.w(TAG, "Headless task reported its result but stayed active; releasing task $startedTaskId")
                    headlessContext.finishTask(startedTaskId)
                }
            }
        } catch (interrupted: InterruptedException) {
            Thread.currentThread().interrupt()
            return Result.retry()
        } finally {
            if (startedTaskId >= 0 && headlessContext.isTaskRunning(startedTaskId)) {
                Log.w(TAG, "Releasing unfinished headless task $startedTaskId after worker exit")
                headlessContext.finishTask(startedTaskId)
            }
            headlessContext.removeTaskEventListener(taskListener)
            BackgroundSynthesisTaskCoordinator.finish(workId, session)
        }

        return if (session.result() == BackgroundSynthesisTaskSession.RESULT_COMPLETED) {
            Result.success()
        } else {
            Result.retry()
        }
    }

    companion object {
        const val REMINDERS_ONLY = "automaticRemindersOnly"
        const val SYNTHESIS_MODEL_ID = "synthesisModelId"
        const val DOWNLOAD_WHISPER_MODEL = "downloadWhisperModel"
        const val CAPTURE_PROCESSING = "captureProcessing"
        private const val BACKGROUND_WORK_ID = "backgroundWorkId"
        private const val REMINDER_WORK = "context-engine-automatic-reminders"
        private const val CAPTURE_WORK = "context-engine-user-capture-processing"
        private const val MODEL_DOWNLOAD_WORK = "context-engine-model-download-"
        private const val WHISPER_DOWNLOAD_WORK = "context-engine-whisper-download"
        private const val MODEL_DOWNLOAD_CHANNEL = "model-downloads"
        private const val MODEL_DOWNLOAD_NOTIFICATION_ID = 4203
        private const val CAPTURE_PROCESSING_NOTIFICATION_ID = 4204
        private const val CAPTURE_PROCESSING_CHANNEL = "background-capture"
        private const val TAG = "BackgroundSynthesis"
        private const val TASK_NAME = "ContextEngineBackgroundSynthesis"
        private const val TASK_WAIT_TIMEOUT_MS = 8 * 60 * 1000L + 30 * 1000L
        private const val TASK_TIMEOUT_MS = 8 * 60 * 1000L
        private val MODEL_DOWNLOAD_TASK_TIMEOUT_MS = TimeUnit.HOURS.toMillis(5)
        private val MODEL_DOWNLOAD_TASK_WAIT_TIMEOUT_MS = MODEL_DOWNLOAD_TASK_TIMEOUT_MS + TimeUnit.MINUTES.toMillis(5)
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

        fun enqueueCaptureProcessing(context: Context): Operation {
            val constraints = Constraints.Builder()
                .setRequiresStorageNotLow(true)
                .build()
            val request = OneTimeWorkRequestBuilder<BackgroundSynthesisWorker>()
                .setInputData(workDataOf(CAPTURE_PROCESSING to true))
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.LINEAR, 10, TimeUnit.SECONDS)
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .build()
            return WorkManager.getInstance(context).enqueueUniqueWork(
                CAPTURE_WORK,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request,
            )
        }

        fun enqueueModelDownloads(context: Context, modelId: String?, downloadWhisperModel: Boolean): List<Operation> {
            require(modelId == null || modelId.matches(Regex("[a-z0-9][a-z0-9-]{0,63}")))
            require(modelId != null || downloadWhisperModel)
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresStorageNotLow(true)
                .build()
            val operations = mutableListOf<Operation>()
            if (modelId != null) {
                operations += enqueueModelDownload(
                    context,
                    "$MODEL_DOWNLOAD_WORK$modelId",
                    workDataOf(SYNTHESIS_MODEL_ID to modelId),
                    constraints,
                )
            }
            if (downloadWhisperModel) {
                operations += enqueueModelDownload(
                    context,
                    WHISPER_DOWNLOAD_WORK,
                    workDataOf(DOWNLOAD_WHISPER_MODEL to true),
                    constraints,
                )
            }
            return operations
        }

        private fun enqueueModelDownload(
            context: Context,
            workName: String,
            data: androidx.work.Data,
            constraints: Constraints,
        ): Operation {
            val request = OneTimeWorkRequestBuilder<BackgroundSynthesisWorker>()
                .setInputData(data)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            return WorkManager.getInstance(context).enqueueUniqueWork(
                workName,
                ExistingWorkPolicy.KEEP,
                request,
            )
        }

        private fun remindersEnabled(context: Context): Boolean = try {
            JSONObject(AutomaticReminderScheduler(context).getState()).getBoolean("enabled")
        } catch (error: Exception) {
            Log.w(TAG, "Reminder settings unavailable; existing note capture continues", error)
            false
        }

        fun enqueueReminders(context: Context): Operation? {
            if (!remindersEnabled(context)) return null
            val request = OneTimeWorkRequestBuilder<BackgroundSynthesisWorker>()
                .setInputData(workDataOf(REMINDERS_ONLY to true))
                .setConstraints(constraints())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            return WorkManager.getInstance(context).enqueueUniqueWork(
                REMINDER_WORK, ExistingWorkPolicy.REPLACE, request,
            )
        }
    }
}
