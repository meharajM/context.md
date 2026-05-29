import Foundation
import React

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
