package com.meharaj.contextengine

internal object BackgroundSynthesisReadiness {
    private const val GIB = 1024L * 1024L * 1024L
    private const val MINIMUM_AVAILABLE_MEMORY_BYTES = GIB

    enum class Decision {
        READY,
        WAIT,
    }

    fun evaluate(
        availableMemoryBytes: Long,
        lowMemory: Boolean,
        thermalBusy: Boolean,
    ): Decision = when {
        availableMemoryBytes < MINIMUM_AVAILABLE_MEMORY_BYTES || lowMemory || thermalBusy -> Decision.WAIT
        else -> Decision.READY
    }
}
