package com.meharaj.contextengine

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PersistableBundle
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationCompat
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

internal object UserInitiatedModelDownloadJobs {
    fun schedule(context: Context, modelId: String?, downloadWhisperModel: Boolean, estimatedBytes: Long): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return false
        require(modelId == null || modelId.matches(Regex("[a-z0-9][a-z0-9-]{0,63}")))
        require(modelId != null || downloadWhisperModel)
        require(estimatedBytes > 0)

        val jobId = jobId(downloadWhisperModel)
        val scheduler = context.getSystemService(JobScheduler::class.java) ?: return false
        val existing = scheduler.getPendingJob(jobId)
        if (existing != null && isSameDownload(existing.extras, modelId, downloadWhisperModel)) return true

        val job = buildJobInfo(context, modelId, downloadWhisperModel, estimatedBytes)
        return try {
            scheduler.schedule(job) == JobScheduler.RESULT_SUCCESS
        } catch (error: Exception) {
            Log.w(TAG, "Could not schedule a user-initiated model download", error)
            false
        }
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    internal fun buildJobInfo(context: Context, modelId: String?, downloadWhisperModel: Boolean, estimatedBytes: Long): JobInfo {
        val extras = PersistableBundle().apply {
            modelId?.let { putString(EXTRA_MODEL_ID, it) }
            putBoolean(EXTRA_WHISPER_MODEL, downloadWhisperModel)
        }
        return JobInfo.Builder(jobId(downloadWhisperModel), ComponentName(context, UserInitiatedModelDownloadJobService::class.java))
            .setUserInitiated(true)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setEstimatedNetworkBytes(estimatedBytes, 0)
            .setBackoffCriteria(30_000L, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
            .setExtras(extras)
            .build()
    }

    fun isScheduled(context: Context, modelId: String?, downloadWhisperModel: Boolean): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return false
        val job = context.getSystemService(JobScheduler::class.java)?.getPendingJob(jobId(downloadWhisperModel))
            ?: return false
        return isSameDownload(job.extras, modelId, downloadWhisperModel)
    }

    private fun isSameDownload(extras: PersistableBundle?, modelId: String?, downloadWhisperModel: Boolean): Boolean =
        extras != null &&
            extras.getString(EXTRA_MODEL_ID) == modelId &&
            extras.getBoolean(EXTRA_WHISPER_MODEL) == downloadWhisperModel

    private fun jobId(downloadWhisperModel: Boolean) =
        if (downloadWhisperModel) WHISPER_DOWNLOAD_JOB_ID else MODEL_DOWNLOAD_JOB_ID

    internal const val EXTRA_MODEL_ID = "synthesisModelId"
    internal const val EXTRA_WHISPER_MODEL = "downloadWhisperModel"
    private const val MODEL_DOWNLOAD_JOB_ID = 0x43454E47
    private const val WHISPER_DOWNLOAD_JOB_ID = 0x43454E48
    private const val TAG = "BackgroundSynthesis"
}

class UserInitiatedModelDownloadJobService : JobService() {
    private val executor = Executors.newCachedThreadPool()
    private val stopSignals = ConcurrentHashMap<Int, AtomicBoolean>()

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    override fun onStartJob(params: JobParameters): Boolean {
        if (!params.isUserInitiatedJob) return false
        val modelId = params.extras.getString(UserInitiatedModelDownloadJobs.EXTRA_MODEL_ID)
        val downloadWhisperModel = params.extras.getBoolean(UserInitiatedModelDownloadJobs.EXTRA_WHISPER_MODEL)
        if ((modelId == null && !downloadWhisperModel) || modelId?.matches(Regex("[a-z0-9][a-z0-9-]{0,63}")) == false) {
            Log.w(TAG, "Rejecting malformed user-initiated model download job")
            return false
        }

        setNotification(
            params,
            if (downloadWhisperModel) WHISPER_NOTIFICATION_ID else MODEL_NOTIFICATION_ID,
            downloadNotification(if (downloadWhisperModel) WHISPER_NOTIFICATION_ID else MODEL_NOTIFICATION_ID),
            JOB_END_NOTIFICATION_POLICY_REMOVE,
        )
        val stopped = AtomicBoolean(false)
        stopSignals[params.jobId] = stopped
        executor.execute {
            val retry = BackgroundSynthesisTaskRunner.run(
                applicationContext,
                synthesisModelId = modelId,
                downloadWhisperModel = downloadWhisperModel,
                userInitiatedModelDownload = true,
                isStopped = stopped::get,
            )
            stopSignals.remove(params.jobId, stopped)
            if (!stopped.get()) {
                Log.i(TAG, "User-initiated model download finished (retry=$retry)")
                jobFinished(params, retry)
            }
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean {
        stopSignals[params.jobId]?.set(true)
        val userStopped = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            params.stopReason == JobParameters.STOP_REASON_USER
        Log.i(TAG, "User-initiated model download stopped (user=$userStopped)")
        return !userStopped
    }

    override fun onDestroy() {
        stopSignals.values.forEach { it.set(true) }
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun downloadNotification(id: Int) = NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.quick_capture_notification_icon)
        .setContentTitle("Downloading on-device model")
        .setContentText("Download continues while you use other apps")
        .setContentIntent(
            PendingIntent.getActivity(
                this,
                id,
                Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        .setCategory(NotificationCompat.CATEGORY_PROGRESS)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setProgress(0, 0, true)
        .build()

    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "Model downloads", NotificationManager.IMPORTANCE_LOW),
            )
        }
    }

    private companion object {
        const val TAG = "BackgroundSynthesis"
        const val CHANNEL_ID = "model-downloads"
        const val MODEL_NOTIFICATION_ID = 4203
        const val WHISPER_NOTIFICATION_ID = 4205
    }
}
