import Foundation
import React
import UniformTypeIdentifiers
import UIKit

@objc(VoiceFilePickerModule)
class VoiceFilePickerModule: NSObject, UIDocumentPickerDelegate, UINavigationControllerDelegate {
  private let copyDirectoryName = "contextengine-voice-imports"
  private var pendingResolve: RCTPromiseResolveBlock?
  private var pendingReject: RCTPromiseRejectBlock?
  private var pendingOperation: PickerOperation?
  private weak var pickerController: UIDocumentPickerViewController?
  private var backupExportURL: URL?

  private enum PickerOperation {
    case voice
    case importBackup
    case exportBackup
  }

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

      self.pendingOperation = .voice
      self.pendingResolve = resolver
      self.pendingReject = reject
      self.pickerController = picker
      presenter.present(picker, animated: true)
    }
  }

  @objc func exportBackup(_ content: String, resolver: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.pendingResolve == nil && self.pendingReject == nil else {
        reject("BACKUP_PICKER_BUSY", "A document picker is already active", nil)
        return
      }
      guard let presenter = self.topViewController() else {
        reject("BACKUP_PICKER_UNAVAILABLE", "Unable to present the backup file picker", nil)
        return
      }

      do {
        let data = Data(content.utf8)
        guard data.count <= 10 * 1024 * 1024 else {
          reject("BACKUP_TOO_LARGE", "Backup file exceeds the 10 MB limit", nil)
          return
        }
        let url = FileManager.default.temporaryDirectory
          .appendingPathComponent("Thought-Notes-Backup-\(UUID().uuidString).json")
        try data.write(to: url, options: .atomic)
        let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
        picker.delegate = self
        self.pendingOperation = .exportBackup
        self.pendingResolve = resolver
        self.pendingReject = reject
        self.pickerController = picker
        self.backupExportURL = url
        presenter.present(picker, animated: true)
      } catch {
        reject("BACKUP_EXPORT_FAILED", "Failed to prepare the backup file: \(error.localizedDescription)", error)
      }
    }
  }

  @objc func pickBackupFile(_ resolver: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      guard self.pendingResolve == nil && self.pendingReject == nil else {
        reject("BACKUP_PICKER_BUSY", "A document picker is already active", nil)
        return
      }
      guard let presenter = self.topViewController() else {
        reject("BACKUP_PICKER_UNAVAILABLE", "Unable to present the backup file picker", nil)
        return
      }

      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.json], asCopy: true)
      picker.delegate = self
      picker.allowsMultipleSelection = false
      self.pendingOperation = .importBackup
      self.pendingResolve = resolver
      self.pendingReject = reject
      self.pickerController = picker
      presenter.present(picker, animated: true)
    }
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let sourceURL = urls.first else {
      if case .voice? = pendingOperation {
        finishWithError(code: "VOICE_PICKER_EMPTY", message: "No voice file was selected")
      } else {
        finishWithError(code: "BACKUP_PICKER_EMPTY", message: "No backup file was selected")
      }
      return
    }

    do {
      switch pendingOperation {
      case .voice:
        pendingResolve?(try copyVoiceFile(from: sourceURL))
        clearPending()
      case .importBackup:
        pendingResolve?(try readBackupFile(from: sourceURL))
        clearPending()
      case .exportBackup:
        pendingResolve?(true)
        clearPending()
      case nil:
        clearPending()
      }
    } catch {
      let isVoice: Bool
      if case .voice? = pendingOperation {
        isVoice = true
      } else {
        isVoice = false
      }
      finishWithError(
        code: isVoice ? "VOICE_PICKER_COPY_FAILED" : "BACKUP_FILE_FAILED",
        message: isVoice
          ? "Failed to import voice file: \(error.localizedDescription)"
          : "Failed to read or export backup file: \(error.localizedDescription)",
        error: error
      )
    }
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    switch pendingOperation {
    case .voice:
      finishWithError(code: "VOICE_PICKER_CANCELLED", message: "User canceled voice file selection")
    case .importBackup:
      pendingResolve?(nil)
      clearPending()
    case .exportBackup:
      pendingResolve?(false)
      clearPending()
    case nil:
      clearPending()
    }
  }

  private func readBackupFile(from sourceURL: URL) throws -> [String: Any] {
    let didStartAccessing = sourceURL.startAccessingSecurityScopedResource()
    defer {
      if didStartAccessing {
        sourceURL.stopAccessingSecurityScopedResource()
      }
    }

    let attributes = try FileManager.default.attributesOfItem(atPath: sourceURL.path)
    let size = (attributes[.size] as? NSNumber)?.int64Value ?? 0
    guard size <= 10 * 1024 * 1024 else {
      throw NSError(domain: "ThoughtNotesBackup", code: 1, userInfo: [NSLocalizedDescriptionKey: "Backup file exceeds the 10 MB limit"])
    }
    let handle = try FileHandle(forReadingFrom: sourceURL)
    defer { try? handle.close() }
    let data = try handle.read(upToCount: 10 * 1024 * 1024 + 1) ?? Data()
    guard data.count <= 10 * 1024 * 1024, let content = String(data: data, encoding: .utf8) else {
      throw NSError(domain: "ThoughtNotesBackup", code: 2, userInfo: [NSLocalizedDescriptionKey: "Backup file is too large or is not UTF-8 JSON"])
    }
    return ["content": content, "name": sourceURL.lastPathComponent, "size": data.count]
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
    pendingOperation = nil
    pickerController = nil
    if let backupExportURL {
      try? FileManager.default.removeItem(at: backupExportURL)
      self.backupExportURL = nil
    }
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
