import Foundation
import React

#if canImport(LiteRTLM)
import LiteRTLM
#endif

@objc(LiteRtModule)
class LiteRtModule: NSObject {
#if canImport(LiteRTLM)
  private var engine: Engine?
#endif

  private let executionQueue = DispatchQueue(label: "com.meharaj.contextengine.litert")
  private var loadedModelPath: String?
  private var loadedBackend: String?
  private var loadedMaxTokens: Int?
  private var liteRtState = "idle"
  private static let synthesisTimeoutSeconds: TimeInterval = 30

  #if canImport(LiteRTLM)
  private var loadedSamplerConfig: SamplerConfig?
  #endif

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(isAvailable:rejecter:)
  func isAvailable(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    #if canImport(LiteRTLM)
    #if targetEnvironment(simulator)
    resolve(false)
    #else
    resolve(true)
    #endif
    #else
    resolve(false)
    #endif
  }

  @objc(loadModel:resolver:rejecter:)
  func loadModel(
    config: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let modelPath = config["modelPath"] as? String, !modelPath.isEmpty else {
      reject("LITERT_MODEL_PATH_MISSING", rejectionMessage("LiteRT-LM modelPath is required."), nil)
      return
    }

    guard FileManager.default.fileExists(atPath: modelPath) else {
      reject("LITERT_MODEL_MISSING", rejectionMessage("LiteRT-LM model not found at \(modelPath)", modelPath: modelPath), nil)
      return
    }

    #if canImport(LiteRTLM)
    let backendLabel = (config["backend"] as? String) ?? "gpu"
    let maxTokens = config["maxTokens"] as? Int ?? 512

    #if targetEnvironment(simulator)
    reject(
      "LITERT_UNSUPPORTED_SIMULATOR",
      rejectionMessage(
        "LiteRT-LM is disabled on iOS Simulator because the native runtime is unstable in this environment.",
        modelPath: modelPath,
        backend: backendLabel,
        maxTokens: maxTokens,
        state: liteRtState
      ),
      nil
    )
    return
    #endif

    executionQueue.async {
      let semaphore = DispatchSemaphore(value: 0)

      Task {
        do {
          try await self.releaseLoadedModel()

          self.liteRtState = "loading"
          let backend: Backend = backendLabel == "cpu" ? .cpu() : .gpu
          let cacheDir = (config["cacheDir"] as? String) ?? NSTemporaryDirectory()
          let topK = config["topK"] as? Int ?? 40
          let topP = config["topP"] as? Double ?? 0.95
          let temperature = config["temperature"] as? Double ?? 0.0

          let engineConfig = try EngineConfig(
            modelPath: modelPath,
            backend: backend,
            maxNumTokens: maxTokens,
            cacheDir: cacheDir
          )
          let loadedEngine = Engine(engineConfig: engineConfig)
          try await loadedEngine.initialize()

          let samplerConfig = try SamplerConfig(
            topK: topK,
            topP: Float(topP),
            temperature: Float(temperature)
          )

          self.engine = loadedEngine
          self.loadedModelPath = modelPath
          self.loadedBackend = backendLabel
          self.loadedMaxTokens = maxTokens
          self.loadedSamplerConfig = samplerConfig
          self.liteRtState = "ready"

          resolve([
            "loaded": true,
            "modelPath": modelPath,
            "backend": backendLabel,
          ])
        } catch {
          try? await self.releaseLoadedModel()
          reject(
            "LITERT_LOAD_FAILED",
            self.rejectionMessage(error.localizedDescription, modelPath: modelPath, backend: backendLabel, maxTokens: maxTokens),
            error
          )
        }

        semaphore.signal()
      }

      semaphore.wait()
    }
    #else
    reject(
      "LITERTLM_NOT_LINKED",
      rejectionMessage("LiteRT-LM Swift package is not linked. Add https://github.com/google-ai-edge/LiteRT-LM to the iOS target."),
      nil
    )
    #endif
  }

  @objc(synthesize:resolver:rejecter:)
  func synthesize(
    input: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let transcript = input["transcript"] as? String, !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      reject("LITERT_TRANSCRIPT_MISSING", rejectionMessage("Transcript is required."), nil)
      return
    }

    #if canImport(LiteRTLM)
    #if targetEnvironment(simulator)
    reject(
      "LITERT_UNSUPPORTED_SIMULATOR",
      rejectionMessage("LiteRT-LM synthesis is disabled on iOS Simulator because the native runtime is unstable."),
      nil
    )
    return
    #endif

