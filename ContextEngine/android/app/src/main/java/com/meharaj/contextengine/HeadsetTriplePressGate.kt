package com.meharaj.contextengine

/** Pure timing gate shared by raw three-tap and OS-mapped skip-back commands. */
internal class HeadsetTriplePressGate(
    private val elapsedRealtime: () -> Long,
    private val triplePressWindowMs: Long = 1_200L,
    private val triggerDebounceMs: Long = 1_500L,
) {
    private val rawTapTimes = ArrayDeque<Long>()
    private var lastTriggerAt: Long? = null

    fun recordRawTap(): Boolean {
        val now = elapsedRealtime()
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

    fun recordMappedTriplePress(): Boolean = acceptTrigger(elapsedRealtime())

    fun reset() {
        rawTapTimes.clear()
        lastTriggerAt = null
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
