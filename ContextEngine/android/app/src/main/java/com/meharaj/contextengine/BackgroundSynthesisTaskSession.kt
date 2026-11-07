package com.meharaj.contextengine

import java.util.concurrent.CountDownLatch
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

internal class BackgroundSynthesisTaskSession {
    private val taskId = AtomicInteger(NO_TASK)
    private val taskResult = AtomicInteger(RESULT_UNREPORTED)
    private val resultReported = CountDownLatch(1)
    private val finished = CountDownLatch(1)

    fun onTaskStarted(id: Int) {
        taskId.set(id)
    }

    fun taskId(): Int = taskId.get()

    fun onTaskFinished(id: Int) {
        if (taskId.get() == id) finished.countDown()
    }

    fun report(retry: Boolean): Boolean {
        val accepted = taskResult.compareAndSet(
            RESULT_UNREPORTED,
            if (retry) RESULT_RETRY else RESULT_COMPLETED,
        )
        if (accepted) resultReported.countDown()
        return accepted
    }

    fun awaitResultReported(timeout: Long, unit: TimeUnit): Boolean = resultReported.await(timeout, unit)

    fun awaitFinished(timeout: Long, unit: TimeUnit): Boolean = finished.await(timeout, unit)

    fun result(): Int = taskResult.get().let {
        if (it == RESULT_COMPLETED) RESULT_COMPLETED else RESULT_RETRY
    }

    companion object {
        const val RESULT_UNREPORTED = -1
        const val RESULT_COMPLETED = 0
        const val RESULT_RETRY = 1
        private const val NO_TASK = -1
    }
}

internal object BackgroundSynthesisTaskCoordinator {
    private val activeSessions = ConcurrentHashMap<String, BackgroundSynthesisTaskSession>()
    private val captureSessions = ConcurrentHashMap.newKeySet<String>()

    @Synchronized
    fun begin(workId: String, captureProcessing: Boolean): BackgroundSynthesisTaskSession? {
        if (captureProcessing && captureSessions.isNotEmpty()) return null
        if (!captureProcessing && activeSessions.isNotEmpty()) return null
        return BackgroundSynthesisTaskSession().also {
            activeSessions[workId] = it
            if (captureProcessing) captureSessions.add(workId)
        }
    }

    @Synchronized
    fun finish(workId: String, session: BackgroundSynthesisTaskSession) {
        activeSessions.remove(workId, session)
        captureSessions.remove(workId)
    }

    fun report(workId: String, retry: Boolean): Boolean = activeSessions[workId]?.report(retry) ?: false
}
