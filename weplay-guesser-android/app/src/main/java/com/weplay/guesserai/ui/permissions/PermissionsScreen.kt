package com.weplay.guesserai.ui.permissions

import android.Manifest
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import com.weplay.guesserai.service.GameAppMonitor
import com.weplay.guesserai.ui.AppViewModels
import com.weplay.guesserai.ui.components.GlassCard
import com.weplay.guesserai.ui.components.StatusPill
import com.weplay.guesserai.ui.theme.Ok
import com.weplay.guesserai.ui.theme.Warn
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class PermissionState(
    val overlay: Boolean = false,
    val notifications: Boolean = false,
    val usageAccess: Boolean = false,
) {
    val requiredGranted: Boolean get() = overlay
}

class PermissionsViewModel(private val app: Application) : AndroidViewModel(app) {
    private val _state = MutableStateFlow(read())
    val state = _state.asStateFlow()

    fun refresh() { _state.value = read() }

    private fun read() = PermissionState(
        overlay = Settings.canDrawOverlays(app),
        notifications = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(app, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED,
        usageAccess = GameAppMonitor(app).hasUsageAccess(),
    )
}

@Composable
fun PermissionsScreen(onContinue: () -> Unit, vm: PermissionsViewModel = viewModel(factory = AppViewModels.Factory)) {
    val ctx = LocalContext.current
    val s by vm.state.collectAsState()
    LifecycleResumeEffect(Unit) { vm.refresh(); onPauseOrDispose { } }
    val notifLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { vm.refresh() }

    Column(
        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("Permissions", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(
            "The assistant floats above WePlay and reads the screen. Android asks you to allow both explicitly.",
            color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp,
        )

        PermissionCard(
            title = "Display over other apps",
            body = "Required. Shows the floating AI window on top of the game.",
            granted = s.overlay, required = true, action = "Allow",
        ) {
            ctx.openSettings(
                "Display over other apps",
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${ctx.packageName}")),
                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION),
            )
        }

        PermissionCard(
            title = "Screen capture",
            body = "Required. Asked each time you press Start AI — Android shows a \"Start recording or casting\" prompt. " +
                "On Android 14+ you can share only the WePlay app.",
            granted = null, required = true, action = null,
        ) {}

        PermissionCard(
            title = "Notifications",
            body = "Recommended. Shows the running-assistant notification with a Stop button.",
            granted = s.notifications, required = false, action = "Allow",
        ) {
            if (Build.VERSION.SDK_INT >= 33) notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        PermissionCard(
            title = "Usage access",
            body = "Optional. Lets the AI sleep automatically when WePlay is not on screen, saving battery and API calls.",
            granted = s.usageAccess, required = false, action = "Allow",
        ) {
            ctx.openSettings("Usage access", Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }

        Spacer(Modifier.height(4.dp))
        Button(onClick = onContinue, enabled = s.requiredGranted, modifier = Modifier.fillMaxWidth().height(52.dp)) {
            Text(if (s.requiredGranted) "Continue" else "Allow overlay to continue", fontWeight = FontWeight.Bold)
        }
    }
}

/**
 * Opens the first of [screens] this phone has; some phones (Android Go, some brands) leave these
 * screens out. Falls back to the app's own page in Android settings, else says where to look.
 */
private fun Context.openSettings(what: String, vararg screens: Intent) {
    val appPage = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
    val opened = (screens.toList() + appPage).any { runCatching { startActivity(it) }.isSuccess }
    if (!opened) Toast.makeText(this, "Open Android Settings → Apps → WePlay AI → $what", Toast.LENGTH_LONG).show()
}

@Composable
private fun PermissionCard(
    title: String, body: String, granted: Boolean?, required: Boolean, action: String?, onAction: () -> Unit,
) {
    GlassCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            when (granted) {
                true -> StatusPill("Granted", Ok)
                false -> StatusPill(if (required) "Needed" else "Off", Warn)
                null -> StatusPill("On start", MaterialTheme.colorScheme.secondary)
            }
        }
        Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        if (action != null && granted == false) {
            FilledTonalButton(onClick = onAction) { Text(action) }
        }
    }
}
