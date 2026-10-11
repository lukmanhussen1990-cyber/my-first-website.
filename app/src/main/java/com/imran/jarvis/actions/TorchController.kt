package com.imran.jarvis.actions

import android.content.Context
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Turns the camera flash on and off as a flashlight (no camera permission needed). */
class TorchController(context: Context) {

    private val manager: CameraManager? = context.getSystemService(CameraManager::class.java)
    private val cameraId: String? = findFlashCamera()

    private val _isOn = MutableStateFlow(false)
    val isOn: StateFlow<Boolean> = _isOn.asStateFlow()

    val isAvailable: Boolean get() = cameraId != null

    private val callback = object : CameraManager.TorchCallback() {
        override fun onTorchModeChanged(cameraId: String, enabled: Boolean) {
            if (cameraId == this@TorchController.cameraId) _isOn.value = enabled
        }
    }

    init {
        if (cameraId != null) {
            try {
                manager?.registerTorchCallback(callback, Handler(Looper.getMainLooper()))
            } catch (_: RuntimeException) {
                // Torch state tracking is a nicety; switching still works without it.
            }
        }
    }

    /** Returns false if this phone has no usable flashlight. */
    fun set(on: Boolean): Boolean {
        val id = cameraId ?: return false
        return try {
            manager?.setTorchMode(id, on)
            _isOn.value = on
            true
        } catch (_: CameraAccessException) {
            false
        } catch (_: IllegalArgumentException) {
            false
        }
    }

    fun toggle(): Boolean = set(!_isOn.value)

    fun release() {
        try {
            manager?.unregisterTorchCallback(callback)
        } catch (_: RuntimeException) {
        }
    }

    private fun findFlashCamera(): String? {
        val cameraManager = manager ?: return null
        return try {
            val withFlash = cameraManager.cameraIdList.filter { id ->
                cameraManager.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            }
            withFlash.firstOrNull { id ->
                cameraManager.getCameraCharacteristics(id).get(CameraCharacteristics.LENS_FACING) ==
                    CameraCharacteristics.LENS_FACING_BACK
            } ?: withFlash.firstOrNull()
        } catch (_: CameraAccessException) {
            null
        } catch (_: RuntimeException) {
            null
        }
    }
}
