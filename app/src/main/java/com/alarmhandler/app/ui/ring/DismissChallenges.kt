package com.alarmhandler.app.ui.ring

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.alarmhandler.app.ui.components.Mascot
import com.alarmhandler.app.ui.components.MascotMood
import com.alarmhandler.app.ui.components.PixelButton
import com.alarmhandler.app.ui.components.PixelChip
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.util.ShakeDetector
import kotlinx.coroutines.delay
import kotlin.math.roundToInt
import kotlin.random.Random

/**
 * The dismiss challenges.
 *
 * Each one is a self-contained composable that calls [onSolved] exactly once.
 * None of them can be passed by accident: every one needs a deliberate action,
 * and every one shows its own progress so the user is never guessing.
 */

@Composable
fun HoldToDismissChallenge(onSolved: () -> Unit, modifier: Modifier = Modifier) {
    var holding by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf(0f) }
    val solved = rememberUpdatedState(onSolved)

    LaunchedEffect(holding) {
        if (!holding) {
            progress = 0f
            return@LaunchedEffect
        }
        val start = System.currentTimeMillis()
        while (holding && progress < 1f) {
            progress = ((System.currentTimeMillis() - start) / HOLD_MS.toFloat()).coerceIn(0f, 1f)
            if (progress >= 1f) {
                solved.value()
                return@LaunchedEffect
            }
            delay(16)
        }
    }

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = if (holding) "Keep holding…" else "Hold the button for 3 seconds",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Spacer(Modifier.height(10.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .height(72.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .pointerInput(Unit) {
                    detectTapGestures(
                        onPress = {
                            holding = true
                            tryAwaitRelease()
                            holding = false
                        }
                    )
                },
            contentAlignment = Alignment.Center,
        ) {
            Box(
                Modifier
                    .fillMaxWidth(progress)
                    .height(72.dp)
                    .background(MaterialTheme.colorScheme.primary)
            )
            Text(
                text = "HOLD TO DISMISS  ${(progress * 100).roundToInt()}%",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}

@Composable
fun MathChallenge(onSolved: () -> Unit, modifier: Modifier = Modifier) {
    var round by remember { mutableIntStateOf(0) }
    val question = remember(round) { MathQuestion.random() }
    var wrong by remember { mutableStateOf(false) }

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = question.text,
            style = MaterialTheme.typography.displayMedium,
            color = MaterialTheme.colorScheme.onBackground,
        )
        if (wrong) {
            Spacer(Modifier.height(6.dp))
            Text(
                text = "Not quite — here's another one.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        Spacer(Modifier.height(14.dp))
        // Four large answer buttons: typing is hopeless half asleep.
        question.options.chunked(2).forEach { pair ->
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                pair.forEach { option ->
                    PixelButton(
                        text = "$option",
                        onClick = {
                            if (option == question.answer) {
                                onSolved()
                            } else {
                                wrong = true
                                round++
                            }
                        },
                        modifier = Modifier.weight(1f),
                        minHeight = 64,
                        containerColor = MaterialTheme.colorScheme.surface,
                        contentColor = MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
        }
    }
}

private data class MathQuestion(
    val text: String,
    val answer: Int,
    val options: List<Int>,
) {
    companion object {
        fun random(): MathQuestion {
            val a = Random.nextInt(3, 13)
            val b = Random.nextInt(2, 10)
            val (text, answer) = when (Random.nextInt(3)) {
                0 -> "$a + ${b + 7}" to a + b + 7
                1 -> "${a + b + 5} − $b" to a + 5
                else -> "$a × $b" to a * b
            }
            val wrongOnes = generateSequence {
                answer + Random.nextInt(-12, 13)
            }.filter { it != answer && it > 0 }.distinct().take(3).toList()
            return MathQuestion(text, answer, (wrongOnes + answer).shuffled())
        }
    }
}

@Composable
fun TapMascotChallenge(
    required: Int,
    onSolved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var caught by remember { mutableIntStateOf(0) }
    var slot by remember { mutableIntStateOf(0) }

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "Catch me! ${required - caught} to go",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Spacer(Modifier.height(10.dp))
        BoxWithConstraints(
            Modifier
                .fillMaxWidth()
                .height(220.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            // The mascot moves between fixed slots rather than free positions,
            // so it can never land half off screen on a narrow phone.
            val columns = 3
            val rows = 3
            val cellW = maxWidth / columns
            val cellH = maxHeight / rows
            val col = slot % columns
            val row = (slot / columns) % rows
            val x by animateFloatAsState(
                targetValue = (cellW * col).value,
                animationSpec = tween(220),
                label = "x",
            )
            val y by animateFloatAsState(
                targetValue = (cellH * row).value,
                animationSpec = tween(220),
                label = "y",
            )
            Box(
                Modifier
                    .offset(x = x.dp, y = y.dp)
                    .size(cellW, cellH)
                    .pointerInput(caught) {
                        detectTapGestures {
                            caught++
                            slot = (slot + 1 + Random.nextInt(1, 8)) % 9
                            if (caught >= required) onSolved()
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Mascot(
                    mood = MascotMood.JUMPING,
                    contentDescription = "Tap the mascot, ${required - caught} taps remaining",
                    modifier = Modifier.size(cellW * 0.9f, cellH * 0.7f),
                )
            }
        }
    }
}

@Composable
fun MemoryChallenge(
    length: Int,
    onSolved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val pattern = remember(length) { List(length) { Random.nextInt(4) } }
    val entered = remember { mutableStateListOf<Int>() }
    var showingIndex by remember { mutableIntStateOf(-1) }
    var showing by remember { mutableStateOf(true) }
    var attempt by remember { mutableIntStateOf(0) }

    LaunchedEffect(attempt) {
        showing = true
        entered.clear()
        delay(400)
        pattern.forEachIndexed { index, _ ->
            showingIndex = index
            delay(520)
            showingIndex = -1
            delay(180)
        }
        showing = false
    }

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = if (showing) "Watch the pattern" else "Now repeat it (${entered.size}/$length)",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(14.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            repeat(4) { index ->
                val lit = showing && showingIndex >= 0 && pattern[showingIndex] == index
                Box(
                    Modifier
                        .weight(1f)
                        .height(96.dp)
                        .background(
                            if (lit) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.surfaceVariant
                            }
                        )
                        .pointerInput(showing, entered.size) {
                            detectTapGestures {
                                if (showing) return@detectTapGestures
                                entered.add(index)
                                val position = entered.size - 1
                                if (pattern[position] != index) {
                                    // Wrong step: replay from the beginning.
                                    attempt++
                                } else if (entered.size == pattern.size) {
                                    onSolved()
                                }
                            }
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "${index + 1}",
                        style = MaterialTheme.typography.headlineMedium,
                        color = if (lit) {
                            MaterialTheme.colorScheme.onPrimary
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(
            text = "Get one wrong and the pattern plays again.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
fun ShakeChallenge(
    required: Int,
    onSolved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var count by remember { mutableIntStateOf(0) }
    val solved = rememberUpdatedState(onSolved)

    val detector = remember {
        ShakeDetector(context) {
            count++
        }
    }

    LaunchedEffect(count) {
        if (count >= required) solved.value()
    }

    DisposableEffect(detector) {
        detector.start()
        onDispose { detector.stop() }
    }

    Column(modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "Shake the phone",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "${(required - count).coerceAtLeast(0)}",
            style = MaterialTheme.typography.displayLarge,
            color = MaterialTheme.colorScheme.primary,
        )
        if (!detector.isAvailable) {
            Spacer(Modifier.height(8.dp))
            PixelSurface(color = MaterialTheme.colorScheme.surfaceVariant) {
                Text(
                    text = "This phone has no motion sensor, so use the button below.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(8.dp))
            // Never leave the user trapped on hardware that cannot pass.
            PixelChip(
                label = "Count a shake",
                selected = false,
                onClick = { count++ },
            )
        }
    }
}

private const val HOLD_MS = 3000L
