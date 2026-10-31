package com.meharaj.contextengine

import android.content.Context
import android.util.AtomicFile
import org.json.JSONObject
import java.io.File
import java.util.UUID

internal data class IncomingSharedContentEntry(val id: String, val text: String)

internal object IncomingShareOutbox {
    private val validId = Regex("shared-[0-9a-f-]{36}")

    @Synchronized
    fun save(context: Context, text: String): IncomingSharedContentEntry {
        val content = text.trim()
        require(content.isNotEmpty())
        val id = "shared-${UUID.randomUUID()}"
        val directory = File(context.filesDir, "incoming-share-outbox")
        check(directory.isDirectory || directory.mkdirs()) { "Could not create shared text outbox" }
        val file = AtomicFile(File(directory, "$id.json"))
        val stream = file.startWrite()
        try {
            stream.write(JSONObject().put("id", id).put("text", content).put("createdAt", System.currentTimeMillis()).toString().toByteArray(Charsets.UTF_8))
            file.finishWrite(stream)
        } catch (error: Exception) {
            file.failWrite(stream)
            throw error
        }
        return IncomingSharedContentEntry(id, content)
    }

    @Synchronized
    fun read(context: Context): List<IncomingSharedContentEntry> =
        File(context.filesDir, "incoming-share-outbox").listFiles().orEmpty()
            .filter { it.name.endsWith(".json") || it.name.endsWith(".json.bak") }
            .map { it.name.removeSuffix(".bak") }.distinct().mapNotNull { name ->
                try {
                    val file = AtomicFile(File(context.filesDir, "incoming-share-outbox/$name"))
                    val data = JSONObject(file.openRead().bufferedReader().use { it.readText() })
                    val id = data.getString("id")
                    require(validId.matches(id) && name == "$id.json")
                    IncomingSharedContentEntry(id, data.getString("text").also { require(it.isNotBlank()) }) to data.getLong("createdAt")
                } catch (_: Exception) {
                    null
                }
            }.sortedBy { it.second }.map { it.first }

    @Synchronized
    fun acknowledge(context: Context, id: String) {
        require(validId.matches(id))
        val file = AtomicFile(File(context.filesDir, "incoming-share-outbox/$id.json"))
        file.delete()
        check(!file.baseFile.exists()) { "Could not acknowledge shared text" }
    }
}
