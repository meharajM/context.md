# AndroidX Test runs from a separately minified APK and needs these shared runtime classes.
-keep class kotlin.** { *; }
-keep class androidx.tracing.** { *; }
-keep class com.meharaj.contextengine.HeadsetMediaButtonController { *; }
