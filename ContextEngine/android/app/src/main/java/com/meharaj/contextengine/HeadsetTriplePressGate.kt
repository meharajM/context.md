package com.meharaj.contextengine

/** Pure timing gate for three physical media-button presses. */
internal class HeadsetTriplePressGate(
    private val uptimeMillis: () -> Long,
    private val triplePressWindowMs: Long = 1_200L,
    private val triggerDebounceMs: Long = 1_500L,
) {
    private val rawTapTimes = ArrayDeque<Long>()
    private var lastTriggerAt: Long? = null
    private var lastTapEventTime: Long? = null

    fun recordRawTap(eventTime: Long = uptimeMillis()): Boolean {
        if (lastTapEventTime == eventTime) return false
        lastTapEventTime = eventTime
        val now = eventTime
        rawTapTimes.addLast(now)

        while (rawTapTimes.isNotEmpty() && now - rawTapTimes.first() > triplePressWindowMs) {
            rawTapTimes.removeFirst()
        }

        if (rawTapTimes.size < REQUIRED_TAP_COUNT) {
            return false
        }

        rawTapTimes.clear()
        return acceptTrigger(now)
    }

    fun recordMappedTrigger(now: Long = uptimeMillis()): Boolean {
        rawTapTimes.clear()
        return acceptTrigger(now)
    }

    fun reset() {
        rawTapTimes.clear()
        lastTriggerAt = null
        lastTapEventTime = null
    }

    private fun acceptTrigger(now: Long): Boolean {
        val previousTriggerAt = lastTriggerAt
        if (previousTriggerAt != null && now - previousTriggerAt < triggerDebounceMs) {
            return false
        }

        lastTriggerAt = now
        return true
    }

    companion object {
        private const val REQUIRED_TAP_COUNT = 3
    }
}
