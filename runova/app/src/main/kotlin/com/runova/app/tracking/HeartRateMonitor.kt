package com.runova.app.tracking

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import androidx.core.content.ContextCompat
import com.runova.app.state.AppSettings
import com.runova.app.state.HeartRateParser
import com.runova.app.ui.model.BleDeviceUi
import com.runova.app.ui.model.HrConnection
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Bluetooth LE heart-rate straps and watches that expose the standard Heart Rate service
 * (0x180D). Scans, connects, subscribes to measurements and reconnects after drop-outs.
 */
@SuppressLint("MissingPermission") // every entry point checks hasPermissions() first
class HeartRateMonitor(context: Context, private val scope: CoroutineScope) {

    data class State(
        val supported: Boolean = false,
        val bluetoothOn: Boolean = false,
        val permissionGranted: Boolean = false,
        val scanning: Boolean = false,
        val devices: List<BleDeviceUi> = emptyList(),
        val connection: HrConnection = HrConnection.DISCONNECTED,
        val deviceName: String? = null,
        val address: String? = null,
        val bpm: Int? = null,
    )

    private val app = context.applicationContext
    private val manager: BluetoothManager? = app.getSystemService(BluetoothManager::class.java)
    private val mutable = MutableStateFlow(State())
    val state: StateFlow<State> = mutable.asStateFlow()

    private val lock = Any()
    private var gatt: BluetoothGatt? = null
    private var scanJob: Job? = null
    private var wanted: String? = null
    private var connectedForRun = false

    init {
        refresh()
    }

    val requiredPermissions: Array<String>
        get() = if (Build.VERSION.SDK_INT >= 31) arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

    fun hasPermissions(): Boolean = requiredPermissions.all {
        ContextCompat.checkSelfPermission(app, it) == PackageManager.PERMISSION_GRANTED
    }

    private fun update(f: State.() -> State) = mutable.update(f)

    fun refresh() {
        val adapter = manager?.adapter
        update {
            copy(
                supported = adapter != null && app.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE),
                bluetoothOn = adapter?.isEnabled == true,
                permissionGranted = hasPermissions(),
            )
        }
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            val name = result.scanRecord?.deviceName ?: runCatching { device.name }.getOrNull() ?: "Heart rate sensor"
            val item = BleDeviceUi(device.address, name, result.rssi)
            update { copy(devices = (devices.filter { it.address != item.address } + item).sortedByDescending { it.rssi }) }
        }

        override fun onScanFailed(errorCode: Int) {
            update { copy(scanning = false) }
        }
    }

    fun startScan() {
        refresh()
        val s = state.value
        if (!s.supported || !s.bluetoothOn || !s.permissionGranted) return
        val scanner = manager?.adapter?.bluetoothLeScanner ?: return
        stopScan()
        update { copy(scanning = true, devices = emptyList()) }
        try {
            scanner.startScan(
                listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(HR_SERVICE)).build()),
                ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),
                scanCallback,
            )
        } catch (e: SecurityException) {
            update { copy(scanning = false, permissionGranted = false) }
            return
        }
        scanJob = scope.launch {
            delay(SCAN_MS)
            stopScan()
        }
    }

    fun stopScan() {
        scanJob?.cancel()
        scanJob = null
        if (state.value.scanning) {
            try {
                manager?.adapter?.bluetoothLeScanner?.stopScan(scanCallback)
            } catch (e: Exception) {
                // Bluetooth turned off or permission revoked mid-scan.
            }
        }
        update { copy(scanning = false) }
    }

    fun connect(address: String, name: String?) {
        stopScan()
        if (!hasPermissions()) return
        val device = try {
            manager?.adapter?.getRemoteDevice(address)
        } catch (e: IllegalArgumentException) {
            null
        } ?: return
        synchronized(lock) {
            closeGatt()
            wanted = address
            update { copy(connection = HrConnection.CONNECTING, deviceName = name ?: deviceName, address = address, bpm = null) }
            gatt = try {
                device.connectGatt(app, false, gattCallback, BluetoothDevice.TRANSPORT_LE)
            } catch (e: SecurityException) {
                null
            }
            if (gatt == null) update { copy(connection = HrConnection.DISCONNECTED) }
        }
    }

    fun disconnect() {
        synchronized(lock) {
            wanted = null
            connectedForRun = false
            closeGatt()
        }
        update { copy(connection = HrConnection.DISCONNECTED, bpm = null) }
    }

    /** Connects the saved device when a run starts, unless already connected. */
    fun connectSaved(settings: AppSettings) {
        val address = settings.heartRateAddress ?: return
        refresh()
        val s = state.value
        if (s.connection != HrConnection.DISCONNECTED || !s.bluetoothOn || !s.permissionGranted) return
        connectedForRun = true
        connect(address, settings.heartRateName)
    }

    /** Drops a connection that was opened only for the run that just ended. */
    fun releaseForRun() {
        if (connectedForRun) disconnect()
    }

    private fun closeGatt() {
        val g = gatt ?: return
        gatt = null
        try {
            g.disconnect()
            g.close()
        } catch (e: SecurityException) {
            // Nothing else to release.
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    try {
                        g.discoverServices()
                    } catch (e: SecurityException) {
                        update { copy(connection = HrConnection.DISCONNECTED) }
                    }
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    val retry: String?
                    synchronized(lock) {
                        if (gatt === g) gatt = null
                        runCatching { g.close() }
                        retry = wanted
                    }
                    update { copy(connection = HrConnection.DISCONNECTED, bpm = null) }
                    if (retry != null) {
                        scope.launch {
                            delay(RECONNECT_DELAY_MS)
                            if (wanted == retry && gatt == null) connect(retry, state.value.deviceName)
                        }
                    }
                }
            }
        }

        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            val characteristic = g.getService(HR_SERVICE)?.getCharacteristic(HR_MEASUREMENT)
            if (characteristic == null) {
                // Not a heart-rate device after all.
                synchronized(lock) { wanted = null }
                runCatching { g.disconnect() }
                return
            }
            try {
                g.setCharacteristicNotification(characteristic, true)
                characteristic.getDescriptor(CCCD)?.let { d ->
                    if (Build.VERSION.SDK_INT >= 33) {
                        g.writeDescriptor(d, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
                    } else {
                        @Suppress("DEPRECATION")
                        d.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        @Suppress("DEPRECATION")
                        g.writeDescriptor(d)
                    }
                }
                update { copy(connection = HrConnection.CONNECTED) }
            } catch (e: SecurityException) {
                update { copy(connection = HrConnection.DISCONNECTED) }
            }
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            onMeasurement(value)
        }

        @Deprecated("Deprecated in Java")
        override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            @Suppress("DEPRECATION")
            if (Build.VERSION.SDK_INT < 33) onMeasurement(characteristic.value)
        }
    }

    private fun onMeasurement(value: ByteArray?) {
        val bpm = HeartRateParser.parse(value) ?: return
        update { copy(bpm = bpm, connection = HrConnection.CONNECTED) }
    }

    companion object {
        val HR_SERVICE: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        val HR_MEASUREMENT: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val SCAN_MS = 15_000L
        private const val RECONNECT_DELAY_MS = 3_000L
    }
}
