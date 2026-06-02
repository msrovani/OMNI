# ⚡ Omni-Grid Omni-Box — ProGuard / R8 rules

# Keep JNI native methods
-keepclasseswithmembernames class com.omnigrid.omnibox.OmniBoxNative {
    native <methods>;
}

# Keep mTLS data classes (Gson serialization)
-keep class com.omnigrid.omnibox.CloudClient$* { *; }
-keep class com.omnigrid.omnibox.BleBridge$* { *; }
-keep class com.omnigrid.omnibox.UsbSerialBridge$* { *; }

# Keep Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# ML Kit
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# CameraX
-keep class androidx.camera.** { *; }
