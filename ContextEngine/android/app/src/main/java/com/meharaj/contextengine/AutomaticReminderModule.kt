package com.meharaj.contextengine

import com.facebook.react.bridge.*

class AutomaticReminderModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val scheduler = AutomaticReminderScheduler(context)
    override fun getName() = "AutomaticReminderModule"
    private fun complete(promise: Promise, action: () -> Any) {
        try { promise.resolve(action()) } catch (error: Exception) { promise.reject("REMINDER_ERROR", error.message, error) }
    }
    private fun generation(value: Double): Long {
        require(value.isFinite() && value >= 0 && value <= 9007199254740991.0 && value == value.toLong().toDouble())
        return value.toLong()
    }
    @ReactMethod fun getState(promise: Promise) = complete(promise) { scheduler.getState() }
    @ReactMethod fun setEnabled(enabled: Boolean, promise: Promise) = complete(promise) { scheduler.setEnabled(enabled) }
    @ReactMethod fun reconcileNote(noteId: String, fingerprint: String, enabledAt: Double, inferredWithAi: Boolean, planJson: String, promise: Promise) = complete(promise) {
        scheduler.reconcileNote(noteId, fingerprint, generation(enabledAt), inferredWithAi, planJson)
    }
    @ReactMethod fun cancelMissingNotes(noteIds: ReadableArray, enabledAt: Double, promise: Promise) = complete(promise) {
        require(noteIds.size() <= 100000)
        val ids = (0 until noteIds.size()).map { require(noteIds.getType(it) == ReadableType.String); requireNotNull(noteIds.getString(it)) }
        scheduler.cancelMissingNotes(ids, generation(enabledAt))
    }
}
