package com.alarmhandler.app.ui.edit

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.alarmhandler.app.ui.components.PixelChip
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.util.TimeFormat

/**
 * The blocky time picker.
 *
 * Steppers rather than a dial: they hit 48dp tap targets easily, they read
 * correctly to a screen reader, and they suit the pixel style. Every control
 * wraps, so there is no way to reach an invalid time.
 */
@Composable
fun TimePickerBlock(
    hour: Int,
    minute: Int,
    use24Hour: Boolean,
    onNudgeHour: (Int) -> Unit,
    onNudgeMinute: (Int) -> Unit,
    onToggleMeridiem: () -> Unit,
    onSetTime: (Int, Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val display = TimeFormat.time(hour, minute, use24Hour)
    val meridiem = TimeFormat.meridiem(hour, use24Hour)

    PixelSurface(
        modifier = modifier,
        contentPadding = PaddingValues(vertical = 20.dp, horizontal = 16.dp),
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .semantics {
                    contentDescription = "Alarm time, " +
                        TimeFormat.timeWithMeridiem(hour, minute, use24Hour)
                },
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = display,
                style = MaterialTheme.typography.displayLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (meridiem.isNotEmpty()) {
                Spacer(Modifier.width(10.dp))
                Column {
                    PixelChip(
                        label = "AM",
                        selected = meridiem == "AM",
                        onClick = { if (meridiem != "AM") onToggleMeridiem() },
                        modifier = Modifier.width(64.dp),
                    )
                    Spacer(Modifier.height(6.dp))
                    PixelChip(
                        label = "PM",
                        selected = meridiem == "PM",
                        onClick = { if (meridiem != "PM") onToggleMeridiem() },
                        modifier = Modifier.width(64.dp),
                    )
                }
            }
        }

        Spacer(Modifier.height(18.dp))

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            StepperColumn(
                title = "Hour",
                onUp = { onNudgeHour(1) },
                onDown = { onNudgeHour(-1) },
                modifier = Modifier.weight(1f),
            )
            StepperColumn(
                title = "Minute",
                onUp = { onNudgeMinute(1) },
                onDown = { onNudgeMinute(-1) },
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(Modifier.height(12.dp))

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(-15, -5, 5, 15).forEach { delta ->
                PixelChip(
                    label = if (delta > 0) "+$delta" else "$delta",
                    selected = false,
                    onClick = { onNudgeMinute(delta) },
                    modifier = Modifier
                        .weight(1f)
                        .semantics {
                            contentDescription = if (delta > 0) {
                                "Add $delta minutes"
                            } else {
                                "Subtract ${-delta} minutes"
                            }
                        },
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(6 to 0, 7 to 0, 8 to 0, 9 to 0).forEach { (h, m) ->
                PixelChip(
                    label = TimeFormat.timeWithMeridiem(h, m, use24Hour),
                    selected = hour == h && minute == m,
                    onClick = { onSetTime(h, m) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun StepperColumn(
    title: String,
    onUp: () -> Unit,
    onDown: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = title.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PixelChip(
                label = "−",
                selected = false,
                onClick = onDown,
                modifier = Modifier
                    .weight(1f)
                    .size(56.dp)
                    .semantics { contentDescription = "$title down" },
            )
            PixelChip(
                label = "+",
                selected = false,
                onClick = onUp,
                modifier = Modifier
                    .weight(1f)
                    .size(56.dp)
                    .semantics { contentDescription = "$title up" },
            )
        }
    }
}
