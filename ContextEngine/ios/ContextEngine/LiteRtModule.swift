import Foundation
import React

#if canImport(LiteRTLM)
import LiteRTLM
#endif

@objc(LiteRtModule)
class LiteRtModule: NSObject {
  #if canImport(LiteRTLM)
  private var engine: Engine?
  private var conversation: Conversation?
  #endif

  private var loadedModelPath: String?
  private var loadedBackend: String?

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(isAvailable:rejecter:)
  func isAvailable(resolve: RCTPromiseResolveBlock, reject: RCTPromiseRejectBlock) {
    #if canImport(LiteRTLM)
    resolve(true)
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
      reject("LITERT_MODEL_PATH_MISSING", "LiteRT-LM modelPath is required.", nil)
      return
    }

    guard FileManager.default.fileExists(atPath: modelPath) else {
      reject("LITERT_MODEL_MISSING", "LiteRT-LM model not found at \(modelPath)", nil)
      return
    }

    #if canImport(LiteRTLM)
    Task {
      do {
        try await releaseLoadedModel()

        let backendLabel = (config["backend"] as? String) ?? "gpu"
        let backend: Backend = backendLabel == "cpu" ? .cpu : .gpu
        let maxTokens = config["maxTokens"] as? Int ?? 512
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
          topP: topP,
          temperature: temperature
        )
        let conversationConfig = ConversationConfig(
          systemMessage: Message(Self.systemInstruction),
          samplerConfig: samplerConfig
        )
        let loadedConversation = try await loadedEngine.createConversation(with: conversationConfig)

        self.engine = loadedEngine
        self.conversation = loadedConversation
        self.loadedModelPath = modelPath
        self.loadedBackend = backendLabel

        resolve([
          "loaded": true,
          "modelPath": modelPath,
          "backend": backendLabel,
        ])
      } catch {
        reject("LITERT_LOAD_FAILED", error.localizedDescription, error)
      }
    }
    #else
    reject(
      "LITERTLM_NOT_LINKED",
      "LiteRT-LM Swift package is not linked. Add https://github.com/google-ai-edge/LiteRT-LM to the iOS target.",
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
      reject("LITERT_TRANSCRIPT_MISSING", "Transcript is required.", nil)
      return
    }

    #if canImport(LiteRTLM)
    guard let conversation else {
      reject("LITERT_NOT_READY", "LiteRT-LM conversation has not been initialized.", nil)
      return
    }

    let topics = input["existingTopics"] as? [String] ?? []
    let prompt = Self.buildSynthesisPrompt(transcript: transcript, existingTopics: topics)

    Task {
      do {
        let response = try await conversation.sendMessage(Message(prompt))
        let parsed = try Self.parseSynthesizedThought(response.toString, transcript: transcript)
        resolve(parsed)
      } catch {
        reject("LITERT_SYNTHESIS_FAILED", error.localizedDescription, error)
      }
    }
    #else
    reject(
      "LITERTLM_NOT_LINKED",
      "LiteRT-LM Swift package is not linked. Add https://github.com/google-ai-edge/LiteRT-LM to the iOS target.",
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
      "fixtureCount": fixtures.count,
    ])
  }

  @objc(release:rejecter:)
  func release(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    #if canImport(LiteRTLM)
    Task {
      await releaseLoadedModel()
      resolve(nil)
    }
    #else
    loadedModelPath = nil
    loadedBackend = nil
    resolve(nil)
    #endif
  }

  #if canImport(LiteRTLM)
  private func releaseLoadedModel() async throws {
    conversation = nil
    engine = nil
    loadedModelPath = nil
    loadedBackend = nil
  }
  #endif

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

    let jsonText = String(text[start...end])
    let data = Data(jsonText.utf8)
    let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]

    return [
      "topic": (json?["topic"] as? String) ?? "Inbox",
      "refinedText": (json?["refinedText"] as? String) ?? transcript,
      "tags": (json?["tags"] as? [String]) ?? ["litert"],
    ]
  }
}
