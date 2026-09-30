package com.runova.app.tracking

import android.Manifest
import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.location.LocationRequest
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.runova.app.graph
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.launch

/**
 * Foreground service that keeps GPS and the step counter running while a run is recorded,
 * including with the screen off. It only carries the sensors; [RunSession] holds the run.
 */
class RunTrackingService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var running = false
    private var wakeLock: PowerManager.WakeLock? = null
    private val session get() = graph.session

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) = session.onLocation(location)
        override fun onProviderEnabled(provider: String) = session.onGpsProblem(null)
        override fun onProviderDisabled(provider: String) = session.onGpsProblem(RunSession.GpsProblem.PROVIDER_OFF)

        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
    }

    private val stepListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            val total = event.values.firstOrNull()?.toLong() ?: return
            session.onStepCounter(total)
            graph.steps.onCounter(total)
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PAUSE -> session.pause()
            ACTION_RESUME -> session.resume()
            else -> startTracking()
        }
        if (!session.isActive) stopSelf()
        return START_NOT_STICKY
    }

    private fun startTracking() {
        if (running) return
        val units = graph.settings.load().units
        val notification = Notifications.run(this, session.live.value, units)
        try {
            ServiceCompat.startForeground(
                this, Notifications.RUN_ID, notification,
                if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0,
            )
        } catch (e: Exception) {
            // Location permission missing or the app isn't allowed to start the service right now.
            session.onServiceFailed()
            stopSelf()
            return
        }
        running = true
        acquireWakeLock()
        registerLocation()
        registerSteps()
        scope.launch {
            combine(session.live, graph.settings.flow) { live, settings -> live to settings.units }
                .conflate()
                .collect { (live, u) ->
                    if (live == null) {
                        stopSelf()
                    } else {
                        try {
                            ContextCompat.getSystemService(this@RunTrackingService, android.app.NotificationManager::class.java)
                                ?.notify(Notifications.RUN_ID, Notifications.run(this@RunTrackingService, live, u))
                        } catch (e: SecurityException) {
                            // Notifications disabled: the service keeps running without updates.
                        }
                    }
                }
        }
    }

    @SuppressLint("MissingPermission")
    private fun registerLocation() {
        if (!hasLocationPermission(this)) {
            session.onGpsProblem(RunSession.GpsProblem.NO_PERMISSION)
            return
        }
        val lm = getSystemService(LocationManager::class.java)
        if (!lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) session.onGpsProblem(RunSession.GpsProblem.PROVIDER_OFF)
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                val request = LocationRequest.Builder(UPDATE_INTERVAL_MS)
                    .setQuality(LocationRequest.QUALITY_HIGH_ACCURACY)
                    .setMinUpdateIntervalMillis(UPDATE_INTERVAL_MS)
                    .setMinUpdateDistanceMeters(0f)
                    .build()
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, request, mainExecutor, locationListener)
            } else {
                lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, UPDATE_INTERVAL_MS, 0f, locationListener, Looper.getMainLooper())
            }
        } catch (e: SecurityException) {
            session.onGpsProblem(RunSession.GpsProblem.NO_PERMISSION)
        } catch (e: IllegalArgumentException) {
            // The device has no GPS provider.
            session.onGpsProblem(RunSession.GpsProblem.PROVIDER_OFF)
        }
    }

    private fun registerSteps() {
        if (Build.VERSION.SDK_INT >= 29 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED
        ) return
        val sm = getSystemService(SensorManager::class.java) ?: return
        val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return
        sm.registerListener(stepListener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
    }

    @SuppressLint("WakelockTimeout")
    private fun acquireWakeLock() {
        val pm = getSystemService(PowerManager::class.java) ?: return
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "runova:run").apply {
            setReferenceCounted(false)
            acquire(MAX_RUN_MS)
        }
    }

    override fun onDestroy() {
        running = false
        getSystemService(LocationManager::class.java)?.removeUpdates(locationListener)
        getSystemService(SensorManager::class.java)?.unregisterListener(stepListener)
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        const val ACTION_PAUSE = "com.runova.app.action.PAUSE"
        const val ACTION_RESUME = "com.runova.app.action.RESUME"
        private const val UPDATE_INTERVAL_MS = 1_000L
        private const val MAX_RUN_MS = 12 * 60 * 60 * 1000L

        fun start(context: Context) {
            try {
                ContextCompat.startForegroundService(context, Intent(context, RunTrackingService::class.java))
            } catch (e: IllegalStateException) {
                // Not allowed from the background; the session reports the problem.
                context.graph.session.onServiceFailed()
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RunTrackingService::class.java))
        }

        fun hasLocationPermission(context: Context): Boolean =
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
}
