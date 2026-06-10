package com.meharaj.contextengine

import com.facebook.react.bridge.*
import kotlinx.coroutines.*
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
 * All engine operations run on a single-threaded dispatcher to prevent race conditions,
 * matching the serial native execution queue pattern used in the iOS bridge.
 */
class LiteRtModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LiteRtModule"

    // Single-threaded dispatcher for serialised engine operations
    private val engineDispatcher = Dispatchers.IO.limitedParallelism(1)
    private val scope = CoroutineScope(SupervisorJob() + engineDispatcher)

    // Engine state
    private var engine: Any? = null           // com.google.ai.edge.litertlm.Engine when available
    private var loadedModelPath: String? = null
    private var loadedBackend: String? = null
    private var loadedMaxTokens: Int? = null
    private var liteRtState: String = "idle"

    private val synthesisTimeoutMs: Long = 30_000

    companion object {
        private const val SYSTEM_INSTRUCTION =
            "You are Context Engine's on-device synthesis unit. Return compact JSON only."
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

                // Use reflection to access LiteRT-LM classes so the module compiles even
                // if the library AAR is not resolved yet (e.g. offline Gradle sync).
                val engineConfigClass = Class.forName("com.google.ai.edge.litertlm.EngineConfig")
                val engineClass = Class.forName("com.google.ai.edge.litertlm.Engine")
                val backendClass = Class.forName("com.google.ai.edge.litertlm.Backend")

                // Resolve backend
                val backend = when (backendLabel) {
                    "cpu" -> {
                        val cpuMethod = backendClass.getMethod("CPU")
                        cpuMethod.invoke(null)
                    }
                    "npu" -> {
                        val npuMethod = backendClass.getMethod("NPU", String::class.java)
                        npuMethod.invoke(null, reactApplicationContext.applicationInfo.nativeLibraryDir)
                    }
                    else -> {
                        val gpuMethod = backendClass.getMethod("GPU")
                        gpuMethod.invoke(null)
                    }
                }

                // Build EngineConfig
                val engineConfig = engineConfigClass.getConstructor(
                    String::class.java,   // modelPath
                    backendClass,         // backend
                    Int::class.java,      // maxNumTokens
                    String::class.java    // cacheDir
                ).newInstance(modelPath, backend, maxTokens, cacheDir)

                // Create Engine
                val engineInstance = engineClass.getConstructor(engineConfigClass).newInstance(engineConfig)

                // Initialize (suspend function — call via reflection)
                val initMethod = engineClass.getMethod("initialize")
                initMethod.invoke(engineInstance)

                engine = engineInstance
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
            } catch (e: Exception) {
                releaseLoadedModel()
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

        val currentEngine = engine
        if (currentEngine == null || liteRtState != "ready") {
            promise.reject(
                "LITERT_NOT_READY",
                rejectionMessage("LiteRT-LM engine is not ready.")
            )
            return
        }

        scope.launch {
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

                // Create conversation and send message via reflection
                val engineClass = currentEngine.javaClass
                val samplerConfigClass = Class.forName("com.google.ai.edge.litertlm.SamplerConfig")
                val conversationConfigClass = Class.forName("com.google.ai.edge.litertlm.ConversationConfig")
                val messageClass = Class.forName("com.google.ai.edge.litertlm.Message")
                val contentsClass = Class.forName("com.google.ai.edge.litertlm.Contents")

                // Build SamplerConfig
                val samplerConfig = samplerConfigClass.getConstructor(
                    Int::class.java,
                    Float::class.java,
                    Float::class.java
                ).newInstance(
                    loadedMaxTokens ?: 40,
                    0.95f,
                    0.0f
                )

                // Build system instruction
                val systemContent = contentsClass.getMethod("of", String::class.java)
                    .invoke(null, SYSTEM_INSTRUCTION)

                // Build ConversationConfig
                val conversationConfig = conversationConfigClass.getConstructor(
                    contentsClass,
                    samplerConfigClass
                ).newInstance(systemContent, samplerConfig)

                // Create conversation
                val conversation = engineClass.getMethod("createConversation", conversationConfigClass)
                    .invoke(currentEngine, conversationConfig)

                // Send message with timeout
                val result = withTimeoutOrNull(synthesisTimeoutMs) {
                    val response = conversation!!.javaClass.getMethod("sendMessage", String::class.java)
                        .invoke(conversation, prompt)
                    response?.toString() ?: ""
                }

                if (result == null) {
                    clearLoadedModel()
                    promise.reject(
                        "LITERT_SYNTHESIS_TIMEOUT",
                        rejectionMessage("LiteRT-LM synthesis timed out.")
                    )
                    return@launch
                }

                val parsed = parseSynthesizedThought(result, transcript)
                liteRtState = "ready"
                promise.resolve(parsed)
            } catch (e: Exception) {
                clearLoadedModel()
                promise.reject(
                    "LITERT_SYNTHESIS_FAILED",
                    rejectionMessage(e.message ?: "Unknown synthesis error"),
                    e
                )
            }
        }
    }

    @ReactMethod
    fun benchmark(fixtures: ReadableArray, promise: Promise) {
        val result = Arguments.createMap().apply {
            putBoolean("loaded", loadedModelPath != null)
            putString("modelPath", loadedModelPath)
            putString("backend", loadedBackend)
            loadedMaxTokens?.let { putInt("maxTokens", it) }
            putString("state", liteRtState)
            putInt("fixtureCount", fixtures.size())
        }
        promise.resolve(result)
    }

    @ReactMethod
    fun release(promise: Promise) {
        scope.launch {
            releaseLoadedModel()
            promise.resolve(null)
        }
    }

    // ─── Internal helpers ───────────────────────────────────────────────

    private fun releaseLoadedModel() {
        val currentEngine = engine
        if (currentEngine != null) {
            try {
                currentEngine.javaClass.getMethod("close").invoke(currentEngine)
            } catch (_: Exception) {
                // Ignore cleanup failures
            }
        }
        clearLoadedModel()
    }

    private fun clearLoadedModel() {
        engine = null
        loadedModelPath = null
        loadedBackend = null
        loadedMaxTokens = null
        liteRtState = "idle"
    }

    private fun buildSynthesisPrompt(transcript: String, existingTopics: List<String>): String {
        val topicsStr = existingTopics.joinToString(", ")
        return """
            Categorize and lightly refine this captured thought for a local context.md file.
            Existing topics: $topicsStr
            Use an existing topic when it fits. If not, create a concise topic.
            Return JSON only with this schema:
            {"topic":"Topic","refinedText":"Clear thought","tags":["tag"]}
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

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        scope.cancel()
        releaseLoadedModel()
    }
}
