import Foundation
import React

@objc(EventEmitter)
class EventEmitter: RCTEventEmitter {
  public static var shared: EventEmitter?

  override init() {
    super.init()
    EventEmitter.shared = self
    
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handlevoiceCaptureNotification(_:)),
      name: NSNotification.Name("TriggerVoiceCapture"),
      object: nil
    )
  }

  @objc func handlevoiceCaptureNotification(_ notification: Notification) {
    self.sendEvent(withName: "TriggerVoiceCapture", body: nil)
  }

  override func supportedEvents() -> [String]! {
    return ["TriggerVoiceCapture"]
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
