import AppIntents
import SwiftUI
import WidgetKit

private let appGroup = "group.com.meharaj.contextengine"
private let pendingCaptureKey = "PendingWidgetCapture"

private enum QuickCaptureMode: String, AppEnum {
  case write
  case record

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Capture mode"
  static var caseDisplayRepresentations: [QuickCaptureMode: DisplayRepresentation] = [
    .write: "Write",
    .record: "Record",
  ]
}

private struct QuickCaptureIntent: AppIntent {
  static var title: LocalizedStringResource = "Quick capture"
  static var openAppWhenRun = true

  @Parameter(title: "Capture mode")
  var mode: QuickCaptureMode

  init() { mode = .write }
  init(mode: QuickCaptureMode) { self.mode = mode }

  func perform() async throws -> some IntentResult {
    UserDefaults(suiteName: appGroup)?.set(mode.rawValue, forKey: pendingCaptureKey)
    return .result()
  }
}

private struct CaptureEntry: TimelineEntry {
  let date: Date
}

private struct CaptureProvider: TimelineProvider {
  func placeholder(in context: Context) -> CaptureEntry { CaptureEntry(date: .now) }
  func getSnapshot(in context: Context, completion: @escaping (CaptureEntry) -> Void) {
    completion(CaptureEntry(date: .now))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<CaptureEntry>) -> Void) {
    completion(Timeline(entries: [CaptureEntry(date: .now)], policy: .never))
  }
}

private struct CaptureWidgetView: View {
  @Environment(\.widgetFamily) private var family

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Label("Thought Notes", systemImage: "sparkle")
        .font(.headline)
        .lineLimit(1)

      Spacer(minLength: 0)

      HStack(spacing: 10) {
        captureButton(.record, title: "Record", symbol: "mic.fill", color: .teal)
        captureButton(.write, title: "Write", symbol: "square.and.pencil", color: .secondary)
      }
    }
    .padding(14)
    .containerBackground(.background, for: .widget)
  }

  @ViewBuilder
  private func captureButton(_ mode: QuickCaptureMode, title: String, symbol: String, color: Color) -> some View {
    Button(intent: QuickCaptureIntent(mode: mode)) {
      if family == .systemSmall {
        Image(systemName: symbol)
          .font(.title3.weight(.semibold))
          .frame(maxWidth: .infinity, minHeight: 44)
          .background(color.opacity(0.15), in: RoundedRectangle(cornerRadius: 14))
      } else {
        Label(title, systemImage: symbol)
          .font(.subheadline.weight(.semibold))
          .frame(maxWidth: .infinity, minHeight: 44)
          .background(color.opacity(0.15), in: RoundedRectangle(cornerRadius: 14))
      }
    }
    .buttonStyle(.plain)
    .accessibilityLabel(mode == .record ? "Record a voice note" : "Write a note")
  }
}

@available(iOSApplicationExtension 17.0, *)
@main
struct ThoughtNotesQuickCaptureWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ThoughtNotesQuickCaptureWidget", provider: CaptureProvider()) { _ in
      CaptureWidgetView()
    }
    .configurationDisplayName("Thought Notes")
    .description("Capture a voice note or open a quick text note.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
