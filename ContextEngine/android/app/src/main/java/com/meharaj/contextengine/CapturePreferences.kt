package com.meharaj.contextengine

import android.content.Context
import org.json.JSONObject
import java.io.File

internal data class CaptureSettings(val text: Boolean, val voice: Boolean)
internal data class StoredCaptureSettings(val revision: Long, val settings: CaptureSettings)

internal object CapturePreferences {
    fun read(context: Context): CaptureSettings {
        val directory = File(context.filesDir, "setup")
        val latest = (0..1).mapNotNull { slot ->
            runCatching { File(directory, "preferences-$slot.json").readText() }
                .getOrNull()?.let(::parse)
        }.maxByOrNull(StoredCaptureSettings::revision)
        return latest?.settings ?: CaptureSettings(text = true, voice = true)
    }

    internal fun parse(json: String): StoredCaptureSettings? = runCatching {
        val value = JSONObject(json)
        val version = value.getInt("version")
        val revision = value.getLong("revision")
        require(version in 1..2 && revision >= 0)
        val textEnabled = if (version == 1) true else value.getBoolean("manualCaptureEnabled")
        val voiceEnabled = if (version == 1) true else value.getBoolean("pushToRecordEnabled")
        StoredCaptureSettings(revision, CaptureSettings(textEnabled, voiceEnabled))
    }.getOrNull()
}
