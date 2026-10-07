package com.myapps.blockblast

import android.content.Context
import android.content.Intent
import android.net.Uri
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
        val messenger = flutterEngine.dartExecutor.binaryMessenger

        MethodChannel(messenger, "com.myapps.blockblast/haptics")
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

        MethodChannel(messenger, "com.myapps.blockblast/platform")
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    // Google Play purchase signature check (see PurchaseSecurity).
                    "verifyPurchase" -> {
                        val signedData = call.argument<String>("signedData") ?: ""
                        val signature = call.argument<String>("signature") ?: ""
                        result.success(PurchaseSecurity.verify(BuildConfig.PLAY_LICENSE_KEY, signedData, signature))
                    }
                    "isLicenseKeyConfigured" -> result.success(BuildConfig.PLAY_LICENSE_KEY.isNotBlank())
                    "installerPackage" -> result.success(installerPackage())
                    "openUrl" -> {
                        val url = call.argument<String>("url") ?: ""
                        result.success(openUrl(url))
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun installerPackage(): String? = try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            packageManager.getInstallSourceInfo(packageName).installingPackageName
        } else {
            @Suppress("DEPRECATION")
            packageManager.getInstallerPackageName(packageName)
        }
    } catch (_: Exception) {
        null
    }

    private fun openUrl(url: String): Boolean {
        if (!url.startsWith("https://")) return false
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            true
        } catch (_: Exception) {
            false
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
