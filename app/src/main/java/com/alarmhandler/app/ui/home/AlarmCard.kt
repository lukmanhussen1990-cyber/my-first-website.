package com.alarmhandler.app.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.alarmhandler.app.R
import com.alarmhandler.app.alarm.AlarmSchedule
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.util.TimeFormat
import java.time.DayOfWeek

/**
 * One alarm in the list.
 *
 * Swiping right duplicates and swiping left deletes; both are also exposed as
 * accessibility actions, because a swipe gesture is not reachable with a
 * screen reader.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlarmCard(
    row: AlarmRow,
    use24Hour: Boolean,
    weekStart: DayOfWeek,
    onToggle: (Boolean) -> Unit,
    onClick: () -> Unit,
    onDelete: () -> Unit,
    onDuplicate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val duplicateLabel = stringResource(R.string.duplicate)
    val deleteLabel = stringResource(R.string.delete)

    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.StartToEnd -> onDuplicate()
                SwipeToDismissBoxValue.EndToStart -> onDelete()
                SwipeToDismissBoxValue.Settled -> Unit
            }
            // Never let the box settle in a dismissed state: the list itself is
            // the source of truth, so the card snaps back and the data change
            // decides whether it stays on screen.
            false
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        modifier = modifier.semantics {
            customActions = listOf(
                CustomAccessibilityAction(duplicateLabel) { onDuplicate(); true },
                CustomAccessibilityAction(deleteLabel) { onDelete(); true },
            )
        },
        backgroundContent = {
            SwipeBackground(dismissState.dismissDirection, duplicateLabel, deleteLabel)
        },
        content = {
            AlarmCardBody(
                row = row,
                use24Hour = use24Hour,
                weekStart = weekStart,
                onToggle = onToggle,
                onClick = onClick,
            )
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeBackground(
    direction: SwipeToDismissBoxValue,
    duplicateLabel: String,
    deleteLabel: String,
) {
    val (color, text, alignment) = when (direction) {
        SwipeToDismissBoxValue.StartToEnd -> Triple(
            MaterialTheme.colorScheme.secondaryContainer,
            duplicateLabel,
            Alignment.CenterStart,
        )

        SwipeToDismissBoxValue.EndToStart -> Triple(
            MaterialTheme.colorScheme.error,
            deleteLabel,
            Alignment.CenterEnd,
        )

        SwipeToDismissBoxValue.Settled -> Triple(
            MaterialTheme.colorScheme.surfaceVariant,
            "",
            Alignment.Center,
        )
    }
    Box(
        Modifier
            .fillMaxSize()
            .background(color)
            .padding(horizontal = 24.dp),
        contentAlignment = alignment,
    ) {
        if (text.isNotEmpty()) {
            Text(
                text = text.uppercase(),
                style = MaterialTheme.typography.labelLarge,
                color = if (direction == SwipeToDismissBoxValue.EndToStart) {
                    MaterialTheme.colorScheme.onError
                } else {
                    MaterialTheme.colorScheme.onSecondaryContainer
                },
            )
        }
    }
}

@Composable
private fun AlarmCardBody(
    row: AlarmRow,
    use24Hour: Boolean,
    weekStart: DayOfWeek,
    onToggle: (Boolean) -> Unit,
    onClick: () -> Unit,
) {
    val alarm = row.alarm
    val enabled = alarm.enabled
    val contentColor = if (enabled) {
        MaterialTheme.colorScheme.onSurface
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }

    PixelSurface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        contentPadding = PaddingValues(16.dp),
        onClick = onClick,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(
                        text = TimeFormat.time(alarm.hour, alarm.minute, use24Hour),
                        style = MaterialTheme.typography.displayMedium,
                        color = contentColor,
                    )
                    val suffix = TimeFormat.meridiem(alarm.hour, use24Hour)
                    if (suffix.isNotEmpty()) {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = suffix,
                            style = MaterialTheme.typography.titleMedium,
                            color = contentColor,
                            modifier = Modifier.padding(bottom = 6.dp),
                        )
                    }
                }
                if (alarm.label.isNotBlank()) {
                    Text(
                        text = alarm.label,
                        style = MaterialTheme.typography.bodyLarge,
                        color = contentColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(Modifier.height(2.dp))
                Text(
                    text = TimeFormat.repeatSummary(alarm, weekStart),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                // Enabled state is stated in words as well as by the switch.
                Text(
                    text = when {
                        !enabled -> "Off"
                        row.nextTriggerMillis != null ->
                            "On · rings in " +
                                AlarmSchedule.formatCountdown(
                                    row.nextTriggerMillis - System.currentTimeMillis()
                                )

                        else -> "On"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.width(12.dp))

            Switch(
                checked = enabled,
                onCheckedChange = onToggle,
                modifier = Modifier.semantics {
                    contentDescription = if (enabled) "Alarm on" else "Alarm off"
                },
                colors = SwitchDefaults.colors(
                    checkedThumbColor = MaterialTheme.colorScheme.onPrimary,
                    checkedTrackColor = MaterialTheme.colorScheme.primary,
                    checkedBorderColor = MaterialTheme.colorScheme.outline,
                    uncheckedThumbColor = MaterialTheme.colorScheme.outline,
                    uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant,
                    uncheckedBorderColor = MaterialTheme.colorScheme.outline,
                ),
            )
        }

        // A repeat strip that reads at a glance without relying on colour.
        if (alarm.isRepeating) {
            Spacer(Modifier.height(12.dp))
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.clearAndSetSemantics { },
            ) {
                TimeFormat.orderedWeek(weekStart).forEach { day ->
                    val on = alarm.isRepeatingOn(day)
                    Box(
                        Modifier
                            .size(26.dp)
                            .background(
                                if (on) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.surfaceVariant
                                }
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = TimeFormat.dayInitial(day),
                            style = MaterialTheme.typography.labelMedium,
                            color = if (on) {
                                MaterialTheme.colorScheme.onPrimary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                        )
                    }
                }
            }
        }
    }
}
