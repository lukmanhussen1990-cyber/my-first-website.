package com.runova.app.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.withInfiniteAnimationFrameNanos
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.SplashScene
import com.runova.app.ui.components.circleGlow
import com.runova.app.ui.theme.Runova
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.max

private const val MIN_VISIBLE_MS = 1_400L

/**
 * Animated splash: painted sunset scene with a running figure, the glowing RUNOVA mark and a
 * loading bar. Calls [onFinished] once the intro has played (about 2.4 s).
 */
@Composable
fun SplashScreen(onFinished: () -> Unit, modifier: Modifier = Modifier, fixedTime: Float? = null) {
    val c = Runova.colors
    var time by remember { mutableFloatStateOf(fixedTime ?: 0f) }
    val logo = remember { Animatable(if (fixedTime != null) 1f else 0f) }
    val word = remember { Animatable(if (fixedTime != null) 1f else 0f) }
    val tagline = remember { Animatable(if (fixedTime != null) 1f else 0f) }
    val bar = remember { Animatable(if (fixedTime != null) 0.66f else 0f) }
    LaunchedEffect(fixedTime) {
        if (fixedTime != null) return@LaunchedEffect
        val shownAt = withFrameNanos { it }
        launch {
            while (true) {
                val now = withInfiniteAnimationFrameNanos { it }
                time = (now - shownAt) / 1_000_000_000f
            }
        }
        launch { logo.animateTo(1f, spring(dampingRatio = 0.55f, stiffness = 170f)) }
        launch { delay(260); word.animateTo(1f, tween(650, easing = FastOutSlowInEasing)) }
        launch { delay(560); tagline.animateTo(1f, tween(600)) }
        bar.animateTo(1f, tween(2300, easing = FastOutSlowInEasing))
        // With system animations turned off the tweens end at once; still show the brand briefly.
        val shownMs = (withFrameNanos { it } - shownAt) / 1_000_000
        delay(max(150L, MIN_VISIBLE_MS - shownMs))
        onFinished()
    }
    Box(modifier.fillMaxSize().background(Color(0xFF060B0E))) {
        SplashScene(time, Modifier.fillMaxSize())
        Column(
            Modifier.fillMaxWidth().statusBarsPadding().padding(top = 70.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                Modifier
                    .size(118.dp)
                    .graphicsLayer {
                        val s = 0.55f + 0.45f * logo.value
                        scaleX = s; scaleY = s; alpha = logo.value.coerceIn(0f, 1f)
                        translationX = (1f - logo.value) * -60f
                    }
                    .circleGlow(c.lime.copy(alpha = 0.5f), 34.dp, 0.07f),
                contentAlignment = Alignment.Center,
            ) {
                GradientIcon(RunovaIcons.Sprinter, Brush.verticalGradient(listOf(Color(0xFFE6FF7A), c.lime, Color(0xFF9BE22E))), Modifier.size(112.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text(
                "RUNOVA",
                style = Runova.type.titleXL.copy(
                    fontSize = 58.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.06.em,
                    shadow = Shadow(color = c.lime.copy(alpha = 0.55f), blurRadius = 28f),
                ),
                color = Color(0xFFE9FFB0),
                modifier = Modifier.graphicsLayer { alpha = word.value; translationY = (1f - word.value) * 40f },
            )
            Text(
                "Run. Burn. Level Up.",
                style = Runova.type.body.copy(fontSize = 19.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.02.em),
                color = Color(0xFFF1F4E8).copy(alpha = 0.92f),
                modifier = Modifier.graphicsLayer { alpha = tagline.value; translationY = (1f - tagline.value) * 20f },
            )
        }
        Column(
            Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().padding(bottom = 44.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                Modifier
                    .fillMaxWidth(0.62f)
                    .height(7.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.22f)),
            ) {
                Box(
                    Modifier
                        .fillMaxWidth(bar.value.coerceIn(0.02f, 1f))
                        .height(7.dp)
                        .clip(CircleShape)
                        .background(Brush.horizontalGradient(listOf(Color(0xFF9BE22E), c.lime))),
                )
            }
            Spacer(Modifier.height(26.dp))
            Text(
                "A Healthier You\nStarts Today",
                style = Runova.type.titleM.copy(fontSize = 24.sp, fontWeight = FontWeight.Medium, lineHeight = 31.sp),
                color = Color.White.copy(alpha = 0.95f),
                textAlign = TextAlign.Center,
                modifier = Modifier.graphicsLayer { alpha = tagline.value },
            )
        }
    }
}
