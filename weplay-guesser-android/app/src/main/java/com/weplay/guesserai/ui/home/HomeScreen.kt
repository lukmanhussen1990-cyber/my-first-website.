package com.weplay.guesserai.ui.home

import android.app.Activity
import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.weplay.guesserai.CrashLog
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.service.AssistantService
import com.weplay.guesserai.service.GameAppMonitor
import com.weplay.guesserai.ui.AppViewModels
import com.weplay.guesserai.ui.components.AppLogo
import com.weplay.guesserai.ui.components.GlassCard
import com.weplay.guesserai.ui.components.StatusPill
import com.weplay.guesserai.ui.theme.Bad
import com.weplay.guesserai.ui.theme.Ok
import com.weplay.guesserai.ui.theme.Warn
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HomeViewModel(private val app: WePlayGuesserApp) : AndroidViewModel(app) {
    private val c = app.container
    val running = c.assistantRunning
    val settings = c.settings.settings
    val keySaved = c.settings.keySaved
    val learnedCount = c.history.count.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), 0)

    fun canDrawOverlays() = Settings.canDrawOverlays(app)

    private var detecting = false

    /** Remember the installed WePlay app the first time we see it. The scan runs off the main thread. */
    fun detectGame() {
        if (detecting || c.settings.current.gamePackage.isNotBlank()) return
        detecting = true
        viewModelScope.launch {
            val found = withContext(Dispatchers.IO) { GameAppMonitor.findWePlayApps(app).firstOrNull() }
            detecting = false
            if (found != null && c.settings.current.gamePackage.isBlank()) c.settings.update { it.copy(gamePackage = found.first) }
        }
    }

    private val _lastCrash = MutableStateFlow<String?>(null)
    /** Details of the last crash, if the app crashed since they were dismissed. */
    val lastCrash = _lastCrash.asStateFlow()

    private val notices = app.getSharedPreferences("notices", Context.MODE_PRIVATE)
    private var closedAt = 0L
    private val _closedReason = MutableStateFlow<String?>(null)
    /** Why Android closed the app while the floating window was up, if it did since last shown (Android 11+). */
    val closedReason = _closedReason.asStateFlow()

    init {
        viewModelScope.launch {
            _lastCrash.value = withContext(Dispatchers.IO) { CrashLog.read(app) }
            _closedReason.value = withContext(Dispatchers.IO) { closedByAndroid() }
        }
    }

    fun dismissCrash() {
        _lastCrash.value = null
        viewModelScope.launch(Dispatchers.IO) { CrashLog.clear(app) }
    }

    fun dismissClosed() {
        _closedReason.value = null
        notices.edit().putLong(K_CLOSED_SEEN, closedAt).apply()
    }

    /**
     * Android (or the phone maker's battery saver) can close the app in the middle of a game, and
     * then the floating window just vanishes. Android 11+ keeps the reason; say it once.
     */
    private fun closedByAndroid(): String? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return null
        val exit = runCatching {
            app.getSystemService(ActivityManager::class.java).getHistoricalProcessExitReasons(app.packageName, 0, 1).firstOrNull()
        }.getOrNull() ?: return null
        // Only while the floating window was up (not after the AI was stopped), and only once.
        if (exit.importance > ActivityManager.RunningAppProcessInfo.IMPORTANCE_PERCEPTIBLE) return null
        if (exit.timestamp <= notices.getLong(K_CLOSED_SEEN, 0L)) return null
        closedAt = exit.timestamp
        return when (exit.reason) {
            ApplicationExitInfo.REASON_LOW_MEMORY -> "to free memory for other apps"
            ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "to save battery"
            ApplicationExitInfo.REASON_ANR -> "because it stopped responding"
            ApplicationExitInfo.REASON_SIGNALED, ApplicationExitInfo.REASON_OTHER ->
                "(usually the phone's battery saver or app cleaner)"
            ApplicationExitInfo.REASON_CRASH_NATIVE, ApplicationExitInfo.REASON_DEPENDENCY_DIED,
            ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "after an error inside Android"
            // A crash has its own notice; the rest were asked for (Stop, force stop, an update).
            else -> null
        }
    }

    fun gameLaunchIntent(): Intent? =
        c.settings.current.gamePackage.takeIf { it.isNotBlank() }?.let { app.packageManager.getLaunchIntentForPackage(it) }
}

private const val K_CLOSED_SEEN = "closed_seen"

