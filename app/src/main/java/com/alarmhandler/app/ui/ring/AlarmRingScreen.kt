package com.alarmhandler.app.ui.ring

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.alarmhandler.app.R
import com.alarmhandler.app.alarm.AlarmService
import com.alarmhandler.app.alarm.RingingState
import com.alarmhandler.app.data.model.DismissChallenge
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.ui.components.CityBackdropImage
import com.alarmhandler.app.ui.components.Mascot
import com.alarmhandler.app.ui.components.MascotMood
import com.alarmhandler.app.ui.components.PixelButton
import com.alarmhandler.app.ui.components.PixelOutlineButton
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.util.TimeFormat
import kotlinx.coroutines.delay
import java.time.LocalTime

/**
 * The immersive ringing screen: pixel city behind, mascot in front, and one
 * unmissable pair of controls.
 */
@Composable
fun AlarmRingScreen(
    settings: AppSettings,
    onFinished: () -> Unit,
) {
    val context = LocalContext.current
    val session by RingingState.session.collectAsStateWithLifecycle()
    val use24Hour = TimeFormat.use24Hour(context, settings.clockFormat)

    // A live clock, ticking on the second so the display never looks stale.
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(1_000)
        }
    }

    // Seconds the alarm has been ringing, used by the safety-dismiss timer.
    var ringingSeconds by remember { mutableStateOf(0) }
    LaunchedEffect(session?.startedAt) {
        ringingSeconds = 0
        while (true) {
            delay(1_000)
            ringingSeconds++
        }
    }

    val current = session
    // The service clears the session once it has finished tidying up; that is
    // this screen's cue to close.
    LaunchedEffect(current) {
        if (current == null) {
            delay(120)
            onFinished()
        }
    }

    if (current == null) {
        Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background))
        return
    }

    val alarm = current.alarm
    var challengePassed by remember(alarm.id) { mutableStateOf(false) }

    val safetyReached = alarm.safetyDismissSeconds > 0 &&
        ringingSeconds >= alarm.safetyDismissSeconds
    val needsChallenge = alarm.challenge != DismissChallenge.TAP &&
        !challengePassed &&
        !safetyReached &&
        current.phase == RingingState.Phase.RINGING

    val mood = when (current.phase) {
        RingingState.Phase.DISMISSED -> MascotMood.CELEBRATING
        RingingState.Phase.SNOOZED -> MascotMood.ANNOYED
        RingingState.Phase.RINGING ->
            if (alarm.snoozeCount >= 2) MascotMood.ANNOYED else MascotMood.JUMPING
    }

    val headline = when (current.phase) {
        RingingState.Phase.DISMISSED -> stringResource(R.string.ring_dismissed)
        RingingState.Phase.SNOOZED -> stringResource(R.string.ring_snoozed)
        RingingState.Phase.RINGING ->
            if (alarm.snoozeCount >= 2) {
                stringResource(R.string.ring_snoozed)
            } else {
                stringResource(R.string.ring_wake_up)
            }
    }

    val configuration = LocalConfiguration.current
    val compact = configuration.screenHeightDp < 640

    Box(Modifier.fillMaxSize()) {
        CityBackdropImage(Modifier.fillMaxSize())

        Column(
            Modifier
                .fillMaxSize()
                .padding(
                    top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + 16.dp,
                    bottom = WindowInsets.navigationBars.asPaddingValues()
                        .calculateBottomPadding() + 16.dp,
                    start = 20.dp,
                    end = 20.dp,
                ),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val time = LocalTime.now()
            Text(
                text = TimeFormat.time(time.hour, time.minute, use24Hour),
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.onBackground,
            )
            val suffix = TimeFormat.meridiem(time.hour, use24Hour)
            if (suffix.isNotEmpty()) {
                Text(
                    text = suffix,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
            }

            Spacer(Modifier.height(8.dp))
            Text(
                text = alarm.label.ifBlank { stringResource(R.string.app_name) },
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onBackground,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = headline,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(if (compact) 8.dp else 20.dp))

            if (!needsChallenge) {
                Mascot(
                    mood = mood,
                    contentDescription = stringResource(R.string.cd_mascot),
                    modifier = Modifier.size(
                        width = if (compact) 180.dp else 264.dp,
                        height = if (compact) 120.dp else 176.dp,
                    ),
                )
            }

            Spacer(Modifier.weight(1f))

            if (current.phase != RingingState.Phase.RINGING) {
                // Closing state: the service is already shutting things down.
                PixelSurface(color = MaterialTheme.colorScheme.surface) {
                    Text(
                        text = if (current.phase == RingingState.Phase.SNOOZED) {
                            "Back in ${alarm.snoozeMinutes} minutes."
                        } else {
                            "See you next time."
                        },
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                }
                Spacer(Modifier.height(12.dp))
                return@Column
            }

            if (needsChallenge) {
                PixelSurface(
                    modifier = Modifier.fillMaxWidth(),
                    color = MaterialTheme.colorScheme.surface,
                ) {
                    when (alarm.challenge) {
                        DismissChallenge.HOLD -> HoldToDismissChallenge(
                            onSolved = { challengePassed = true },
                        )

                        DismissChallenge.MATH -> MathChallenge(
                            onSolved = { challengePassed = true },
                        )

                        DismissChallenge.TAP_MASCOT -> TapMascotChallenge(
                            required = alarm.challengeStrength,
                            onSolved = { challengePassed = true },
                        )

                        DismissChallenge.MEMORY -> MemoryChallenge(
                            length = alarm.challengeStrength,
                            onSolved = { challengePassed = true },
                        )

                        DismissChallenge.SHAKE -> ShakeChallenge(
                            required = alarm.challengeStrength,
                            onSolved = { challengePassed = true },
                        )

                        DismissChallenge.TAP -> Unit
                    }
                    if (alarm.safetyDismissSeconds > 0) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            text = "A plain Dismiss button appears in " +
                                "${(alarm.safetyDismissSeconds - ringingSeconds)
                                    .coerceAtLeast(0)}s.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
            }

            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                val snoozeLabel = when {
                    !alarm.canSnooze -> stringResource(R.string.no_snoozes_left)
                    else -> "${stringResource(R.string.snooze)} ${alarm.snoozeMinutes}m"
                }
                PixelOutlineButton(
                    text = snoozeLabel,
                    onClick = { AlarmService.snooze(context) },
                    enabled = alarm.canSnooze,
                    modifier = Modifier.weight(1f),
                )
                PixelButton(
                    text = stringResource(R.string.dismiss),
                    onClick = { AlarmService.dismiss(context) },
                    enabled = !needsChallenge,
                    modifier = Modifier.weight(1f),
                    minHeight = 72,
                )
            }

            alarm.snoozesRemaining?.let { remaining ->
                Spacer(Modifier.height(8.dp))
                Text(
                    text = if (remaining == 1) {
                        stringResource(R.string.snoozes_left, remaining)
                    } else {
                        stringResource(R.string.snoozes_left_plural, remaining)
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}