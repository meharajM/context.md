import Foundation
import React
import AVFoundation
import MediaPlayer
import UIKit

@objc(EventEmitter)
class EventEmitter: RCTEventEmitter {
  // Keep native voice intake off alongside src/core/releaseCapabilities.ts.
  private let voiceIntegrationsReleased = false
  public static var shared: EventEmitter?
  private let assistantCaptureEventName = "AssistantCaptureRequested"
  private let headsetTripleTapEventName = "HeadsetTripleTapRequested"
  private var lockScreenHeadsetCaptureEnabled = false
  private var lastHeadsetCommandAt: TimeInterval = 0
  private let headsetCommandDebounceSeconds: TimeInterval = 1.5
  private var previousTrackCommandTarget: Any?
  private lazy var speechSynthesizer = AVSpeechSynthesizer()

  override init() {
    super.init()
    EventEmitter.shared = self
    guard voiceIntegrationsReleased else { return }
    
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleAssistantCaptureNotification(_:)),
      name: NSNotification.Name("AssistantCaptureRequested"),
      object: nil
    )

    setupHeadsetTriggerListener()
  }

  deinit {
    NotificationCenter.default.removeObserver(self)
    if let target = previousTrackCommandTarget {
      MPRemoteCommandCenter.shared().previousTrackCommand.removeTarget(target)
    }
    UIApplication.shared.endReceivingRemoteControlEvents()
  }

  @objc func handleAssistantCaptureNotification(_ notification: Notification) {
    guard voiceIntegrationsReleased else { return }
    let content = notification.userInfo?["content"] as? String ?? ""
    UserDefaults.standard.removeObject(forKey: "PendingAssistantCapture")
    self.sendEvent(withName: assistantCaptureEventName, body: ["content": content])
  }

  @objc func consumePendingAssistantCapture(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard voiceIntegrationsReleased else {
      resolve(nil)
      return
    }
    let content = UserDefaults.standard.string(forKey: "PendingAssistantCapture")
    UserDefaults.standard.removeObject(forKey: "PendingAssistantCapture")
    resolve(content)
  }

  @objc func setLockScreenCaptureEnabled(
    _ enabled: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard voiceIntegrationsReleased else {
      resolve(false)
      return
    }
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        resolve(false)
        return
      }

      do {
        try self.configureLockScreenAudioSession(enabled: enabled)
        self.lockScreenHeadsetCaptureEnabled = enabled
        if enabled {
          UIApplication.shared.beginReceivingRemoteControlEvents()
        } else {
          UIApplication.shared.endReceivingRemoteControlEvents()
        }
        self.updateHeadsetCommandEligibility()
        resolve(true)
      } catch {
        reject(
          "LOCK_SCREEN_CAPTURE_ERROR",
          "Failed to update lock-screen headset capture: \(error.localizedDescription)",
          error
        )
      }
    }
  }

  private func setupHeadsetTriggerListener() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(updateHeadsetCommandEligibility),
      name: UIApplication.didBecomeActiveNotification,
      object: nil
    )
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(updateHeadsetCommandEligibility),
      name: UIApplication.willResignActiveNotification,
      object: nil
    )

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      UIApplication.shared.beginReceivingRemoteControlEvents()
      let previousTrackCommand = MPRemoteCommandCenter.shared().previousTrackCommand
      self.previousTrackCommandTarget = previousTrackCommand.addTarget { [weak self] _ in
        DispatchQueue.main.async {
          self?.emitHeadsetCommandIfEligible()
        }
        return .success
      }
      self.updateHeadsetCommandEligibility()
    }
  }

  private func configureLockScreenAudioSession(enabled: Bool) throws {
    let session = AVAudioSession.sharedInstance()

    if enabled {
      try session.setCategory(
        .playAndRecord,
        mode: .spokenAudio,
        options: [.allowBluetooth, .allowBluetoothA2DP]
      )
      try session.setActive(true)
      return
    }

    try session.setActive(false, options: [.notifyOthersOnDeactivation])
  }

  /// EarPods and compatible headsets map a triple press to one previous/skip-back command.
  /// We intentionally do not publish fake Now Playing metadata or start silent playback merely to
  /// become the system media app. iOS therefore delivers this only when it considers the app an
  /// eligible remote-command target while the app is active.
  @objc private func updateHeadsetCommandEligibility() {
    MPRemoteCommandCenter.shared().previousTrackCommand.isEnabled =
      lockScreenHeadsetCaptureEnabled || UIApplication.shared.applicationState == .active
  }

  private func emitHeadsetCommandIfEligible() {
    let appIsActive = UIApplication.shared.applicationState == .active
    guard appIsActive || lockScreenHeadsetCaptureEnabled else {
      return
    }

    let now = Date().timeIntervalSince1970
    if now - lastHeadsetCommandAt < headsetCommandDebounceSeconds {
      return
    }

    lastHeadsetCommandAt = now
    sendEvent(withName: headsetTripleTapEventName, body: nil)
  }

  @objc func announceGuidance(_ text: String) {
    guard voiceIntegrationsReleased else { return }
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
