import AppIntents

private let voiceIntegrationsReleased = false

@available(iOS 16.0, *)
struct CaptureThoughtIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture Thought"
    static var description = IntentDescription("Sends text into Thought Notes through Siri or Shortcuts.")

    static var isDiscoverable: Bool = false
    static var openAppWhenRun: Bool = true

    static var parameterSummary: some ParameterSummary {
        Summary("Capture \(\.$content)")
    }

    @Parameter(title: "Content")
    var content: String

    @MainActor
    func perform() async throws -> some IntentResult {
        // Re-enable together with the shared release capability and shortcut registration.
        guard voiceIntegrationsReleased else { return .result() }
        UserDefaults.standard.set(content, forKey: "PendingAssistantCapture")
        NotificationCenter.default.post(
            name: NSNotification.Name("AssistantCaptureRequested"),
            object: nil,
            userInfo: ["content": content]
        )
        return .result()
    }
}

// Future builds must also re-enable the JS/native release capability gates.
#if CONTEXT_ENGINE_VOICE_FUTURE
@available(iOS 16.0, *)
struct ContextEngineShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CaptureThoughtIntent(),
            phrases: [
                "Add a thought to \(.applicationName)",
                "Capture a thought with \(.applicationName)"
            ],
            shortTitle: "Capture Thought",
            systemImageName: "mic.fill"
        )
    }
}
#endif
