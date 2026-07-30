import AppIntents

@available(iOS 16.0, *)
struct CaptureThoughtIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture Thought"
    static var description = IntentDescription("Sends text into Context Engine through Siri or Shortcuts.")

    static var openAppWhenRun: Bool = true

    static var parameterSummary: some ParameterSummary {
        Summary("Capture \(\.$content)")
    }

    @Parameter(title: "Content")
    var content: String

    @MainActor
    func perform() async throws -> some IntentResult {
        UserDefaults.standard.set(content, forKey: "PendingAssistantCapture")
        NotificationCenter.default.post(
            name: NSNotification.Name("AssistantCaptureRequested"),
            object: nil,
            userInfo: ["content": content]
        )
        return .result()
    }
}

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
