package com.myapps.blockblast

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.myapps.blockblast/haptics")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "vibrate" -> {
                        val ms = (call.argument<Int>("ms") ?: 25).toLong()
                        val amplitude = (call.argument<Int>("amplitude") ?: 128).coerceIn(1, 255)
                        vibrate(ms, amplitude)
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun vibrate(ms: Long, amplitude: Int) {
        val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
        if (vibrator == null || !vibrator.hasVibrator()) return
        val amp = if (vibrator.hasAmplitudeControl()) amplitude else VibrationEffect.DEFAULT_AMPLITUDE
        try {
            vibrator.vibrate(VibrationEffect.createOneShot(ms, amp))
        } catch (_: Exception) {
            // Some devices throw when vibration is restricted; haptics are optional.
        }
    }
}
