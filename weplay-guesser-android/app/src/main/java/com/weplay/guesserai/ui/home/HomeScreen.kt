package com.weplay.guesserai.ui.home

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.provider.Settings
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
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

    fun gameLaunchIntent(): Intent? =
        c.settings.current.gamePackage.takeIf { it.isNotBlank() }?.let { app.packageManager.getLaunchIntentForPackage(it) }
}

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
                projectionLauncher.launch(mpm.createScreenCaptureIntent())
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
                    modifier = Modifier.fillMaxWidth().height(58.dp),
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
