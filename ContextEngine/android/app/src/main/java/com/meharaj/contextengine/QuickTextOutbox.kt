package com.meharaj.contextengine

import android.content.Context
import android.util.AtomicFile
import android.util.Log
import org.json.JSONObject
import java.io.File

internal data class QuickTextEntry(val noteId: String, val text: String, val createdAt: Long)

internal object QuickTextOutbox {
    private val validId = Regex("quick-text-[0-9a-f-]{36}")

    @Synchronized
    fun save(context: Context, id: String, text: String) {
        require(validId.matches(id))
        require(text.isNotBlank())
        val directory = File(context.filesDir, "quick-text-outbox")
        check(directory.isDirectory || directory.mkdirs()) { "Could not create text outbox" }
        val file = AtomicFile(File(directory, "$id.json"))
        // Re-delivery of the same reply must not replace its original durable text.
        if (file.baseFile.exists()) return
        val stream = file.startWrite()
        try {
            stream.write(JSONObject().put("noteId", id).put("text", text).put("createdAt", System.currentTimeMillis()).toString().toByteArray(Charsets.UTF_8))
            file.finishWrite(stream)
        } catch (error: Exception) {
            file.failWrite(stream)
            throw error
        }
    }

    @Synchronized
    fun read(context: Context): List<QuickTextEntry> =
        File(context.filesDir, "quick-text-outbox").listFiles().orEmpty()
            .filter { it.name.endsWith(".json") || it.name.endsWith(".json.bak") }
            .map { it.name.removeSuffix(".bak") }.distinct().sorted().mapNotNull { name ->
                try {
                    val file = AtomicFile(File(context.filesDir, "quick-text-outbox/$name"))
                    val data = JSONObject(file.openRead().bufferedReader().use { it.readText() })
                    val id = data.getString("noteId")
                    require(validId.matches(id) && name == "$id.json")
                    val createdAt = data.getLong("createdAt")
                    // Match JavaScript Date bounds before exposing this record to the batch importer.
                    require(createdAt in -8640000000000000L..8640000000000000L)
                    QuickTextEntry(id, data.getString("text").also { require(it.isNotBlank()) }, createdAt)
                } catch (error: Exception) {
                    // Keep unreadable records for recovery without blocking later captures.
                    Log.w("QuickTextOutbox", "Could not read saved capture $name", error)
                    null
                }
            }.sortedBy { it.createdAt }

    @Synchronized
    fun acknowledge(context: Context, id: String) {
        require(validId.matches(id))
        val file = AtomicFile(File(context.filesDir, "quick-text-outbox/$id.json"))
        file.delete()
        check(!file.baseFile.exists()) { "Could not acknowledge saved text" }
    }
}
