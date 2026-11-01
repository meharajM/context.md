import Foundation
import React
import UserNotifications

private struct AutomaticReminderRecord: Codable {
  let noteId: String
  let fingerprint: String
  var inferredWithAi: Bool
  var status: String
  var title: String?
  var category: String?
  var priority: String?
  var fireAt: Int64?
  var expiresAt: Int64?
}

private struct AutomaticReminderState: Codable {
  var enabled = false
  var enabledAt: Int64 = 0
  var records: [AutomaticReminderRecord] = []
}

@objc(AutomaticReminderModule)
class AutomaticReminderModule: NSObject, UNUserNotificationCenterDelegate {
  static let shared = AutomaticReminderModule()
  private let key = "automatic-reminder-state-v1"
  private let stateQueue = DispatchQueue(label: "com.meharaj.contextengine.automatic-reminders")
  private let center = UNUserNotificationCenter.current()
  private let doneAction = "AUTOMATIC_REMINDER_DONE"
  private let snoozeAction = "AUTOMATIC_REMINDER_SNOOZE"
  private let categoryId = "AUTOMATIC_REMINDER"

  override init() {
    super.init()
    configureNotifications()
  }

  @objc static func requiresMainQueueSetup() -> Bool { true }

  private func configureNotifications() {
    let actions = [
      UNNotificationAction(identifier: doneAction, title: "Done", options: []),
      UNNotificationAction(identifier: snoozeAction, title: "Snooze 15 min", options: []),
    ]
    center.setNotificationCategories([UNNotificationCategory(
      identifier: categoryId,
      actions: actions,
      intentIdentifiers: [],
      options: []
    )])
    center.delegate = self
  }

