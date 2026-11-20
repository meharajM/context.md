import SwiftUI
import WidgetKit

private enum QuickCaptureMode: String {
  case write
  case record
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
    Link(destination: URL(string: "com.meharaj.contextengine://quick-capture/\(mode.rawValue)")!) {
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

@available(iOSApplicationExtension 17.0, *)
private struct MeetingModeWidgetView: View {
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Label("Meeting mode", systemImage: "waveform")
        .font(.headline)
      Text("Open the app, review, then start recording.")
        .font(.caption)
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 0)
      Link(destination: URL(string: "com.meharaj.contextengine://quick-capture/meeting")!) {
        Label("Open Meeting", systemImage: "mic.fill")
          .font(.subheadline.weight(.semibold))
          .frame(maxWidth: .infinity, minHeight: 42)
          .background(.teal.opacity(0.16), in: RoundedRectangle(cornerRadius: 14))
      }
      .buttonStyle(.plain)
    }
    .padding(14)
    .containerBackground(.background, for: .widget)
  }
}

@available(iOSApplicationExtension 17.0, *)
private struct ThoughtNotesMeetingModeWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ThoughtNotesMeetingModeWidget", provider: CaptureProvider()) { _ in
      MeetingModeWidgetView()
    }
    .configurationDisplayName("Meeting mode")
    .description("Open Thought Notes before starting an in-person meeting recording.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@available(iOSApplicationExtension 17.0, *)
@main
struct ThoughtNotesWidgetBundle: WidgetBundle {
  var body: some Widget {
    ThoughtNotesQuickCaptureWidget()
    ThoughtNotesMeetingModeWidget()
  }
}
