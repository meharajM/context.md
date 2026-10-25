package com.meharaj.contextengine

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise

/** Selects an attached headset microphone when available and restores the prior route after capture. */
internal class AudioInputRouter(context: Context) {
    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(AudioManager::class.java)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var previousMode: Int? = null
    private var previousCommunicationDevice: AudioDeviceInfo? = null
    private var activeRoute: String? = null
    private var receiver: BroadcastReceiver? = null
    private var pendingPromise: Promise? = null
    private var timeout: Runnable? = null
    private var scoStarted = false

    fun start(promise: Promise) {
        mainHandler.post {
            if (audioManager == null) {
                promise.resolve("phone")
            } else if (activeRoute != null) {
                promise.resolve(activeRoute)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                startModernRoute(promise)
            } else {
                startLegacyRoute(promise)
            }
        }
    }

    fun stop(promise: Promise) {
        mainHandler.post {
            finishLegacyRoute("phone")
            restoreRoute()
            promise.resolve(null)
        }
    }

    fun release() {
        mainHandler.post {
            finishLegacyRoute("phone")
            restoreRoute()
        }
    }

    private fun startModernRoute(promise: Promise) {
        val manager = audioManager ?: run {
            promise.resolve("phone")
            return
        }
        val wiredInput = manager.getDevices(AudioManager.GET_DEVICES_INPUTS).any {
            isWiredInput(it)
        }
        if (wiredInput) {
            activeRoute = "wired"
            promise.resolve(activeRoute)
            return
        }
        if (appContext.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED ||
            manager.mode != AudioManager.MODE_NORMAL
        ) {
            promise.resolve("phone")
            return
        }

        val device = manager.availableCommunicationDevices.firstOrNull {
            it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == AudioDeviceInfo.TYPE_BLE_HEADSET
        }
        if (device == null) {
            promise.resolve("phone")
            return
        }

        previousMode = manager.mode
        previousCommunicationDevice = manager.communicationDevice
        manager.mode = AudioManager.MODE_IN_COMMUNICATION
        activeRoute = "bluetooth".takeIf { manager.setCommunicationDevice(device) }

        if (activeRoute == null) restoreRoute()
        promise.resolve(activeRoute ?: "phone")
    }

    @Suppress("DEPRECATION")
    private fun startLegacyRoute(promise: Promise) {
        val manager = audioManager ?: run {
            promise.resolve("phone")
            return
        }
        val wiredInput = manager.getDevices(AudioManager.GET_DEVICES_INPUTS).any {
            isWiredInput(it)
        }
        if (wiredInput) {
            activeRoute = "wired"
            promise.resolve(activeRoute)
            return
        }

        val headsetConnected = manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any {
            it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
        }
        if (!headsetConnected || !manager.isBluetoothScoAvailableOffCall || manager.mode != AudioManager.MODE_NORMAL) {
            promise.resolve("phone")
            return
        }

        previousMode = manager.mode
        manager.mode = AudioManager.MODE_IN_COMMUNICATION
        pendingPromise = promise
        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action != AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED) return
                when (intent.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, AudioManager.SCO_AUDIO_STATE_ERROR)) {
                    AudioManager.SCO_AUDIO_STATE_CONNECTED -> {
                        manager.isBluetoothScoOn = true
                        activeRoute = "bluetooth"
                        finishLegacyRoute("bluetooth")
                    }
                    AudioManager.SCO_AUDIO_STATE_ERROR -> finishLegacyRoute("phone")
                }
            }
        }
        try {
            val filter = IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                appContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                appContext.registerReceiver(receiver, filter)
            }
            manager.startBluetoothSco()
            scoStarted = true
            timeout = Runnable { finishLegacyRoute("phone") }
            mainHandler.postDelayed(timeout!!, SCO_TIMEOUT_MS)
        } catch (_: SecurityException) {
            finishLegacyRoute("phone")
        } catch (_: IllegalStateException) {
            finishLegacyRoute("phone")
        }
    }

    private fun finishLegacyRoute(route: String) {
        timeout?.let(mainHandler::removeCallbacks)
        timeout = null
        receiver?.let {
            try {
                appContext.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) {
                // The broadcast may complete after lifecycle cleanup.
            }
        }
        receiver = null
        val promise = pendingPromise
        pendingPromise = null
        if (route == "phone" && promise != null) restoreRoute()
        if (promise != null) promise.resolve(route)
    }

    @Suppress("DEPRECATION")
    private fun restoreRoute() {
        val manager = audioManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (previousCommunicationDevice != null) {
                manager.setCommunicationDevice(previousCommunicationDevice!!)
            } else {
                manager.clearCommunicationDevice()
            }
        } else if (scoStarted) {
            manager.isBluetoothScoOn = false
            manager.stopBluetoothSco()
            scoStarted = false
        }
        previousMode?.let { manager.mode = it }
        previousMode = null
        previousCommunicationDevice = null
        activeRoute = null
    }

    private fun isWiredInput(device: AudioDeviceInfo): Boolean =
        device.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && device.type == AudioDeviceInfo.TYPE_USB_HEADSET)

    companion object {
        private const val SCO_TIMEOUT_MS = 5_000L
    }
}
