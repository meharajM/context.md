import Foundation
import React
import AVFoundation

@objc(EventEmitter)
class EventEmitter: RCTEventEmitter {
  public static var shared: EventEmitter?
  private let assistantCaptureEventName = "AssistantCaptureRequested"

  override init() {
    super.init()
    EventEmitter.shared = self
    
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleAssistantCaptureNotification(_:)),
      name: NSNotification.Name("AssistantCaptureRequested"),
      object: nil
    )
  }

  @objc func handleAssistantCaptureNotification(_ notification: Notification) {
    let content = notification.userInfo?["content"] as? String ?? ""
    self.sendEvent(withName: assistantCaptureEventName, body: ["content": content])
  }

  override func supportedEvents() -> [String]! {
    return [assistantCaptureEventName]
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

@objc(AudioPlayerModule)
class AudioPlayerModule: NSObject {
  private var audioPlayer: AVAudioPlayer?

  @objc func play(_ filePath: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    let cleanPath = filePath.replacingOccurrences(of: "file://", with: "")
    let url = URL(fileURLWithPath: cleanPath)
    
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
      try AVAudioSession.sharedInstance().setActive(true)
      
      audioPlayer = try AVAudioPlayer(contentsOf: url)
      audioPlayer?.prepareToPlay()
      audioPlayer?.play()
      resolve(true)
    } catch {
      reject("AUDIO_PLAY_ERROR", "Failed to play audio file: \(error.localizedDescription)", error)
    }
  }

  @objc func stop() {
    audioPlayer?.stop()
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

