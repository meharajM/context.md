package com.meharaj.contextengine

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

internal class WidgetVoiceCaptureService : Service() {
    private val recording = AtomicBoolean(false)
    private val fileLock = Any()
    private var audioRecord: AudioRecord? = null
    private var output: RandomAccessFile? = null
    private var temporaryFile: File? = null
    private var captureThread: Thread? = null
    private var bytesWritten = 0L
    private var startInProgress = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startCapture(startId)
            ACTION_STOP -> finishCapture(startId)
            else -> stopSelf(startId)
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        if (recording.get()) finishCapture()
        recordingStartedAtElapsed = null
        isFinalizing = false
        super.onDestroy()
    }

    private fun startCapture(startId: Int) {
        if (recording.get() || startInProgress) return
        startInProgress = true
        try {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                throw SecurityException("Microphone permission is not granted")
            }
            ensureNotificationChannel()
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
            )

            val minBufferSize = AudioRecord.getMinBufferSize(
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
            )
            check(minBufferSize > 0) { "Microphone format is unavailable" }
            val bufferSize = maxOf(minBufferSize, BUFFER_BYTES)
            val recorder = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize,
            )
            audioRecord = recorder
            check(recorder.state == AudioRecord.STATE_INITIALIZED) { "Microphone could not start" }

            val directory = File(filesDir, "retained-audio")
            check(directory.isDirectory || directory.mkdirs()) { "Could not prepare private voice storage" }
            val filename = "contextengine-retained-${System.currentTimeMillis()}-${UUID.randomUUID()}.wav"
            val part = File(directory, "$filename.part")
            val wav = RandomAccessFile(part, "rw").apply {
                setLength(0)
                write(ByteArray(WAV_HEADER_BYTES))
            }
            output = wav
            temporaryFile = part

            recorder.startRecording()
            check(recorder.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "Microphone did not enter recording state" }

            bytesWritten = 0
            recording.set(true)
            recordingStartedAtElapsed = SystemClock.elapsedRealtime()
            QuickCaptureWidgetProvider.clearFeedback(this)
            QuickCaptureWidgetProvider.refresh(this)
            captureThread = Thread({ captureAudio(recorder, wav) }, "WidgetVoiceCapture").apply { start() }
        } catch (error: Exception) {
            Log.e(TAG, "Could not start widget voice capture", error)
            releaseAfterStartFailure()
            QuickCaptureWidgetProvider.showError(this, "Microphone unavailable")
            stopForegroundCompat()
            stopSelf(startId)
        } finally {
            startInProgress = false
        }
    }

    private fun captureAudio(recorder: AudioRecord, wav: RandomAccessFile) {
        val buffer = ByteArray(BUFFER_BYTES)
        var readFailure: String? = null
        try {
            while (recording.get()) {
                val count = recorder.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
                if (count > 0) {
                    val completePcmBytes = count and -2
                    var reachedWavLimit = false
                    if (completePcmBytes > 0) {
                        synchronized(fileLock) {
                            val remainingBytes = (MAX_WAV_DATA_BYTES - bytesWritten).coerceAtLeast(0)
                            val writableBytes = minOf(completePcmBytes.toLong(), remainingBytes).toInt() and -2
                            if (writableBytes > 0) {
                                wav.write(buffer, 0, writableBytes)
                                bytesWritten += writableBytes
                            }
                            reachedWavLimit = writableBytes < completePcmBytes
                        }
                    }
                    if (reachedWavLimit) {
                        readFailure = "Recording reached the supported length limit"
                        break
                    }
                } else if (count == AudioRecord.ERROR_DEAD_OBJECT || count < 0) {
                    readFailure = "Microphone stopped unexpectedly"
                    break
                }
            }
        } catch (error: Exception) {
            Log.e(TAG, "Widget microphone stream failed", error)
            readFailure = "Microphone stopped unexpectedly"
        }
        if (readFailure != null && recording.get()) {
            mainHandler.post { finishCapture(partialWarning = readFailure) }
        }
    }

    private fun finishCapture(startId: Int = 0, partialWarning: String? = null) {
        if (!recording.compareAndSet(true, false)) {
            if (!startInProgress) {
                stopForegroundCompat()
                stopSelf(startId)
            }
            return
        }
        isFinalizing = true
        QuickCaptureWidgetProvider.refresh(this)

        runCatching { audioRecord?.stop() }
        val thread = captureThread
        if (thread != null && thread !== Thread.currentThread()) {
            runCatching { thread.join(STOP_JOIN_TIMEOUT_MS) }
        }
        val recorder = audioRecord
        audioRecord = null
        runCatching { recorder?.release() }
        captureThread = null
        recordingStartedAtElapsed = null

        try {
            val part = temporaryFile ?: throw IllegalStateException("Voice recording file is unavailable")
            val wav = output ?: throw IllegalStateException("Voice recording could not be finalized")
            synchronized(fileLock) {
                check(thread?.isAlive != true) { "Microphone did not stop cleanly; audio was retained for recovery" }
                if (bytesWritten == 0L) {
                    wav.close()
                    part.delete()
                    throw IllegalStateException("No voice was captured")
                }
                writeWavHeader(wav, bytesWritten)
                wav.fd.sync()
                wav.close()
            }
            val audioFile = File(part.parentFile, part.name.removeSuffix(".part"))
            check(part.renameTo(audioFile)) { "Could not finish saving the voice note" }
            writeRecoveryDescriptor(audioFile)
            runCatching { BackgroundSynthesisWorker.enqueueReminders(this) }
                .onFailure { Log.w(TAG, "Saved audio; automatic reminders will retry when the app opens", it) }
            try {
                BackgroundSynthesisWorker.enqueue(this)
            } catch (error: Exception) {
                Log.w(TAG, "Voice note saved; background processing will retry later", error)
            }
            isFinalizing = false
            if (partialWarning == null) QuickCaptureWidgetProvider.showSaved(this)
            else QuickCaptureWidgetProvider.showError(this, "Partial voice note saved")
        } catch (error: Exception) {
            Log.e(TAG, "Could not finish widget voice capture", error)
            isFinalizing = false
            QuickCaptureWidgetProvider.showError(this, "Voice note needs attention")
            runCatching { output?.close() }
        } finally {
            output = null
            temporaryFile = null
            bytesWritten = 0
            stopForegroundCompat()
            stopSelf(startId)
        }
    }

    private fun writeRecoveryDescriptor(audioFile: File) {
        val noteId = "voice-retained-${audioFile.name.removePrefix("contextengine-retained-").removeSuffix(".wav")}"
        val file = AtomicFile(File(audioFile.absolutePath + ".capture.json"))
        val stream = file.startWrite()
        try {
            stream.write(
                JSONObject()
                    .put("version", 1)
                    .put("noteId", noteId)
                    .put("audioPath", audioFile.absolutePath)
                    .put("sampleRate", SAMPLE_RATE)
                    .put("channels", 1)
                    .put("bitsPerSample", 16)
                    .toString()
                    .toByteArray(Charsets.UTF_8),
            )
            file.finishWrite(stream)
        } catch (error: Exception) {
            file.failWrite(stream)
            throw error
        }
    }

    private fun writeWavHeader(file: RandomAccessFile, dataLength: Long) {
        file.seek(0)
        file.writeBytes("RIFF")
        file.writeIntLE((36 + dataLength).toInt())
        file.writeBytes("WAVE")
        file.writeBytes("fmt ")
        file.writeIntLE(16)
        file.writeShortLE(1)
        file.writeShortLE(1)
        file.writeIntLE(SAMPLE_RATE)
        file.writeIntLE(SAMPLE_RATE * 2)
        file.writeShortLE(2)
        file.writeShortLE(16)
        file.writeBytes("data")
        file.writeIntLE(dataLength.toInt())
    }

    private fun RandomAccessFile.writeShortLE(value: Int) {
        write(value and 0xff)
        write((value ushr 8) and 0xff)
    }

    private fun RandomAccessFile.writeIntLE(value: Int) {
        write(value and 0xff)
        write((value ushr 8) and 0xff)
        write((value ushr 16) and 0xff)
        write((value ushr 24) and 0xff)
    }

    private fun releaseAfterStartFailure() {
        recording.set(false)
        recordingStartedAtElapsed = null
        isFinalizing = false
        runCatching { audioRecord?.release() }
        audioRecord = null
        runCatching { output?.close() }
        output = null
        temporaryFile?.delete()
        temporaryFile = null
        captureThread = null
        bytesWritten = 0
        QuickCaptureWidgetProvider.refresh(this)
    }

    private fun notification() = NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.drawable.quick_capture_notification_icon)
        .setContentTitle(getString(R.string.quick_record_widget_recording))
        .setContentText(getString(R.string.quick_record_widget_notification))
        .setOngoing(true)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .addAction(
            android.R.drawable.ic_media_pause,
            getString(R.string.quick_record_widget_stop),
            PendingIntent.getService(
                this,
                REQUEST_STOP,
                Intent(this, WidgetVoiceCaptureService::class.java).setAction(ACTION_STOP),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        .build()

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_ID, getString(R.string.quick_record_widget_channel), NotificationManager.IMPORTANCE_LOW)
                    .apply { description = getString(R.string.quick_record_widget_notification) },
            )
        }
    }

    private fun stopForegroundCompat() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    }

    companion object {
        const val ACTION_START = "com.meharaj.contextengine.widget_voice.START"
        const val ACTION_STOP = "com.meharaj.contextengine.widget_voice.STOP"
        private const val TAG = "WidgetVoiceCapture"
        private const val CHANNEL_ID = "widget_voice_capture"
        private const val NOTIFICATION_ID = 4105
        private const val REQUEST_STOP = 4106
        private const val SAMPLE_RATE = 16_000
        private const val BUFFER_BYTES = 16 * 1024
        private const val WAV_HEADER_BYTES = 44
        private const val MAX_WAV_DATA_BYTES = 0xffff_ffffL - 36L
        private const val STOP_JOIN_TIMEOUT_MS = 5_000L
        private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())

        @Volatile
        var recordingStartedAtElapsed: Long? = null
            private set

        @Volatile
        var isFinalizing: Boolean = false
            private set
    }
}
