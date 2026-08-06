package com.alarmhandler.app.ui.sound

import android.app.Activity
import android.content.Intent
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.alarmhandler.app.R
import com.alarmhandler.app.alarm.AlarmPlayer
import com.alarmhandler.app.data.model.AlarmSound
import com.alarmhandler.app.ui.components.PixelButton
import com.alarmhandler.app.ui.components.PixelOutlineButton
import com.alarmhandler.app.ui.components.PixelSectionHeader
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.ui.components.PixelTopBar

/**
 * Choose a tone: one of the five shipped with the app, a device ringtone, an
 * audio file, or silence.
 *
 * Tapping a row auditions it. Nothing is committed until Use this sound is
 * pressed, so the user can compare without changing their alarm.
 */
@Composable
fun SoundPickerScreen(
    currentSoundId: String,
    onBack: () -> Unit,
    onPicked: (String) -> Unit,
) {
    val context = LocalContext.current
    var selected by remember { mutableStateOf(currentSoundId) }
    var preview by remember { mutableStateOf<MediaPlayer?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    fun stopPreview() {
        preview?.let { mp ->
            runCatching { if (mp.isPlaying) mp.stop() }
            runCatching { mp.release() }
        }
        preview = null
    }

    fun audition(id: String) {
        stopPreview()
        if (id == AlarmSound.SILENT_ID) return
        preview = AlarmPlayer.preview(context, id)
        if (preview == null) {
            error = "That sound could not be played on this device."
        }
    }

    DisposableEffect(Unit) { onDispose { stopPreview() } }

    val ringtoneLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != Activity.RESULT_OK) return@rememberLauncherForActivityResult
        val uri = result.data
            ?.getParcelableExtra<Uri>(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
        if (uri == null) {
            selected = AlarmSound.SILENT_ID
        } else {
            selected = "${AlarmSound.DEVICE_PREFIX}$uri"
            audition(selected)
        }
    }

    val fileLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        // Without a persisted grant the alarm would fall silent after a reboot.
        val persisted = runCatching {
            context.contentResolver.takePersistableUriPermission(
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION,
            )
        }.isSuccess
        if (!persisted) {
            error = "Android would not grant lasting access to that file. " +
                "Try a ringtone instead."
            return@rememberLauncherForActivityResult
        }
        selected = "${AlarmSound.DEVICE_PREFIX}$uri"
        audition(selected)
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding())
    ) {
        PixelTopBar(title = stringResource(R.string.sound_picker), onBack = onBack)

        error?.let {
            PixelSurface(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                color = MaterialTheme.colorScheme.error,
                onClick = { error = null },
            ) {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onError,
                )
            }
        }

        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(bottom = 24.dp),
        ) {
            item {
                PixelSectionHeader(
                    "Built into Alarm Handler",
                    Modifier.padding(horizontal = 20.dp),
                )
            }
            items(AlarmSound.builtIns, key = { it.id }) { tone ->
                SoundRow(
                    title = tone.displayName,
                    subtitle = "Included in the app, always available",
                    selected = selected == tone.id,
                    onClick = {
                        selected = tone.id
                        audition(tone.id)
                    },
                )
            }

            item {
                PixelSectionHeader("From this device", Modifier.padding(horizontal = 20.dp))
            }
            item {
                SoundRow(
                    title = if (selected.startsWith(AlarmSound.DEVICE_PREFIX)) {
                        AlarmSound.displayName(context, selected)
                    } else {
                        "Choose a ringtone or alarm"
                    },
                    subtitle = "Pick from the sounds already on your phone",
                    selected = selected.startsWith(AlarmSound.DEVICE_PREFIX),
                    onClick = {
                        val intent = Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
                            putExtra(
                                RingtoneManager.EXTRA_RINGTONE_TYPE,
                                RingtoneManager.TYPE_ALARM or RingtoneManager.TYPE_RINGTONE,
                            )
                            putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Alarm sound")
                            putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                        }
                        runCatching { ringtoneLauncher.launch(intent) }
                            .onFailure { error = "This device has no ringtone picker." }
                    },
                )
            }
            item {
                SoundRow(
                    title = "Choose an audio file",
                    subtitle = "Any music or audio file you have saved",
                    selected = false,
                    onClick = {
                        runCatching { fileLauncher.launch(arrayOf("audio/*")) }
                            .onFailure { error = "No file picker is available." }
                    },
                )
            }

            item { PixelSectionHeader("Quiet", Modifier.padding(horizontal = 20.dp)) }
            item {
                SoundRow(
                    title = "Silent",
                    subtitle = "Vibration only — make sure vibration is switched on",
                    selected = selected == AlarmSound.SILENT_ID,
                    onClick = {
                        selected = AlarmSound.SILENT_ID
                        stopPreview()
                    },
                )
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .padding(
                    start = 16.dp,
                    end = 16.dp,
                    bottom = 16.dp + WindowInsets.navigationBars.asPaddingValues()
                        .calculateBottomPadding(),
                ),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            PixelOutlineButton(
                text = stringResource(R.string.cancel),
                onClick = {
                    stopPreview()
                    onBack()
                },
                modifier = Modifier.weight(1f),
            )
            PixelButton(
                text = "Use this sound",
                onClick = {
                    stopPreview()
                    onPicked(selected)
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun SoundRow(
    title: String,
    subtitle: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    PixelSurface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 5.dp),
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        onClick = onClick,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // The marker means the choice is not signalled by colour alone.
            Text(
                text = if (selected) "[x]" else "[ ]",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
