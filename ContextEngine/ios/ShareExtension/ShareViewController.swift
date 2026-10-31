import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
  private let titleLabel = UILabel()
  private let detailLabel = UILabel()
  private let previewLabel = UILabel()
  private let saveButton = UIButton(type: .system)
  private var sharedText = ""

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .systemBackground
    configureView()
    loadSharedContent()
  }

  private func configureView() {
    titleLabel.text = "Send to Thought Notes"
    titleLabel.font = .preferredFont(forTextStyle: .title2)
    titleLabel.adjustsFontForContentSizeCategory = true

    detailLabel.text = "You can review the text and choose a topic in the app."
    detailLabel.font = .preferredFont(forTextStyle: .body)
    detailLabel.textColor = .secondaryLabel
    detailLabel.numberOfLines = 0

    previewLabel.font = .preferredFont(forTextStyle: .body)
    previewLabel.textColor = .label
    previewLabel.numberOfLines = 5
    previewLabel.lineBreakMode = .byTruncatingTail

    saveButton.setTitle("Save for review", for: .normal)
    saveButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
    saveButton.isEnabled = false
    saveButton.addTarget(self, action: #selector(saveForReview), for: .touchUpInside)

    let cancelButton = UIButton(type: .system)
    cancelButton.setTitle("Cancel", for: .normal)
    cancelButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

    let stack = UIStackView(arrangedSubviews: [titleLabel, detailLabel, previewLabel, saveButton, cancelButton])
    stack.axis = .vertical
    stack.spacing = 16
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
      stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
      stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
      saveButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 48),
    ])
  }

  private func loadSharedContent() {
    let items = extensionContext?.inputItems.compactMap { $0 as? NSExtensionItem } ?? []
    load(providers: items.flatMap { $0.attachments ?? [] }, collected: [])
  }

  private func load(providers: [NSItemProvider], collected: [String]) {
    guard let provider = providers.first else {
      sharedText = collected.joined(separator: "\n\n").trimmingCharacters(in: .whitespacesAndNewlines)
      DispatchQueue.main.async {
        if self.sharedText.isEmpty {
          self.detailLabel.text = "This app did not provide any text to save."
        } else {
          self.previewLabel.text = self.sharedText
          if self.isLinkOnly(self.sharedText) {
            self.detailLabel.text = "A link was shared. Thought Notes can save the link, but can’t read the conversation behind it."
          }
          self.saveButton.isEnabled = true
        }
      }
      return
    }

    let types = [UTType.plainText, UTType.text, UTType.url]
    guard let type = types.first(where: { provider.hasItemConformingToTypeIdentifier($0.identifier) }) else {
      load(providers: Array(providers.dropFirst()), collected: collected)
      return
    }
    provider.loadItem(forTypeIdentifier: type.identifier, options: nil) { item, _ in
      var next = collected
      if let value = item as? String {
        next.append(value)
      } else if let value = item as? NSString {
        next.append(value as String)
      } else if let value = item as? NSAttributedString {
        next.append(value.string)
      } else if let data = item as? Data, let value = String(data: data, encoding: .utf8) {
        next.append(value)
      } else if let value = item as? URL {
        next.append(value.absoluteString)
      } else if let value = item as? NSURL {
        next.append(value.absoluteString ?? "")
      }
      self.load(providers: Array(providers.dropFirst()), collected: next)
    }
  }

  private func isLinkOnly(_ text: String) -> Bool {
    guard let url = URL(string: text.trimmingCharacters(in: .whitespacesAndNewlines)) else { return false }
    return ["http", "https"].contains(url.scheme?.lowercased() ?? "")
  }

  @objc private func saveForReview() {
    saveButton.isEnabled = false
    do {
      _ = try SharedContentStore.save(sharedText)
      extensionContext?.completeRequest(returningItems: nil)
    } catch {
      detailLabel.text = "Could not save this text. Please try sharing it again."
      saveButton.isEnabled = true
    }
  }

  @objc private func cancel() {
    extensionContext?.cancelRequest(withError: NSError(domain: "ShareExtension", code: 1))
  }
}
