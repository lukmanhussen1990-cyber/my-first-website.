package com.alarmhandler.app.ui.components

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.alarmhandler.app.R
import com.alarmhandler.app.util.AlarmPermissionIssue
import com.alarmhandler.app.util.AlarmPermissionState
import com.alarmhandler.app.util.AlarmPermissions

/**
 * Live permission state, refreshed whenever the screen comes back to the
 * foreground -- which is exactly when the user returns from a system settings
 * page they were sent to.
 */
@Composable
fun rememberAlarmPermissionState(): AlarmPermissionState {
    val context = LocalContext.current
    var state by remember { mutableStateOf(AlarmPermissions.read(context)) }
    val owner = LocalLifecycleOwner.current
    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                state = AlarmPermissions.read(context)
            }
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    return state
}

private data class IssueCopy(val title: String, val body: String)

@Composable
private fun copyFor(issue: AlarmPermissionIssue): IssueCopy = when (issue) {
    AlarmPermissionIssue.NOTIFICATIONS -> IssueCopy(
        stringResource(R.string.perm_notif_title),
        stringResource(R.string.perm_notif_body),
    )

    AlarmPermissionIssue.EXACT_ALARMS -> IssueCopy(
        stringResource(R.string.perm_exact_title),
        stringResource(R.string.perm_exact_body),
    )

    AlarmPermissionIssue.FULL_SCREEN -> IssueCopy(
        stringResource(R.string.perm_fsi_title),
        stringResource(R.string.perm_fsi_body),
    )

    AlarmPermissionIssue.BATTERY -> IssueCopy(
        stringResource(R.string.perm_battery_title),
        stringResource(R.string.perm_battery_body),
    )
}

/**
 * One warning card per unmet permission.
 *
 * Nothing here blocks the app: each card explains what is degraded and offers
 * the one system screen that fixes it.
 */
@Composable
fun PermissionWarnings(
    state: AlarmPermissionState,
    modifier: Modifier = Modifier,
    dismissible: Boolean = true,
    onDismissed: (AlarmPermissionIssue) -> Unit = {},
    hidden: Set<AlarmPermissionIssue> = emptySet(),
) {
    val context = LocalContext.current
    val issues = state.blockingIssues.filterNot { it in hidden }
    if (issues.isEmpty()) return

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* The card disappears on the next resume if it was granted. */ }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        issues.forEach { issue ->
            val copy = copyFor(issue)
            PixelSurface(
                color = MaterialTheme.colorScheme.primaryContainer,
                borderColor = MaterialTheme.colorScheme.outline,
            ) {
                Text(
                    text = "! ${copy.title}",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = copy.body,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Spacer(Modifier.height(14.dp))
                Row(Modifier.fillMaxWidth()) {
                    PixelButton(
                        text = stringResource(R.string.perm_fix),
                        onClick = {
                            if (issue == AlarmPermissionIssue.NOTIFICATIONS &&
                                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                            ) {
                                notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            } else {
                                AlarmPermissions.intentFor(context, issue)?.let { intent ->
                                    runCatching { context.startActivity(intent) }
                                }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        minHeight = 52,
                    )
                    if (dismissible) {
                        Spacer(Modifier.width(10.dp))
                        PixelOutlineButton(
                            text = stringResource(R.string.perm_dismiss),
                            onClick = { onDismissed(issue) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }
    }
}

/** Compact single-line status used on the Settings screen. */
@Composable
fun PermissionStatusRow(
    label: String,
    granted: Boolean,
    onFix: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
    ) {
        // Status is spelled out, never signalled by colour alone.
        Text(
            text = if (granted) "[OK]" else "[!]",
            style = MaterialTheme.typography.labelMedium,
            color = if (granted) {
                MaterialTheme.colorScheme.onSurfaceVariant
            } else {
                MaterialTheme.colorScheme.primary
            },
        )
        Spacer(Modifier.width(10.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        if (!granted) {
            Spacer(Modifier.width(10.dp))
            PixelOutlineButton(
                text = stringResource(R.string.perm_fix),
                onClick = onFix,
                modifier = Modifier.width(120.dp),
            )
        }
    }
}
