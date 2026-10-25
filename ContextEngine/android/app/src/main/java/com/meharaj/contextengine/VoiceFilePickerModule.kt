package com.meharaj.contextengine

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class VoiceFilePickerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    override fun getName(): String = "VoiceFilePickerModule"

    private var pendingPromise: Promise? = null
    private var pendingBackupContent: String? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    @ReactMethod
    fun pickVoiceFile(promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("VOICE_PICKER_BUSY", "Voice file picker is already active")
            return
        }

        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("VOICE_PICKER_UNAVAILABLE", "Unable to present the voice file picker")
            return
        }

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "audio/*"
            putExtra(
                Intent.EXTRA_MIME_TYPES,
                arrayOf(
                    "audio/m4a",
                    "audio/mp4",
                    "audio/mpeg",
                    "audio/wav",
                    "audio/x-wav",
                    "audio/aac",
                    "audio/ogg",
                    "audio/opus",
                )
            )
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
        }

        launchPicker(activity, intent, REQUEST_CODE_PICK_VOICE_FILE, promise)
    }

    @ReactMethod
    fun exportBackup(content: String, promise: Promise) {
        if (content.toByteArray(Charsets.UTF_8).size > MAX_BACKUP_BYTES) {
            promise.reject("BACKUP_TOO_LARGE", "Backup file exceeds the 10 MB limit")
            return
        }
        if (!canStartPicker(promise, "BACKUP_PICKER_BUSY")) return
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("BACKUP_PICKER_UNAVAILABLE", "Unable to present the backup file picker")
            return
        }

        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_TITLE, "Thought-Notes-Backup.json")
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        }
        pendingBackupContent = content
        launchPicker(activity, intent, REQUEST_CODE_EXPORT_BACKUP, promise)
    }

    @ReactMethod
    fun pickBackupFile(promise: Promise) {
        if (!canStartPicker(promise, "BACKUP_PICKER_BUSY")) return
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("BACKUP_PICKER_UNAVAILABLE", "Unable to present the backup file picker")
            return
        }

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "application/json"
            putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/json", "application/octet-stream"))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        launchPicker(activity, intent, REQUEST_CODE_PICK_BACKUP, promise)
    }

    private fun canStartPicker(promise: Promise, errorCode: String): Boolean {
        if (pendingPromise == null) return true
        promise.reject(errorCode, "A document picker is already active")
        return false
    }

    private fun launchPicker(activity: Activity, intent: Intent, requestCode: Int, promise: Promise) {
        pendingPromise = promise
        try {
            activity.startActivityForResult(intent, requestCode)
        } catch (error: Exception) {
            pendingPromise = null
            pendingBackupContent = null
            promise.reject("DOCUMENT_PICKER_UNAVAILABLE", "Unable to open the document picker: ${error.message}", error)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE_PICK_VOICE_FILE &&
            requestCode != REQUEST_CODE_EXPORT_BACKUP &&
            requestCode != REQUEST_CODE_PICK_BACKUP) return

        val promise = pendingPromise
        pendingPromise = null
        val backupContent = pendingBackupContent
        pendingBackupContent = null

        if (promise == null) {
            return
        }

        if (resultCode != Activity.RESULT_OK) {
            if (requestCode == REQUEST_CODE_PICK_VOICE_FILE) {
                promise.reject("VOICE_PICKER_CANCELLED", "User canceled voice file selection")
            } else {
                promise.resolve(if (requestCode == REQUEST_CODE_EXPORT_BACKUP) false else null)
            }
            return
        }

        val uri = data?.data
        if (uri == null) {
            if (requestCode == REQUEST_CODE_PICK_VOICE_FILE) {
                promise.reject("VOICE_PICKER_EMPTY", "No voice file was selected")
            } else {
                promise.reject("BACKUP_PICKER_EMPTY", "No backup file was selected")
            }
            return
        }

        try {
            when (requestCode) {
                REQUEST_CODE_PICK_VOICE_FILE -> promise.resolve(copyVoiceFile(uri))
                REQUEST_CODE_EXPORT_BACKUP -> {
                    writeBackup(uri, backupContent ?: throw IllegalStateException("Backup content is missing"))
                    promise.resolve(true)
                }
                REQUEST_CODE_PICK_BACKUP -> promise.resolve(readBackupFile(uri))
            }
        } catch (error: Exception) {
            if (requestCode == REQUEST_CODE_PICK_VOICE_FILE) {
                promise.reject("VOICE_PICKER_COPY_FAILED", "Failed to import voice file: ${error.message}", error)
            } else {
                promise.reject("BACKUP_FILE_FAILED", "Failed to read or write backup file: ${error.message}", error)
            }
        }
    }

    override fun onNewIntent(intent: Intent) = Unit

    private fun copyVoiceFile(uri: Uri): WritableMap {
        val resolver = reactContext.contentResolver
        val displayName = queryDisplayName(uri) ?: "voice-import-${UUID.randomUUID()}"
        val mimeType = resolver.getType(uri)
        val extension = resolveExtension(displayName, mimeType)
        val targetDir = File(reactContext.cacheDir, "contextengine-voice-imports").apply {
            if (!exists()) {
                mkdirs()
            }
        }
        val targetFile = File(targetDir, "${UUID.randomUUID()}.$extension")

        resolver.openInputStream(uri)?.use { input ->
            FileOutputStream(targetFile).use { output ->
                input.copyTo(output)
            }
        } ?: throw IllegalStateException("Unable to open the selected voice file")

        val map = Arguments.createMap()
        map.putString("path", targetFile.absolutePath)
        map.putString("name", displayName)
        map.putString("mimeType", mimeType)
        map.putDouble("size", targetFile.length().toDouble())
        return map
    }

    private fun writeBackup(uri: Uri, content: String) {
        reactContext.contentResolver.openOutputStream(uri, "w")?.use { output ->
            output.write(content.toByteArray(Charsets.UTF_8))
            output.flush()
        } ?: throw IllegalStateException("Unable to write the selected backup file")
    }

    private fun readBackupFile(uri: Uri): WritableMap {
        val resolver = reactContext.contentResolver
        var size: Long? = null
        resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (sizeIndex >= 0 && cursor.moveToFirst() && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
        }
        if (size?.let { it > MAX_BACKUP_BYTES } == true) throw IllegalArgumentException("Backup file exceeds the 10 MB limit")

        val content = resolver.openInputStream(uri)?.use { input ->
            val bytes = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > MAX_BACKUP_BYTES) throw IllegalArgumentException("Backup file exceeds the 10 MB limit")
                bytes.write(buffer, 0, count)
            }
            if (size == null) size = total.toLong()
            bytes.toByteArray().toString(Charsets.UTF_8)
        } ?: throw IllegalStateException("Unable to read the selected backup file")

        return Arguments.createMap().apply {
            putString("content", content)
            putString("name", queryDisplayName(uri) ?: "Thought-Notes-Backup.json")
            putDouble("size", (size ?: 0L).toDouble())
        }
    }

    private fun queryDisplayName(uri: Uri): String? {
        val resolver = reactContext.contentResolver
        resolver.query(uri, null, null, null, null)?.use { cursor: Cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (nameIndex >= 0 && cursor.moveToFirst()) {
                return cursor.getString(nameIndex)
            }
        }

        return null
    }

    private fun resolveExtension(displayName: String, mimeType: String?): String {
        val fromDisplayName = displayName.substringAfterLast('.', "").trim()
        if (fromDisplayName.isNotEmpty()) {
            return fromDisplayName
        }

        return when (mimeType?.lowercase()) {
            "audio/mp4", "audio/m4a" -> "m4a"
            "audio/mpeg" -> "mp3"
            "audio/wav", "audio/x-wav" -> "wav"
            "audio/aac" -> "aac"
            "audio/ogg" -> "ogg"
            "audio/opus" -> "opus"
            else -> MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType) ?: "m4a"
        }
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        reactContext.removeActivityEventListener(this)
        pendingPromise = null
        pendingBackupContent = null
    }

    companion object {
        private const val REQUEST_CODE_PICK_VOICE_FILE = 6147
        private const val REQUEST_CODE_EXPORT_BACKUP = 6148
        private const val REQUEST_CODE_PICK_BACKUP = 6149
        private const val MAX_BACKUP_BYTES = 10L * 1024L * 1024L
    }
}
