import Foundation
import React
import UniformTypeIdentifiers
import UIKit

@objc(VoiceFilePickerModule)
class VoiceFilePickerModule: NSObject, UIDocumentPickerDelegate, UINavigationControllerDelegate {
  private let copyDirectoryName = "contextengine-voice-imports"
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?
  private weak var pickerController: UIDocumentPickerViewController?

  @objc func pickVoiceFile(_ resolver: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.pendingResolve == nil && self.pendingReject == nil else {
        reject("VOICE_PICKER_BUSY", "Voice file picker is already active", nil)
        return
      }

      guard let presenter = self.topViewController() else {
        reject("VOICE_PICKER_UNAVAILABLE", "Unable to present the voice file picker", nil)
        return
      }

      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.audio], asCopy: true)
      picker.delegate = self
      picker.allowsMultipleSelection = false

      self.pendingResolve = resolver
      self.pendingReject = reject
      self.pickerController = picker
      presenter.present(picker, animated: true)
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let sourceURL = urls.first else {
      finishWithError(code: "VOICE_PICKER_EMPTY", message: "No voice file was selected")
      return
    }

    do {
      let selection = try copyVoiceFile(from: sourceURL)
      pendingResolve?(selection)
      clearPending()
    } catch {
      finishWithError(
        code: "VOICE_PICKER_COPY_FAILED",
        message: "Failed to import voice file: \(error.localizedDescription)",
        error: error
      )
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    finishWithError(code: "VOICE_PICKER_CANCELLED", message: "User canceled voice file selection")
  }

  private func copyVoiceFile(from sourceURL: URL) throws -> [String: Any] {
    let fileManager = FileManager.default
    let didStartAccessing = sourceURL.startAccessingSecurityScopedResource()
    defer {
      if didStartAccessing {
        sourceURL.stopAccessingSecurityScopedResource()
      }
    }

    let targetDirectory = fileManager.temporaryDirectory.appendingPathComponent(copyDirectoryName, isDirectory: true)
    try fileManager.createDirectory(at: targetDirectory, withIntermediateDirectories: true)

    let extensionName = sourceURL.pathExtension.isEmpty ? "m4a" : sourceURL.pathExtension
    let targetURL = targetDirectory.appendingPathComponent("\(UUID().uuidString).\(extensionName)")

    if fileManager.fileExists(atPath: targetURL.path) {
      try fileManager.removeItem(at: targetURL)
    }

    try fileManager.copyItem(at: sourceURL, to: targetURL)

    let attributes = try fileManager.attributesOfItem(atPath: targetURL.path)
    let size = (attributes[.size] as? NSNumber)?.doubleValue ?? 0
    let mimeType = UTType(filenameExtension: extensionName)?.preferredMIMEType ?? "application/octet-stream"

    return [
      "path": targetURL.path,
      "name": sourceURL.lastPathComponent,
      "mimeType": mimeType,
      "size": size,
    ]
  }

  private func finishWithError(code: String, message: String, error: Error? = nil) {
    pendingReject?(code, message, error)
    clearPending()
  }

  private func clearPending() {
    pendingResolve = nil
    pendingReject = nil
    pickerController = nil
  }

  private func topViewController() -> UIViewController? {
    let activeScenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let keyWindow = activeScenes
      .flatMap { $0.windows }
      .first(where: { $0.isKeyWindow }) ?? UIApplication.shared.windows.first(where: { $0.isKeyWindow })
    var topController = keyWindow?.rootViewController

    while let presented = topController?.presentedViewController {
      topController = presented
    }

    return topController
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
