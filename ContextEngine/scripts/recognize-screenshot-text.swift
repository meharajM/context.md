import Foundation
import Darwin
import Vision

let paths = Array(CommandLine.arguments.dropFirst())
guard !paths.isEmpty else {
  fputs("Pass one or more screenshot paths.\n", stderr)
  exit(EXIT_FAILURE)
}

do {
  let recognizedScreenshots = try paths.map { path -> String in
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    try VNImageRequestHandler(url: URL(fileURLWithPath: path), options: [:]).perform([request])
    return (request.results ?? [])
      .compactMap { $0.topCandidates(1).first?.string }
      .joined(separator: " ")
  }
  let json = try JSONSerialization.data(withJSONObject: recognizedScreenshots)
  print(String(decoding: json, as: UTF8.self))
} catch {
  fputs("Could not recognize screenshot text: \(error)\n", stderr)
  exit(EXIT_FAILURE)
}
