package com.meharaj.contextengine

import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
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
import java.util.concurrent.TimeUnit

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
    ): Result = if (
        BackgroundSynthesisTaskRunner.run(
            applicationContext,
            remindersOnly = remindersOnly,
            synthesisModelId = synthesisModelId,
            downloadWhisperModel = downloadWhisperModel,
            captureProcessing = captureProcessing,
            isStopped = { isStopped },
        )
    ) Result.retry() else Result.success()

    companion object {
        const val REMINDERS_ONLY = "automaticRemindersOnly"
        const val SYNTHESIS_MODEL_ID = "synthesisModelId"
        const val DOWNLOAD_WHISPER_MODEL = "downloadWhisperModel"
        const val CAPTURE_PROCESSING = "captureProcessing"
        const val USER_INITIATED_MODEL_DOWNLOAD = "userInitiatedModelDownload"
        private const val REMINDER_WORK = "context-engine-automatic-reminders"
        private const val CAPTURE_WORK = "context-engine-user-capture-processing"
        private const val MODEL_DOWNLOAD_WORK = "context-engine-model-download-"
        private const val WHISPER_DOWNLOAD_WORK = "context-engine-whisper-download"
        private const val MODEL_DOWNLOAD_CHANNEL = "model-downloads"
        private const val MODEL_DOWNLOAD_NOTIFICATION_ID = 4203
        private const val CAPTURE_PROCESSING_NOTIFICATION_ID = 4204
        private const val CAPTURE_PROCESSING_CHANNEL = "background-capture"
        private const val TAG = "BackgroundSynthesis"

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
            if (modelId != null && !UserInitiatedModelDownloadJobs.isScheduled(context, modelId, false)) {
                operations += enqueueModelDownload(
                    context,
                    "$MODEL_DOWNLOAD_WORK$modelId",
                    workDataOf(SYNTHESIS_MODEL_ID to modelId),
                    constraints,
                )
            }
            if (downloadWhisperModel && !UserInitiatedModelDownloadJobs.isScheduled(context, null, true)) {
                operations += enqueueModelDownload(
                    context,
                    WHISPER_DOWNLOAD_WORK,
                    workDataOf(DOWNLOAD_WHISPER_MODEL to true),
                    constraints,
                )
            }
            return operations
        }

        fun cancelModelDownloads(context: Context, modelId: String?, downloadWhisperModel: Boolean): List<Operation> {
            val manager = WorkManager.getInstance(context)
            return buildList {
                modelId?.let { add(manager.cancelUniqueWork("$MODEL_DOWNLOAD_WORK$it")) }
                if (downloadWhisperModel) add(manager.cancelUniqueWork(WHISPER_DOWNLOAD_WORK))
            }
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
