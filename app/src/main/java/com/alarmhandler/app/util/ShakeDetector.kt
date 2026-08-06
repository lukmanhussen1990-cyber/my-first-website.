package com.alarmhandler.app.util

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlin.math.sqrt

/**
 * Counts deliberate shakes for the shake-to-dismiss challenge.
 *
 * A shake is only counted once the reading has dropped back below a lower
 * threshold, so one vigorous wobble cannot register as ten shakes.
 */
class ShakeDetector(
    context: Context,
    private val onShake: () -> Unit,
) : SensorEventListener {

    private val sensorManager =
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val accelerometer: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private var armed = true
    private var lastShakeAt = 0L

    /** True when this device can support the shake challenge at all. */
    val isAvailable: Boolean get() = accelerometer != null

    fun start() {
        val sensor = accelerometer ?: return
        sensorManager?.registerListener(this, sensor, SensorManager.SENSOR_DELAY_GAME)
    }

    fun stop() {
        sensorManager?.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) return
        val (x, y, z) = Triple(event.values[0], event.values[1], event.values[2])
        val gForce = sqrt(x * x + y * y + z * z) / SensorManager.GRAVITY_EARTH

        val now = System.currentTimeMillis()
        if (armed && gForce > SHAKE_THRESHOLD && now - lastShakeAt > MIN_GAP_MS) {
            armed = false
            lastShakeAt = now
            onShake()
        } else if (!armed && gForce < REARM_THRESHOLD) {
            armed = true
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private companion object {
        const val SHAKE_THRESHOLD = 1.9f
        const val REARM_THRESHOLD = 1.2f
        const val MIN_GAP_MS = 260L
    }
}