@Composable
fun HomeScreen(
    onNeedSetup: () -> Unit,
    onNeedPermissions: () -> Unit,
    onSettings: () -> Unit,
    onHistory: () -> Unit,
    vm: HomeViewModel = viewModel(factory = AppViewModels.Factory),
) {
    val ctx = LocalContext.current
    val running by vm.running.collectAsState()
    val settings by vm.settings.collectAsState()
    val keySaved by vm.keySaved.collectAsState()
    val learned by vm.learnedCount.collectAsState()
    val lastCrash by vm.lastCrash.collectAsState()
    val closedReason by vm.closedReason.collectAsState()
    LifecycleResumeEffect(Unit) { vm.detectGame(); onPauseOrDispose { } }

    val projectionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        if (result.resultCode == Activity.RESULT_OK && data != null) {
            AssistantService.start(ctx, result.resultCode, data)
            // Jump straight into the game; the overlay follows.
            vm.gameLaunchIntent()?.let { ctx.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        }
    }

    fun startAi() {
        when {
            !settings.hasApiKey -> onNeedSetup()
            !vm.canDrawOverlays() -> onNeedPermissions()
            else -> {
                val mpm = ctx.getSystemService(MediaProjectionManager::class.java)
                // A phone without screen sharing (or with it blocked by a work policy) has no prompt to show.
                runCatching {
                    // The entire screen, never "one app": the AI reads WePlay by screen position, and
                    // Android ends a one-app share when that app's screen closes, which made the
                    // floating window vanish.
                    val prompt = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                        mpm.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
                    } else {
                        mpm.createScreenCaptureIntent()
                    }
                    projectionLauncher.launch(prompt)
                }.onFailure {
                    Toast.makeText(ctx, "This phone does not allow screen sharing, which the AI needs to see the drawing.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    Column(
        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AppLogo(52.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text("WePlay AI", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Drawing Guesser assistant", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            }
            if (running) StatusPill("Live", Ok) else StatusPill("Off", Warn)
        }

        lastCrash?.let { details ->
            GlassCard {
                Text("WePlay AI stopped unexpectedly last time", fontWeight = FontWeight.SemiBold, color = Bad)
                Text(
                    "Sorry about that. Copy the details and send them to the developer so it can be fixed.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = {
                        ctx.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("WePlay AI crash", details))
                        Toast.makeText(ctx, "Details copied", Toast.LENGTH_SHORT).show()
                    }, modifier = Modifier.weight(1f)) { Text("Copy details") }
                    OutlinedButton(onClick = vm::dismissCrash, modifier = Modifier.weight(1f)) { Text("Dismiss") }
                }
            }
        }

        closedReason?.let { reason ->
            GlassCard {
                Text("Android closed WePlay AI during your last game", fontWeight = FontWeight.SemiBold, color = Warn)
                Text(
                    "It was closed $reason, so the floating window disappeared. To keep it running, allow WePlay AI " +
                        "to run in the background without battery limits in its app settings (Battery → Unrestricted).",
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = {
                        runCatching {
                            ctx.startActivity(
                                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", ctx.packageName, null))
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            )
                        }.onFailure {
                            Toast.makeText(ctx, "Open Android Settings → Apps → WePlay AI → Battery", Toast.LENGTH_LONG).show()
                        }
                    }, modifier = Modifier.weight(1f)) { Text("App settings") }
                    OutlinedButton(onClick = vm::dismissClosed, modifier = Modifier.weight(1f)) { Text("Dismiss") }
                }
            }
        }

        GlassCard {
            Text(if (running) "The AI overlay is running" else "Ready to play", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                if (running) "Switch to WePlay — the floating window shows live guesses. Drag it anywhere; tap a guess to copy it, then paste it in the chat."
                else "Press Start AI, allow screen sharing, and the floating assistant appears on top of WePlay.",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp,
            )
            if (!running) {
                Button(
                    onClick = ::startAi,
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth().height(58.dp).semantics { contentDescription = "Start AI" },
                ) { Text("▶  Start AI", fontSize = 18.sp, fontWeight = FontWeight.Bold) }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    vm.gameLaunchIntent()?.let { launch ->
                        Button(onClick = { ctx.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }, modifier = Modifier.weight(1f)) {
                            Text("Open WePlay")
                        }
                    }
                    OutlinedButton(
                        onClick = { AssistantService.stop(ctx) },
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Bad),
                        modifier = Modifier.weight(1f),
                    ) { Text("Stop AI") }
                }
            }
        }

        GlassCard {
            Text("Status", fontWeight = FontWeight.SemiBold)
            when {
                !settings.hasApiKey -> InfoRow("API key", "Missing", Bad)
                keySaved -> InfoRow("API key", "Saved", Ok)
                else -> InfoRow("API key", "Until app closes", Warn)
            }
            InfoRow("Overlay permission", if (vm.canDrawOverlays()) "Granted" else "Needed", if (vm.canDrawOverlays()) Ok else Warn)
            InfoRow("Model", settings.model.label.takeIf { settings.modelId == settings.model.id } ?: settings.modelId, MaterialTheme.colorScheme.secondary)
            InfoRow("Capture speed", "every ${settings.captureSpeed.label}", MaterialTheme.colorScheme.secondary)
            InfoRow("WePlay app", settings.gamePackage.ifBlank { "Not found" }, if (settings.gamePackage.isBlank()) Warn else Ok)
            InfoRow("Drawings learned", "$learned", MaterialTheme.colorScheme.tertiary)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NavButton("Settings", onSettings)
            NavButton("History", onHistory)
            NavButton("Permissions", onNeedPermissions)
        }

        Text(
            "Tip: Hold a guess in the overlay when it was the right answer — the AI remembers it and ranks it higher in future rounds.",
            color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp,
        )
    }
}

/** One of three equal buttons; tight padding and one line, so "Permissions" never breaks mid-word on a narrow phone. */
@Composable
private fun RowScope.NavButton(label: String, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick, contentPadding = PaddingValues(horizontal = 6.dp), modifier = Modifier.weight(1f)) {
        Text(label, maxLines = 1, softWrap = false, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun InfoRow(label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp, modifier = Modifier.weight(1f))
        Text(value, color = color, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
    }
}
