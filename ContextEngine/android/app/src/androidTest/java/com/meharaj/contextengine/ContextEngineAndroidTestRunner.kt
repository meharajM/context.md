package com.meharaj.contextengine

import android.os.Bundle
import androidx.test.runner.AndroidJUnitRunner

class ContextEngineAndroidTestRunner : AndroidJUnitRunner() {
    override fun onCreate(arguments: Bundle) {
        if (arguments.getString("detoxServer") != null && !arguments.containsKey("class")) {
            arguments.putString("class", DetoxTest::class.java.name)
        }
        super.onCreate(arguments)
    }
}
