package com.meharaj.contextengine

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class VoiceFilePickerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    override fun getName(): String = "VoiceFilePickerModule"

    private var pendingPromise: Promise? = null

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

        pendingPromise = promise
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

        activity.startActivityForResult(intent, REQUEST_CODE_PICK_VOICE_FILE)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE_PICK_VOICE_FILE) {
            return
        }

        val promise = pendingPromise
        pendingPromise = null

        if (promise == null) {
            return
        }

        if (resultCode != Activity.RESULT_OK) {
            promise.reject("VOICE_PICKER_CANCELLED", "User canceled voice file selection")
            return
        }

        val uri = data?.data
        if (uri == null) {
            promise.reject("VOICE_PICKER_EMPTY", "No voice file was selected")
            return
        }

        try {
            val selection = copyVoiceFile(uri)
            promise.resolve(selection)
        } catch (error: Exception) {
            promise.reject("VOICE_PICKER_COPY_FAILED", "Failed to import voice file: ${error.message}", error)
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
    }

    companion object {
        private const val REQUEST_CODE_PICK_VOICE_FILE = 6147
    }
}
