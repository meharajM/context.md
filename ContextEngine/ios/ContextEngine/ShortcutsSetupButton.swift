import AppIntents
import React
import UIKit

@objc(ShortcutsSetupButton)
class ShortcutsSetupButton: RCTViewManager {
  override func view() -> UIView! {
    if #available(iOS 16.0, *) {
      return makeShortcutsButton()
    } else {
      return fallbackButton()
    }
  }

  @available(iOS 16.0, *)
  private func makeShortcutsButton() -> UIView {
    return ShortcutsUIButton(style: .automaticOutline)
  }

  private func fallbackButton() -> UIView {
    let button = UIButton(type: .system)
    button.setTitle("Open Shortcuts", for: .normal)
    button.contentHorizontalAlignment = .leading
    button.addTarget(self, action: #selector(openShortcutsApp), for: .touchUpInside)
    return button
  }

  @objc private func openShortcutsApp() {
    guard let url = URL(string: "shortcuts://") else {
      return
    }
    UIApplication.shared.open(url, options: [:], completionHandler: nil)
  }

  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
