package com.alarmhandler.app.ui.about

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.alarmhandler.app.BuildConfig
import com.alarmhandler.app.R
import com.alarmhandler.app.ui.components.CityHeaderImage
import com.alarmhandler.app.ui.components.Mascot
import com.alarmhandler.app.ui.components.MascotMood
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.ui.components.PixelTopBar
import com.alarmhandler.app.util.AlarmPermissions

@Composable
fun AboutScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    // Tapping the mascot cycles its moods -- a small reward for exploring.
    var moodIndex by remember { mutableStateOf(0) }
    val moods = MascotMood.entries
    val mood = moods[moodIndex % moods.size]

    Column(
        Modifier
            .fillMaxSize()
            .padding(top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding())
    ) {
        PixelTopBar(title = stringResource(R.string.about), onBack = onBack)

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
        ) {
            CityHeaderImage(Modifier.fillMaxWidth())

            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Mascot(
                        mood = mood,
                        contentDescription = stringResource(R.string.cd_mascot),
                        modifier = Modifier.size(96.dp, 64.dp),
                    )
                    Spacer(Modifier.width(14.dp))
                    Column {
                        Text(
                            text = stringResource(R.string.app_name),
                            style = MaterialTheme.typography.headlineMedium,
                            color = MaterialTheme.colorScheme.onBackground,
                        )
                        Text(
                            text = "Version ${BuildConfig.VERSION_NAME}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                InfoCard(
                    title = "Who is the Alarm Handler?",
                    body = "The little red creature is in charge of your mornings. " +
                        "It sleeps while an alarm is pending, jumps when it rings, " +
                        "sulks if you snooze too often, and celebrates when you " +
                        "finally get up.",
                    onClick = { moodIndex++ },
                )

                InfoCard(
                    title = "Everything stays on your phone",
                    body = "There is no account, no server and no internet access. " +
                        "Alarms live in a database on this device, and backups are " +
                        "plain JSON files you choose where to save.",
                )

                InfoCard(
                    title = "Why the app asks for permissions",
                    body = "Exact alarms let it ring on the minute rather than whenever " +
                        "Android feels like it. Notifications carry the alarm controls. " +
                        "Full-screen notifications put the alarm over your lock screen. " +
                        "Excluding it from battery optimisation stops the system " +
                        "delaying alarms overnight.",
                    onClick = {
                        runCatching {
                            context.startActivity(AlarmPermissions.appSettingsIntent(context))
                        }
                    },
                )

                InfoCard(
                    title = "If an alarm ever seems late",
                    body = "Check Settings for any warning cards, and make sure your " +
                        "phone's own battery saver is not restricting the app. " +
                        "Some manufacturers add an extra 'protected apps' list that " +
                        "Android itself does not control.",
                )

                InfoCard(
                    title = "Artwork",
                    body = "The mascot and the pixel-city skyline were supplied with " +
                        "the app and are drawn at their original pixel scale, with " +
                        "nearest-neighbour scaling so they never blur.",
                )

                Spacer(
                    Modifier.height(
                        24.dp + WindowInsets.navigationBars.asPaddingValues()
                            .calculateBottomPadding()
                    )
                )
            }
        }
    }
}

@Composable
private fun InfoCard(title: String, body: String, onClick: (() -> Unit)? = null) {
    PixelSurface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        onClick = onClick,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
