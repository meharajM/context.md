import AppIntents

@available(iOS 16.0, *)
struct CaptureThoughtIntent: AppIntent {
    static var title: LocalizedStringResource = "Capture Thought"
    static var description = IntentDescription("Triggers the Context Engine to start recording a thought.")

    static var openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        // This is a bridge. In a real RN app, we would emit an event 
        // via a NativeModule to the JS layer.
        NotificationCenter.default.post(name: NSNotification.Name("TriggerVoiceCapture"), object: nil)
        return .result()
    }
}

@available(iOS 16.0, *)
struct ContextEngineShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CaptureThoughtIntent(),
            phrases: [
                "Remember with \(.applicationName)",
                "Capture thought in \(.applicationName)"
            ],
            shortTitle: "Capture Thought",
            systemImageName: "mic.fill"
        )
    }
}
