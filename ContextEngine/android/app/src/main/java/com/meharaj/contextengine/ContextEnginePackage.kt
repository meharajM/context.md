package com.meharaj.contextengine

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import java.util.ArrayList

/**
 * React Package to register Context Engine native modules.
 */
class ContextEnginePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        val modules = ArrayList<NativeModule>()
        modules.add(LiteRtModule(reactContext))
        modules.add(EventEmitter(reactContext))
        modules.add(AudioPlayerModule(reactContext))
        modules.add(VoiceFilePickerModule(reactContext))
        return modules
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
