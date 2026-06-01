import Foundation
import React
import AVFoundation
import MediaPlayer
import UIKit

@objc(EventEmitter)
class EventEmitter: RCTEventEmitter {
  public static var shared: EventEmitter?
  private let assistantCaptureEventName = "AssistantCaptureRequested"
  private let headsetTripleTapEventName = "HeadsetTripleTapRequested"
  private var tapTimestamps: [TimeInterval] = []
  private var lastTripleTapAt: TimeInterval = 0
  private let tripleTapWindowSeconds: TimeInterval = 1.2
  private let tripleTapDebounceSeconds: TimeInterval = 1.5
  private let speechSynthesizer = AVSpeechSynthesizer()

  override init() {
    super.init()
    EventEmitter.shared = self
    
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleAssistantCaptureNotification(_:)),
      name: NSNotification.Name("AssistantCaptureRequested"),
      object: nil
    )

    setupHeadsetTriggerListener()
  }

  @objc func handleAssistantCaptureNotification(_ notification: Notification) {
    let content = notification.userInfo?["content"] as? String ?? ""
    self.sendEvent(withName: assistantCaptureEventName, body: ["content": content])
  }

  private func setupHeadsetTriggerListener() {
    DispatchQueue.main.async {
      UIApplication.shared.beginReceivingRemoteControlEvents()
      MPRemoteCommandCenter.shared().togglePlayPauseCommand.addTarget { [weak self] _ in
        self?.recordHeadsetTap()
        return .success
      }
    }
  }

  private func recordHeadsetTap() {
    let now = Date().timeIntervalSince1970
    tapTimestamps.append(now)
    tapTimestamps = tapTimestamps.filter { now - $0 <= tripleTapWindowSeconds }

    if now - lastTripleTapAt < tripleTapDebounceSeconds {
      return
    }

    if tapTimestamps.count >= 3 {
      tapTimestamps.removeAll()
      lastTripleTapAt = now
      sendEvent(withName: headsetTripleTapEventName, body: nil)
    }
  }

  @objc func announceGuidance(_ text: String) {
    guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
      return
    }

    let utterance = AVSpeechUtterance(string: text)
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate
    utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
    speechSynthesizer.speak(utterance)
  }

  override func supportedEvents() -> [String]! {
    return [assistantCaptureEventName, headsetTripleTapEventName]
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
