package com.meharaj.contextengine

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import com.facebook.react.bridge.*
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.SamplerConfig
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONObject
import java.io.File

/**
 * Android native module bridging React Native to LiteRT-LM on-device synthesis.
 *
 * Mirrors the iOS LiteRtModule.swift contract:
 *   - isAvailable()
 *   - loadModel(config)
 *   - synthesize(input)
 *   - benchmark(fixtures)
 *   - release()
 *
 * All engine operations hold a mutex, including while asynchronous inference is suspended,
 * matching the serial native execution queue pattern used in the iOS bridge.
 */
class LiteRtModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LiteRtModule"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val engineMutex = Mutex()

    // Engine operations and state writes are protected by engineMutex.
    private var engine: Engine? = null
    private var samplerConfig: SamplerConfig? = null
    private var loadedModelPath: String? = null
    private var loadedBackend: String? = null
    private var loadedMaxTokens: Int? = null
    private var liteRtState: String = "idle"

    private val synthesisTimeoutMs: Long = 30_000

    companion object {
        private const val SYSTEM_INSTRUCTION =
            "You are Context Engine's private on-device synthesis and filing unit. Compare topic meaning and persisted context, never default to the first topic, preserve the thought, and return compact JSON only. If the topic is ambiguous, ask one focused question with 2 or 3 topic options instead of guessing."
    }

    // ─── Bridge methods ─────────────────────────────────────────────────

    @ReactMethod
    fun isAvailable(promise: Promise) {
        try {
            // Check if litertlm classes are on the classpath
            Class.forName("com.google.ai.edge.litertlm.Engine")
            promise.resolve(true)
        } catch (_: ClassNotFoundException) {
            promise.resolve(false)
        } catch (_: LinkageError) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getDeviceReadiness(promise: Promise) {
        try {
            val activityManager = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            val memoryInfo = ActivityManager.MemoryInfo().also(activityManager::getMemoryInfo)
            val powerManager = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val thermalState = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                when (powerManager.currentThermalStatus) {
                    PowerManager.THERMAL_STATUS_NONE,
                    PowerManager.THERMAL_STATUS_LIGHT,
                    PowerManager.THERMAL_STATUS_MODERATE -> "nominal"
                    PowerManager.THERMAL_STATUS_SEVERE -> "serious"
                    PowerManager.THERMAL_STATUS_CRITICAL,
                    PowerManager.THERMAL_STATUS_EMERGENCY,
                    PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
                    else -> "unknown"
                }
            } else {
                "unknown"
            }
            val isEmulator = Build.FINGERPRINT.startsWith("generic") ||
                Build.MODEL.contains("emulator", ignoreCase = true) ||
                Build.MODEL.contains("sdk", ignoreCase = true)

            promise.resolve(Arguments.createMap().apply {
                putBoolean("checkAvailable", true)
                putBoolean("isSimulator", isEmulator)
                putDouble("totalMemoryBytes", memoryInfo.totalMem.toDouble())
                putDouble("availableMemoryBytes", memoryInfo.availMem.toDouble())
                putBoolean("lowMemory", memoryInfo.lowMemory)
                putString("thermalState", thermalState)
                putString("osVersion", Build.VERSION.RELEASE)
                putInt("apiLevel", Build.VERSION.SDK_INT)
            })
        } catch (error: Exception) {
            promise.reject("DEVICE_READINESS_UNAVAILABLE", "Could not read Android device resources.", error)
        }
    }

    @ReactMethod
    fun loadModel(config: ReadableMap, promise: Promise) {
        val modelPath = config.getString("modelPath")
        if (modelPath.isNullOrBlank()) {
            promise.reject(
                "LITERT_MODEL_PATH_MISSING",
                rejectionMessage("LiteRT-LM modelPath is required.")
            )
            return
        }

        if (!File(modelPath).exists()) {
            promise.reject(
                "LITERT_MODEL_MISSING",
                rejectionMessage("LiteRT-LM model not found at $modelPath", modelPath = modelPath)
            )
            return
        }

        scope.launch {
            engineMutex.withLock {
                try {
                    releaseLoadedModel()
                    liteRtState = "loading"

                    val backendLabel = if (config.hasKey("backend")) config.getString("backend") ?: "gpu" else "gpu"
                    val maxTokens = if (config.hasKey("maxTokens")) config.getInt("maxTokens") else 512
                    val topK = if (config.hasKey("topK")) config.getInt("topK") else 40
                    val topP = if (config.hasKey("topP")) config.getDouble("topP") else 0.95
                    val temperature = if (config.hasKey("temperature")) config.getDouble("temperature") else 0.0
                    val cacheDir = if (config.hasKey("cacheDir")) config.getString("cacheDir")
                        ?: reactApplicationContext.cacheDir.absolutePath
                    else reactApplicationContext.cacheDir.absolutePath
                    val cacheDirectory = File(cacheDir)
                    if (!cacheDirectory.isDirectory && !cacheDirectory.mkdirs()) {
                        throw IllegalStateException("Could not create LiteRT cache directory: ${cacheDirectory.absolutePath}")
                    }
                    if (!cacheDirectory.canWrite()) {
                        throw IllegalStateException("LiteRT cache directory is not writable: ${cacheDirectory.absolutePath}")
                    }

                    samplerConfig = SamplerConfig(topK = topK, topP = topP, temperature = temperature)
                    val backend = when (backendLabel) {
                        "cpu" -> Backend.CPU()
                        "gpu" -> Backend.GPU()
                        "npu" -> Backend.NPU(reactApplicationContext.applicationInfo.nativeLibraryDir)
                        else -> throw IllegalArgumentException("Unsupported LiteRT-LM backend: $backendLabel")
                    }
                    val engineInstance = Engine(EngineConfig(
                        modelPath = modelPath,
                        backend = backend,
                        maxNumTokens = maxTokens,
                        cacheDir = cacheDirectory.absolutePath,
                    ))
                    engine = engineInstance
                    engineInstance.initialize()
                    ensureActive()

                    loadedModelPath = modelPath
                    loadedBackend = backendLabel
                    loadedMaxTokens = maxTokens
                    liteRtState = "ready"

                    val result = Arguments.createMap().apply {
                        putBoolean("loaded", true)
                        putString("modelPath", modelPath)
                        putString("backend", backendLabel)
                    }
                    promise.resolve(result)
                } catch (e: Throwable) {
                    if (e !is Exception && e !is LinkageError) throw e
                    releaseLoadedModel()
                    if (e is CancellationException && !isActive) throw e
                    promise.reject(
                        "LITERT_LOAD_FAILED",
                        rejectionMessage(
                            e.message ?: "Unknown load error",
                            modelPath = modelPath,
                            backend = if (config.hasKey("backend")) config.getString("backend") else null,
                            maxTokens = if (config.hasKey("maxTokens")) config.getInt("maxTokens") else null
                        ),
                        e
                    )
                }
            }
        }
    }

    @ReactMethod
    fun synthesize(input: ReadableMap, promise: Promise) {
        val transcript = input.getString("transcript")
        if (transcript.isNullOrBlank()) {
            promise.reject(
                "LITERT_TRANSCRIPT_MISSING",
                rejectionMessage("Transcript is required.")
            )
            return
        }

        scope.launch {
            engineMutex.withLock {
                val currentEngine = engine
                if (currentEngine == null || liteRtState != "ready") {
                    promise.reject(
                        "LITERT_NOT_READY",
                        rejectionMessage("LiteRT-LM engine is not ready.")
                    )
                    return@withLock
                }
                try {
                    liteRtState = "synthesizing"

                    val prompt = if (input.hasKey("prompt") && !input.getString("prompt").isNullOrBlank()) {
                        input.getString("prompt")!!
                    } else {
                        val existingTopics = if (input.hasKey("existingTopics")) {
                            val arr = input.getArray("existingTopics")
                            (0 until (arr?.size() ?: 0)).mapNotNull { arr?.getString(it) }
                        } else emptyList()
                        buildSynthesisPrompt(transcript, existingTopics)
                    }

                    val conversationConfig = ConversationConfig(
                        systemInstruction = Contents.of(SYSTEM_INSTRUCTION),
                        samplerConfig = samplerConfig,
                    )
                    val result = currentEngine.createConversation(conversationConfig).use { conversation ->
                        collectLiteRtResponse(
                            conversation.sendMessageAsync(prompt).map { it.toString() },
                            synthesisTimeoutMs,
                            conversation::cancelProcess,
                        )
                    }

                    val parsed = parseSynthesizedThought(result, transcript)
                    liteRtState = "ready"
                    promise.resolve(parsed)
                } catch (e: Throwable) {
                    if (e !is Exception && e !is LinkageError) throw e
                    val detail = rejectionMessage(
                        if (e is TimeoutCancellationException) "LiteRT-LM synthesis timed out."
                        else e.message ?: "Unknown synthesis error"
                    )
                    releaseLoadedModel()
                    if (e is CancellationException && !isActive) throw e
                    promise.reject(
                        if (e is TimeoutCancellationException) "LITERT_SYNTHESIS_TIMEOUT" else "LITERT_SYNTHESIS_FAILED",
                        detail,
                        e
                    )
                }
            }
        }
    }

    @ReactMethod
    fun benchmark(fixtures: ReadableArray, promise: Promise) {
        val fixtureCount = fixtures.size()
        scope.launch {
            engineMutex.withLock {
                val result = Arguments.createMap().apply {
                    putBoolean("loaded", loadedModelPath != null)
                    putString("modelPath", loadedModelPath)
                    putString("backend", loadedBackend)
                    loadedMaxTokens?.let { putInt("maxTokens", it) }
                    putString("state", liteRtState)
                    putInt("fixtureCount", fixtureCount)
                }
                promise.resolve(result)
            }
        }
    }

    @ReactMethod
    fun release(promise: Promise) {
        scope.launch {
            engineMutex.withLock {
                releaseLoadedModel()
                promise.resolve(null)
            }
        }
    }

    // ─── Internal helpers ───────────────────────────────────────────────

    private fun releaseLoadedModel() {
        val currentEngine = engine
        if (currentEngine != null) {
            try {
                if (currentEngine.isInitialized()) currentEngine.close()
            } catch (error: Throwable) {
                if (error !is Exception && error !is LinkageError) throw error
                // Ignore cleanup failures.
            }
        }
        clearLoadedModel()
    }

    private fun clearLoadedModel() {
        engine = null
        samplerConfig = null
        loadedModelPath = null
        loadedBackend = null
        loadedMaxTokens = null
        liteRtState = "idle"
    }

    private fun buildSynthesisPrompt(transcript: String, existingTopics: List<String>): String {
        val topicsStr = existingTopics.joinToString(", ")
        return """
            You are a private on-device filing engine for a local context.md file. Categorize and lightly refine this captured thought.
            Existing topics: $topicsStr
            Compare the meaning with the existing topics; do not default to the first topic. Prefer an existing topic when it fits. If the thought is ambiguous, ask one focused clarification question and provide 2 or 3 topic options instead of guessing.
            Return JSON only with this schema:
            {"topic":"Topic","refinedText":"Clear thought","tags":["tag"],"needsClarification":false,"clarification":null}
            Transcript: $transcript
        """.trimIndent()
    }

    private fun parseSynthesizedThought(text: String, transcript: String): WritableMap {
        val result = Arguments.createMap()

        val start = text.indexOf('{')
        val end = text.lastIndexOf('}')

        if (start == -1 || end == -1 || start >= end) {
            result.putString("topic", "Inbox")
            result.putString("refinedText", transcript)
            val tags = Arguments.createArray()
            tags.pushString("litert")
            result.putArray("tags", tags)
            return result
        }

        try {
            var jsonText = text.substring(start, end + 1)
            // Remove trailing commas before closing brackets
            jsonText = jsonText.replace(Regex(",\\s*([}\\]])"), "$1")
            val json = JSONObject(jsonText)

            result.putString("topic", json.optString("topic", "Inbox"))
            result.putString("refinedText", json.optString("refinedText", transcript))

            val tagsArray = Arguments.createArray()
            val jsonTags = json.optJSONArray("tags")
            if (jsonTags != null) {
                for (i in 0 until jsonTags.length()) {
                    tagsArray.pushString(jsonTags.optString(i))
                }
            } else {
                tagsArray.pushString("litert")
            }
            result.putArray("tags", tagsArray)

            val needsClarification = json.optBoolean("needsClarification", false)
            result.putBoolean("needsClarification", needsClarification)
            val clarificationJson = json.optJSONObject("clarification")
            if (needsClarification && clarificationJson != null) {
                val clarification = Arguments.createMap()
                clarification.putString("question", clarificationJson.optString("question", ""))
                val options = Arguments.createArray()
                val jsonOptions = clarificationJson.optJSONArray("options")
                if (jsonOptions != null) {
                    for (i in 0 until minOf(jsonOptions.length(), 3)) {
                        val optionJson = jsonOptions.optJSONObject(i) ?: continue
                        val option = Arguments.createMap()
                        option.putString("topic", optionJson.optString("topic", ""))
                        option.putString("reason", optionJson.optString("reason", ""))
                        options.pushMap(option)
                    }
                }
                clarification.putArray("options", options)
                result.putMap("clarification", clarification)
            }
        } catch (_: Exception) {
            result.putString("topic", "Inbox")
            result.putString("refinedText", transcript)
            val tags = Arguments.createArray()
            tags.pushString("litert")
            result.putArray("tags", tags)
        }

        return result
    }

    private fun rejectionMessage(
        message: String,
        modelPath: String? = null,
        backend: String? = null,
        maxTokens: Int? = null,
        state: String? = null
    ): String {
        val detail = listOf(
            "modelPath=${modelPath ?: loadedModelPath ?: "unloaded"}",
            "backend=${backend ?: loadedBackend ?: "unknown"}",
            "maxTokens=${maxTokens ?: loadedMaxTokens ?: 0}",
            "state=${state ?: liteRtState}"
        ).joinToString(" ")
        return "$message $detail"
    }

    override fun invalidate() {
        scope.coroutineContext.cancelChildren()
        scope.launch {
            try {
                engineMutex.withLock { releaseLoadedModel() }
            } finally {
                scope.cancel()
            }
        }
        super.invalidate()
    }
}

internal suspend fun collectLiteRtResponse(
    messages: Flow<String>,
    timeoutMs: Long,
    cancelProcess: () -> Unit,
): String {
    try {
        return withTimeout(timeoutMs) {
            buildString {
                messages.collect { append(it) }
            }
        }
    } catch (error: Throwable) {
        if (error !is Exception && error !is LinkageError) throw error
        // Flow cancellation alone does not stop LiteRT's native inference.
        try {
            cancelProcess()
        } catch (cleanupError: Throwable) {
            if (cleanupError !is Exception && cleanupError !is LinkageError) throw cleanupError
            error.addSuppressed(cleanupError)
        }
        throw error
    }
}
