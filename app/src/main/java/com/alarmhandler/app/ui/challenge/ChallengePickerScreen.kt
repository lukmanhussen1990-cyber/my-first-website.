package com.alarmhandler.app.ui.challenge

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
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.alarmhandler.app.R
import com.alarmhandler.app.data.model.DismissChallenge
import com.alarmhandler.app.ui.components.Mascot
import com.alarmhandler.app.ui.components.MascotMood
import com.alarmhandler.app.ui.components.PixelButton
import com.alarmhandler.app.ui.components.PixelChip
import com.alarmhandler.app.ui.components.PixelOutlineButton
import com.alarmhandler.app.ui.components.PixelSectionHeader
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.ui.components.PixelTopBar
import com.alarmhandler.app.util.ShakeDetector

/** Picks how hard it should be to switch an alarm off. */
@Composable
fun ChallengePickerScreen(
    current: DismissChallenge,
    currentStrength: Int,
    onBack: () -> Unit,
    onPicked: (DismissChallenge, Int) -> Unit,
) {
    val context = LocalContext.current
    var selected by remember { mutableStateOf(current) }
    var strength by remember { mutableIntStateOf(currentStrength.coerceIn(1, 20)) }

    // A phone with no accelerometer cannot offer the shake challenge at all.
    val shakeAvailable = remember {
        ShakeDetector(context) {}.isAvailable
    }

    Column(
        Modifier
            .fillMaxSize()
            .padding(top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding())
    ) {
        PixelTopBar(title = stringResource(R.string.dismiss_challenge), onBack = onBack)

        Column(
            Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Mascot(
                    mood = MascotMood.ANNOYED,
                    contentDescription = null,
                    modifier = Modifier.size(66.dp, 44.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = "Make me work for it. The harder the challenge, " +
                        "the more awake you'll be.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(12.dp))

            DismissChallenge.entries.forEach { challenge ->
                val unavailable = challenge == DismissChallenge.SHAKE && !shakeAvailable
                ChallengeRow(
                    challenge = challenge,
                    selected = selected == challenge,
                    enabled = !unavailable,
                    unavailableReason = if (unavailable) {
                        "This phone has no motion sensor."
                    } else {
                        null
                    },
                    onClick = { selected = challenge },
                )
            }

            if (selected.usesStrength) {
                Spacer(Modifier.height(8.dp))
                PixelSectionHeader(strengthTitle(selected))
                PixelSurface {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        strengthOptions(selected).forEach { option ->
                            PixelChip(
                                label = "$option",
                                selected = strength == option,
                                onClick = { strength = option },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = strengthSummary(selected, strength),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(16.dp))
            PixelSurface(color = MaterialTheme.colorScheme.surfaceVariant) {
                Text(
                    text = "Safety net",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "On the alarm itself you can set a time after which a plain " +
                        "Dismiss button always appears, so a challenge can never trap you.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(16.dp))
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
                onClick = onBack,
                modifier = Modifier.weight(1f),
            )
            PixelButton(
                text = stringResource(R.string.save),
                onClick = { onPicked(selected, strength) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun ChallengeRow(
    challenge: DismissChallenge,
    selected: Boolean,
    enabled: Boolean,
    unavailableReason: String?,
    onClick: () -> Unit,
) {
    PixelSurface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 5.dp),
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surface
        },
        onClick = if (enabled) onClick else null,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = if (selected) "[x]" else "[ ]",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = challengeTitle(challenge),
                    style = MaterialTheme.typography.titleMedium,
                    color = if (enabled) {
                        MaterialTheme.colorScheme.onSurface
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = unavailableReason ?: challengeDescription(challenge),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun challengeTitle(challenge: DismissChallenge): String = stringResource(
    when (challenge) {
        DismissChallenge.TAP -> R.string.challenge_tap
        DismissChallenge.HOLD -> R.string.challenge_hold
        DismissChallenge.MATH -> R.string.challenge_math
        DismissChallenge.TAP_MASCOT -> R.string.challenge_mascot
        DismissChallenge.MEMORY -> R.string.challenge_memory
        DismissChallenge.SHAKE -> R.string.challenge_shake
    }
)

private fun challengeDescription(challenge: DismissChallenge): String = when (challenge) {
    DismissChallenge.TAP -> "The quickest way out. Good for light sleepers."
    DismissChallenge.HOLD -> "Keeps a half-asleep thumb from stopping the alarm by accident."
    DismissChallenge.MATH -> "One addition, subtraction or multiplication question."
    DismissChallenge.TAP_MASCOT -> "The mascot hops around the screen and has to be caught."
    DismissChallenge.MEMORY -> "Watch a pattern of flashing blocks, then repeat it."
    DismissChallenge.SHAKE -> "Shake the phone until the counter reaches zero."
}

private fun strengthTitle(challenge: DismissChallenge): String = when (challenge) {
    DismissChallenge.TAP_MASCOT -> "How many taps"
    DismissChallenge.SHAKE -> "How many shakes"
    DismissChallenge.MEMORY -> "Pattern length"
    else -> "Difficulty"
}

private fun strengthOptions(challenge: DismissChallenge): List<Int> = when (challenge) {
    DismissChallenge.SHAKE -> listOf(5, 10, 15, 20)
    DismissChallenge.MEMORY -> listOf(3, 4, 5, 6)
    else -> listOf(2, 3, 5, 8)
}

private fun strengthSummary(challenge: DismissChallenge, strength: Int): String =
    when (challenge) {
        DismissChallenge.TAP_MASCOT -> "Catch the mascot $strength times to dismiss."
        DismissChallenge.SHAKE -> "Shake the phone $strength times to dismiss."
        DismissChallenge.MEMORY -> "Repeat a pattern of $strength blocks to dismiss."
        else -> ""
    }
