import Foundation

enum SharedContentStore {
  static let groupIdentifier = "group.com.meharaj.contextengine"
  private static let directoryName = "IncomingShares"

  private static func directory() throws -> URL {
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: groupIdentifier
    ) else {
      throw NSError(domain: "SharedContentStore", code: 1, userInfo: [NSLocalizedDescriptionKey: "Shared storage is not available"])
    }
    let directory = container.appendingPathComponent(directoryName, isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    return directory
  }

  static func save(_ text: String) throws -> [String: String] {
    let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !content.isEmpty else {
      throw NSError(domain: "SharedContentStore", code: 2, userInfo: [NSLocalizedDescriptionKey: "Shared text is empty"])
    }
    let id = "shared-\(UUID().uuidString.lowercased())"
    let data = try JSONSerialization.data(withJSONObject: [
      "id": id,
      "text": content,
      "createdAt": Date().timeIntervalSince1970,
    ])
    try data.write(to: directory().appendingPathComponent("\(id).json"), options: .atomic)
    return ["id": id, "text": content]
  }

  static func read() throws -> [[String: String]] {
    let files = try FileManager.default.contentsOfDirectory(
      at: directory(), includingPropertiesForKeys: nil
    ).filter { $0.pathExtension == "json" }
    return files.compactMap { url -> (Date, [String: String])? in
      guard
        let data = try? Data(contentsOf: url),
        let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        let id = value["id"] as? String,
        isValid(id),
        url.lastPathComponent == "\(id).json",
        let text = value["text"] as? String,
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
        let createdAt = value["createdAt"] as? TimeInterval,
        createdAt.isFinite
      else { return nil }
      return (Date(timeIntervalSince1970: createdAt), ["id": id, "text": text])
    }.sorted { $0.0 < $1.0 }.map(\.1)
  }

  static func acknowledge(_ id: String) throws {
    guard isValid(id) else {
      throw NSError(domain: "SharedContentStore", code: 3, userInfo: [NSLocalizedDescriptionKey: "Shared text id is invalid"])
    }
    let file = try directory().appendingPathComponent("\(id).json")
    if FileManager.default.fileExists(atPath: file.path) {
      try FileManager.default.removeItem(at: file)
    }
  }

  private static func isValid(_ id: String) -> Bool {
    id.hasPrefix("shared-") && UUID(uuidString: String(id.dropFirst("shared-".count))) != nil
  }
}