    let prompt: String
    if let customPrompt = input["prompt"] as? String, !customPrompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      prompt = customPrompt
    } else {
      let topics = input["existingTopics"] as? [String] ?? []
      prompt = Self.buildSynthesisPrompt(transcript: transcript, existingTopics: topics)
    }

    executionQueue.async {
      let semaphore = DispatchSemaphore(value: 0)
      let completionLock = NSLock()
      var completed = false
      var sendTask: Task<Void, Never>?
      var activeConversation: Conversation?

      func finish(_ block: @escaping () -> Void) {
        completionLock.lock()
        if completed {
          completionLock.unlock()
          return
        }
        completed = true
        completionLock.unlock()

        block()
        semaphore.signal()
      }

      sendTask = Task {
        do {
          let conversation = try await self.createSynthesisConversation()

          self.liteRtState = "synthesizing"
          completionLock.lock()
          activeConversation = conversation
          completionLock.unlock()

          let response = try await conversation.sendMessage(Message(prompt))
          let parsed = try Self.parseSynthesizedThought(response.toString, transcript: transcript)

          finish {
            self.liteRtState = "ready"
            resolve(parsed)
          }
        } catch LiteRtModuleError.notReady {
          finish {
            reject("LITERT_NOT_READY", self.rejectionMessage("LiteRT-LM conversation has not been initialized."), nil)
          }
        } catch {
          finish {
            self.clearLoadedModel()
            reject("LITERT_SYNTHESIS_FAILED", self.rejectionMessage(error.localizedDescription), error)
          }
        }
      }

      DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + Self.synthesisTimeoutSeconds) {
        sendTask?.cancel()
        completionLock.lock()
        let conversationToCancel = activeConversation
        completionLock.unlock()
        try? conversationToCancel?.cancel()
        finish {
          self.clearLoadedModel()
          reject("LITERT_SYNTHESIS_TIMEOUT", self.rejectionMessage("LiteRT-LM synthesis timed out."), nil)
        }
      }

      semaphore.wait()
    }
    #else
    reject(
      "LITERTLM_NOT_LINKED",
      rejectionMessage("LiteRT-LM Swift package is not linked. Add https://github.com/google-ai-edge/LiteRT-LM to the iOS target."),
      nil
    )
    #endif
  }

  @objc(benchmark:resolver:rejecter:)
  func benchmark(
    fixtures: NSArray,
    resolve: RCTPromiseResolveBlock,
    reject: RCTPromiseRejectBlock
  ) {
    resolve([
      "loaded": loadedModelPath != nil,
      "modelPath": loadedModelPath ?? NSNull(),
      "backend": loadedBackend ?? NSNull(),
      "maxTokens": loadedMaxTokens ?? NSNull(),
      "state": liteRtState,
      "fixtureCount": fixtures.count,
    ])
  }

  @objc(release:rejecter:)
  func release(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    #if canImport(LiteRTLM)
    executionQueue.async {
      let semaphore = DispatchSemaphore(value: 0)

      Task {
        try? await self.releaseLoadedModel()
        resolve(nil)
        semaphore.signal()
      }

      semaphore.wait()
    }
    #else
    executionQueue.async {
      self.loadedModelPath = nil
      self.loadedBackend = nil
      self.loadedMaxTokens = nil
      self.liteRtState = "idle"
      resolve(nil)
    }
    #endif
  }

  #if canImport(LiteRTLM)
  private func releaseLoadedModel() async throws {
    clearLoadedModel()
  }

  private func createSynthesisConversation() async throws -> Conversation {
    guard let engine else {
      throw LiteRtModuleError.notReady
    }

    let conversationConfig = ConversationConfig(
      systemMessage: Message(Self.systemInstruction, role: .system),
      samplerConfig: loadedSamplerConfig
    )

    return try await engine.createConversation(with: conversationConfig)
  }
  #endif

  private func clearLoadedModel() {
    #if canImport(LiteRTLM)
    engine = nil
    #endif
    loadedModelPath = nil
    loadedBackend = nil
    loadedMaxTokens = nil
    #if canImport(LiteRTLM)
    loadedSamplerConfig = nil
    #endif
    liteRtState = "idle"
  }

  private func rejectionMessage(
    _ message: String,
    modelPath: String? = nil,
    backend: String? = nil,
    maxTokens: Int? = nil,
    state: String? = nil
  ) -> String {
    let detail = [
      "modelPath=\(modelPath ?? loadedModelPath ?? "unloaded")",
      "backend=\(backend ?? loadedBackend ?? "unknown")",
      "maxTokens=\(maxTokens ?? loadedMaxTokens ?? 0)",
      "state=\(state ?? liteRtState)",
    ].joined(separator: " ")

    return "\(message) \(detail)"
  }

  private enum LiteRtModuleError: Error {
    case notReady
  }

  private static let systemInstruction = """
  You are Context Engine's on-device synthesis unit. Return compact JSON only.
  """

  private static func buildSynthesisPrompt(transcript: String, existingTopics: [String]) -> String {
    return """
    Categorize and lightly refine this captured thought for a local context.md file.
    Existing topics: \(existingTopics.joined(separator: ", "))
    Use an existing topic when it fits. If not, create a concise topic.
    Return JSON only with this schema:
    {"topic":"Topic","refinedText":"Clear thought","tags":["tag"]}
    Transcript: \(transcript)
    """
  }

  private static func parseSynthesizedThought(_ text: String, transcript: String) throws -> [String: Any] {
    guard
      let start = text.firstIndex(of: "{"),
      let end = text.lastIndex(of: "}")
    else {
      return [
        "topic": "Inbox",
        "refinedText": transcript,
        "tags": ["litert"],
      ]
    }

    var jsonText = String(text[start...end])
    if let regex = try? NSRegularExpression(pattern: ",\\s*([\\}\\]])", options: []) {
      let range = NSRange(jsonText.startIndex..<jsonText.endIndex, in: jsonText)
      jsonText = regex.stringByReplacingMatches(in: jsonText, options: [], range: range, withTemplate: "$1")
    }

    let data = Data(jsonText.utf8)
    let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

    return [
      "topic": (json?["topic"] as? String) ?? "Inbox",
      "refinedText": (json?["refinedText"] as? String) ?? transcript,
      "tags": (json?["tags"] as? [String]) ?? ["litert"],
    ]
  }
}