  @objc func getState(_ resolver: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      let state = try stateQueue.sync { try readState() }
      for record in state.records where record.status == "scheduled" {
        schedule(record, generation: state.enabledAt)
      }
      resolver(try encode(state))
    } catch {
      reject("REMINDER_READ_FAILED", "Saved reminder settings could not be read.", error)
    }
  }

  @objc func setEnabled(_ enabled: Bool, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard enabled else {
      do {
        let (state, removedIds) = try stateQueue.sync { () throws -> (AutomaticReminderState, [String]) in
          var state = try readState()
          let removedIds = state.records.map(\.noteId)
          state.enabled = false
          state.records = []
          try writeState(state)
          return (state, removedIds)
        }
        cancel(removedIds)
        resolve(try encode(state))
      } catch {
        reject("REMINDER_WRITE_FAILED", "Automatic reminders could not be turned off.", error)
      }
      return
    }

    center.requestAuthorization(options: [.alert, .sound, .badge]) { [weak self] granted, error in
      guard let self else { return }
      guard error == nil, granted else {
        reject("REMINDER_PERMISSION_DENIED", "Allow notifications in iPhone Settings to use automatic reminders.", error)
        return
      }
      do {
        let state = try self.stateQueue.sync { () throws -> AutomaticReminderState in
          var state = try self.readState()
          if !state.enabled {
            state.enabled = true
            state.enabledAt = max(Int64(Date().timeIntervalSince1970 * 1000), state.enabledAt + 1)
            try self.writeState(state)
          }
          return state
        }
        resolve(try self.encode(state))
      } catch {
        reject("REMINDER_WRITE_FAILED", "Automatic reminders could not be enabled.", error)
      }
    }
  }

  @objc func reconcileNote(_ noteId: String, fingerprint: String, enabledAt: NSNumber, inferredWithAi: Bool, planJson: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      let generation = try checkedInteger(enabledAt.doubleValue)
      guard validText(noteId, max: 512), validText(fingerprint, max: 512), planJson.utf8.count <= 4096 else { throw invalidData() }
      let plan = try parsePlan(planJson)
      let previous = try stateQueue.sync { () throws -> AutomaticReminderRecord? in
        var state = try readState()
        guard state.enabled && state.enabledAt == generation else { return nil }
        let old = state.records.first { $0.noteId == noteId }
        if let old, old.fingerprint == fingerprint,
            old.status == "delivered" || old.status == "done" || old.inferredWithAi || !inferredWithAi ||
            (old.expiresAt.map { $0 <= now() } ?? false) { return old }
        guard plan == nil else { return old }
        let record = AutomaticReminderRecord(noteId: noteId, fingerprint: fingerprint, inferredWithAi: inferredWithAi,
          status: "none", title: nil, category: nil, priority: nil, fireAt: nil, expiresAt: nil)
        state.records.removeAll { $0.noteId == noteId }
        state.records.append(record)
        try writeState(state)
        return old
      }

      let state = try stateQueue.sync { try readState() }
      guard state.enabled && state.enabledAt == generation else { resolve(false); return }
      if let previous, previous.fingerprint == fingerprint,
          previous.status == "delivered" || previous.status == "done" || previous.inferredWithAi || !inferredWithAi ||
          (previous.expiresAt.map { $0 <= now() } ?? false) {
        resolve(true)
        return
      }
      guard let plan else {
        if previous != nil { cancel([noteId]) }
        resolve(true)
        return
      }

      let record = AutomaticReminderRecord(noteId: noteId, fingerprint: fingerprint, inferredWithAi: inferredWithAi,
        status: "scheduled", title: plan.title, category: plan.category, priority: plan.priority,
        fireAt: plan.fireAt, expiresAt: plan.expiresAt)
      center.add(notificationRequest(for: record, generation: generation)) { [weak self] error in
        guard let self else { return }
        guard error == nil else {
          if let previous { self.schedule(previous, generation: generation) }
          reject("REMINDER_SCHEDULE_FAILED", "A reminder could not be scheduled.", error)
          return
        }
        do {
          let saved = try self.stateQueue.sync { () throws -> Bool in
            var latest = try self.readState()
            guard latest.enabled && latest.enabledAt == generation else { return false }
            latest.records.removeAll { $0.noteId == noteId }
            latest.records.append(record)
            try self.writeState(latest)
            return true
          }
          if !saved { self.cancel([noteId]) }
          resolve(saved)
        } catch {
          self.cancel([noteId])
          if let previous { self.schedule(previous, generation: generation) }
          reject("REMINDER_WRITE_FAILED", "The scheduled reminder could not be saved.", error)
        }
      }
    } catch {
      reject("REMINDER_INVALID", "The reminder data is invalid.", error)
    }
  }

  @objc func cancelMissingNotes(_ noteIds: [String], enabledAt: NSNumber, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
    do {
      let generation = try checkedInteger(enabledAt.doubleValue)
      guard noteIds.count <= 100_000, noteIds.allSatisfy({ validText($0, max: 512) }) else { throw invalidData() }
      let (saved, removed) = try stateQueue.sync { () throws -> (Bool, [String]) in
        var state = try readState()
        guard state.enabled && state.enabledAt == generation else { return (false, []) }
        let keep = Set(noteIds)
        let removed = state.records.filter { !keep.contains($0.noteId) }.map(\.noteId)
        state.records.removeAll { !keep.contains($0.noteId) }
        try writeState(state)
        return (true, removed)
      }
      cancel(removed)
      resolve(saved)
    } catch {
      reject("REMINDER_WRITE_FAILED", "Deleted-note reminders could not be cleared.", error)
    }
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .list, .sound])
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let info = response.notification.request.content.userInfo
    guard let noteId = info["noteId"] as? String, let fingerprint = info["fingerprint"] as? String,
          let generationValue = info["enabledAt"] as? NSNumber else { completionHandler(); return }
    let generation = generationValue.int64Value
    do {
      let next = try stateQueue.sync { () throws -> AutomaticReminderRecord? in
        var state = try readState()
        guard state.enabled, state.enabledAt == generation,
              let index = state.records.firstIndex(where: { $0.noteId == noteId && $0.fingerprint == fingerprint }) else { return nil }
        var record = state.records[index]
        switch response.actionIdentifier {
        case doneAction:
          record.status = "done"
          state.records[index] = record
          try writeState(state)
          return nil
        case snoozeAction:
          let fireAt = now() + 15 * 60 * 1000
          guard let expiresAt = record.expiresAt, fireAt < expiresAt else { return nil }
          record.status = "scheduled"
          record.fireAt = fireAt
          state.records[index] = record
          try writeState(state)
          return record
        default:
          return nil
        }
      }
      if response.actionIdentifier == doneAction { cancel([noteId]) }
      if let next { schedule(next, generation: generation) }
    } catch {
      NSLog("Automatic reminder action could not be saved: %@", String(describing: error))
    }
    completionHandler()
  }

  private func readState() throws -> AutomaticReminderState {
    guard let data = UserDefaults.standard.data(forKey: key) else { return AutomaticReminderState() }
    let state = try JSONDecoder().decode(AutomaticReminderState.self, from: data)
    guard state.enabledAt >= 0, (!state.enabled || state.enabledAt > 0), state.records.count <= 100_000 else { throw invalidData() }
    let ids = state.records.map(\.noteId)
    guard Set(ids).count == ids.count else { throw invalidData() }
    for record in state.records {
      guard validText(record.noteId, max: 512), validText(record.fingerprint, max: 512),
            ["none", "scheduled", "delivered", "done"].contains(record.status) else { throw invalidData() }
      if record.status != "none" {
        guard let title = record.title, validText(title, max: 160), let category = record.category,
              validText(category, max: 64), let priority = record.priority,
              ["low", "normal", "high"].contains(priority), let fireAt = record.fireAt,
              let expiresAt = record.expiresAt, fireAt > 0, expiresAt > fireAt,
              expiresAt - fireAt <= 366 * 24 * 60 * 60 * 1000 else { throw invalidData() }
      }
    }
    guard state.enabled || state.records.isEmpty else { throw invalidData() }
    return state
  }

  private func writeState(_ state: AutomaticReminderState) throws {
    UserDefaults.standard.set(try JSONEncoder().encode(state), forKey: key)
  }

  private func encode(_ state: AutomaticReminderState) throws -> String {
    String(decoding: try JSONEncoder().encode(state), as: UTF8.self)
  }

  private func parsePlan(_ raw: String) throws -> (title: String, category: String, priority: String, fireAt: Int64, expiresAt: Int64)? {
    if raw.isEmpty { return nil }
    guard let data = raw.data(using: .utf8), let object = try JSONSerialization.jsonObject(with: data) as? [String: Any],
          let title = object["title"] as? String, validText(title, max: 160),
          let category = object["category"] as? String, validText(category, max: 64),
          let priority = object["priority"] as? String, ["low", "normal", "high"].contains(priority),
          let fireNumber = object["fireAt"] as? NSNumber, let expiryNumber = object["expiresAt"] as? NSNumber else { throw invalidData() }
    let fireAt = try checkedInteger(fireNumber.doubleValue)
    let expiresAt = try checkedInteger(expiryNumber.doubleValue)
    guard fireAt > now(), expiresAt > fireAt, expiresAt <= now() + 366 * 24 * 60 * 60 * 1000 else { throw invalidData() }
    return (title, category, priority, fireAt, expiresAt)
  }

  private func notificationRequest(for record: AutomaticReminderRecord, generation: Int64) -> UNNotificationRequest {
    let content = UNMutableNotificationContent()
    content.title = record.title ?? "Task reminder"
    content.body = "\(record.category ?? "personal")\(record.priority == "high" ? " · High priority" : "")"
    content.sound = .default
    content.categoryIdentifier = categoryId
    content.threadIdentifier = "automatic-reminders"
    content.userInfo = ["noteId": record.noteId, "fingerprint": record.fingerprint, "enabledAt": generation]
    let date = Date(timeIntervalSince1970: Double(record.fireAt ?? 0) / 1000)
    let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
    return UNNotificationRequest(identifier: "automatic-reminder:\(record.noteId)", content: content,
      trigger: UNCalendarNotificationTrigger(dateMatching: components, repeats: false))
  }

  private func schedule(_ record: AutomaticReminderRecord, generation: Int64) {
    guard record.status == "scheduled", let fireAt = record.fireAt, fireAt > now() else { return }
    center.add(notificationRequest(for: record, generation: generation)) { error in
      if let error { NSLog("Automatic reminder scheduling will retry: %@", String(describing: error)) }
    }
  }

  private func cancel(_ noteIds: [String]) {
    let ids = noteIds.map { "automatic-reminder:\($0)" }
    center.removePendingNotificationRequests(withIdentifiers: ids)
    center.removeDeliveredNotifications(withIdentifiers: ids)
  }

  private func now() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }
  private func validText(_ value: String, max: Int) -> Bool {
    !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && value.count <= max &&
      value.unicodeScalars.allSatisfy { !CharacterSet.controlCharacters.contains($0) }
  }
  private func checkedInteger(_ value: Double) throws -> Int64 {
    guard value.isFinite, value >= 0, value <= 9_007_199_254_740_991, value.rounded(.towardZero) == value else { throw invalidData() }
    return Int64(value)
  }
  private func invalidData() -> NSError {
    NSError(domain: "ThoughtNotesReminder", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid reminder data"])
  }
}
