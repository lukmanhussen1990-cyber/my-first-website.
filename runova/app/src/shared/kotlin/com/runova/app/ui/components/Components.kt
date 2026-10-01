package com.runova.app.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.TrackChanges
import androidx.compose.material.icons.rounded.BarChart
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.TrackChanges
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.runova.app.ui.theme.Runova
import kotlin.math.min

// ---------------------------------------------------------------------------------------- glow

/**
 * Soft neon halo drawn behind rounded shapes. Built from stacked translucent layers so it works
 * identically on every Android version (no RenderEffect needed).
 */
fun Modifier.neonGlow(
    color: Color,
    radius: Dp = 18.dp,
    cornerRadius: Dp = 999.dp,
    alpha: Float = 0.35f,
): Modifier = if (alpha <= 0f) this else drawBehind {
    val r = radius.toPx()
    val baseCorner = min(cornerRadius.toPx(), size.minDimension / 2f)
    val steps = 14
    for (i in steps downTo 1) {
        val f = i / steps.toFloat()
        val spread = r * f * f
        drawRoundRect(
            color = color.copy(alpha = alpha * 1.8f / steps),
            topLeft = Offset(-spread, -spread),
            size = Size(size.width + spread * 2, size.height + spread * 2),
            cornerRadius = CornerRadius(baseCorner + spread),
        )
    }
}

/** Circular glow using a radial gradient (smooth, cheap). */
fun Modifier.circleGlow(color: Color, radius: Dp = 22.dp, alpha: Float = 0.45f): Modifier = if (alpha <= 0f) this else drawBehind {
    val outer = size.minDimension / 2f + radius.toPx()
    val inner = size.minDimension / 2f
    drawCircle(
        brush = Brush.radialGradient(
            0f to color.copy(alpha = alpha),
            (inner / outer) to color.copy(alpha = alpha * 0.8f),
            1f to Color.Transparent,
            center = center,
            radius = outer,
        ),
        radius = outer,
    )
}

// ---------------------------------------------------------------------------------------- basics

@Composable
fun RunovaCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    shape: Shape = RoundedCornerShape(20.dp),
    color: Color = Runova.colors.surface,
    border: Color? = Runova.colors.border,
    borderWidth: Dp = 1.dp,
    content: @Composable BoxScope.() -> Unit,
) {
    var m = modifier.clip(shape).background(color)
    if (border != null) m = m.border(borderWidth, border, shape)
    if (onClick != null) m = m.clickable(onClick = onClick)
    Box(m, content = content)
}

@Composable
fun LimeButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    height: Dp = 58.dp,
    glow: Boolean = true,
    textStyle: TextStyle = Runova.type.button,
) {
    val c = Runova.colors
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed) 0.96f else 1f, spring(stiffness = Spring.StiffnessMediumLow))
    val fill = if (enabled) c.lime else c.surfaceHigh
    Box(
        modifier
            .graphicsLayer { scaleX = scale; scaleY = scale }
            .neonGlow(c.lime, radius = 22.dp, alpha = if (enabled && glow && c.isDark) 0.26f else 0f)
            .height(height)
            .clip(CircleShape)
            .background(Brush.verticalGradient(listOf(lerp(fill, Color.White, 0.06f), fill, lerp(fill, c.limeDeep, if (enabled) 0.12f else 0f))))
            .clickable(interactionSource = interaction, indication = LocalIndication.current, enabled = enabled, role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            val tint = if (enabled) c.onLime else c.textTertiary
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(10.dp))
            }
            Text(text, style = textStyle, color = tint)
        }
    }
}

@Composable
fun GhostButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, color: Color = Runova.colors.textPrimary, icon: ImageVector? = null, height: Dp = 54.dp) {
    val c = Runova.colors
    Box(
        modifier
            .height(height)
            .clip(CircleShape)
            .background(c.surfaceHigh)
            .border(1.dp, c.border, CircleShape)
            .clickable(role = Role.Button, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                Icon(icon, null, tint = color, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(text, style = Runova.type.titleS, color = color)
        }
    }
}

@Composable
fun CircleIconButton(
    icon: ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    iconSize: Dp = 24.dp,
    background: Color = Color.Transparent,
    tint: Color = Runova.colors.textPrimary,
    enabled: Boolean = true,
) {
    Box(
        modifier
            .size(size)
            .clip(CircleShape)
            .background(background)
            .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
            .semantics { this.contentDescription = contentDescription },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = null, tint = if (enabled) tint else tint.copy(alpha = 0.4f), modifier = Modifier.size(iconSize))
    }
}

/** Icon filled with a gradient (used for flames, badge glyphs, ...). */
@Composable
fun GradientIcon(icon: ImageVector, brush: Brush, modifier: Modifier = Modifier) {
    val painter = rememberVectorPainter(icon)
    Box(
        modifier
            .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
            .drawWithContent {
                with(painter) { draw(size) }
                drawRect(brush, blendMode = BlendMode.SrcIn)
            },
    )
}

val FlameBrush: Brush
    get() = Brush.verticalGradient(listOf(Color(0xFFFFB23D), Color(0xFFFF6A21), Color(0xFFE8391F)))

@Composable
fun ScreenTopBar(
    title: String,
    onBack: (() -> Unit)?,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Box(modifier.fillMaxWidth().height(56.dp).padding(horizontal = 8.dp)) {
        if (onBack != null) {
            CircleIconButton(
                Icons.Rounded.ChevronLeft,
                contentDescription = "Back",
                onClick = onBack,
                iconSize = 32.dp,
                modifier = Modifier.align(Alignment.CenterStart),
            )
        }
        Text(
            title,
            style = Runova.type.titleM,
            color = Runova.colors.textPrimary,
            modifier = Modifier.align(Alignment.Center).padding(horizontal = 56.dp),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Row(Modifier.align(Alignment.CenterEnd), verticalAlignment = Alignment.CenterVertically, content = actions)
    }
}

// ---------------------------------------------------------------------------------------- tabs

/** Pill-shaped segmented control with a sliding lime indicator (Daily / Weekly / Monthly). */
@Composable
fun SegmentedTabs(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val c = Runova.colors
    BoxWithConstraints(
        modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(CircleShape)
            .background(c.surface)
            .border(1.dp, c.border, CircleShape)
            .padding(5.dp),
    ) {
        val w = maxWidth / options.size
        val x by animateDpAsState(w * selected, spring(dampingRatio = 0.78f, stiffness = 420f))
        Box(
            Modifier
                .offset { IntOffset(x.roundToPx(), 0) }
                .width(w)
                .fillMaxHeight()
                .neonGlow(c.lime, radius = 14.dp, alpha = if (c.isDark) 0.22f else 0f)
                .clip(CircleShape)
                .background(c.lime),
        )
        Row(Modifier.fillMaxSize()) {
            options.forEachIndexed { i, label ->
                val color by animateColorAsState(if (i == selected) c.onLime else c.textSecondary)
                Box(
                    Modifier
                        .weight(1f)
                        .fillMaxHeight()
                        .clip(CircleShape)
                        .clickable(role = Role.Tab) { onSelect(i) },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(label, style = Runova.type.titleS, color = color)
                }
            }
        }
    }
}

/** Text tabs with a glowing underline (Map / Splits / Stats / Charts). */
@Composable
fun UnderlineTabs(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Row(
        modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(c.surface)
            .border(1.dp, c.border, RoundedCornerShape(22.dp))
            .padding(horizontal = 6.dp),
    ) {
        options.forEachIndexed { i, label ->
            val active = i == selected
            val color by animateColorAsState(if (active) c.accent else c.textSecondary)
            val bar by animateFloatAsState(if (active) 1f else 0f, tween(260))
            Box(
                Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clickable(role = Role.Tab) { onSelect(i) }
                    .drawBehind {
                        if (bar > 0f) {
                            val w = 30.dp.toPx() * bar
                            val h = 3.5.dp.toPx()
                            val top = size.height - 9.dp.toPx()
                            drawCircle(
                                Brush.radialGradient(
                                    listOf(c.lime.copy(alpha = 0.18f * bar), Color.Transparent),
                                    center = Offset(size.width / 2, size.height / 2),
                                    radius = size.width * 0.55f,
                                ),
                                radius = size.width * 0.55f,
                                center = Offset(size.width / 2, size.height / 2),
                            )
                            drawRoundRect(
                                c.lime.copy(alpha = bar),
                                topLeft = Offset((size.width - w) / 2, top),
                                size = Size(w, h),
                                cornerRadius = CornerRadius(h / 2),
                            )
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = Runova.type.titleS, color = color, modifier = Modifier.padding(bottom = 4.dp))
            }
        }
    }
}

// ---------------------------------------------------------------------------------------- bottom bar

enum class MainTab { HOME, ACTIVITY, STATS, GOALS, PROFILE }

@Composable
fun RunovaBottomBar(selected: MainTab?, onSelect: (MainTab) -> Unit, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Box(
        modifier
            .fillMaxWidth()
            .background(Brush.verticalGradient(listOf(c.navBar.copy(alpha = 0.0f), c.navBar.copy(alpha = 0.96f), c.navBar), endY = 60f))
            .navigationBarsPadding(),
    ) {
        Row(
            Modifier.fillMaxWidth().height(78.dp).padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceAround,
        ) {
            NavItem("Home", Icons.Outlined.Home, Icons.Rounded.Home, selected == MainTab.HOME) { onSelect(MainTab.HOME) }
            NavItem("Activity", RunovaIcons.Sneaker, RunovaIcons.Sneaker, selected == MainTab.ACTIVITY) { onSelect(MainTab.ACTIVITY) }
            val statsActive = selected == MainTab.STATS
            Box(
                Modifier
                    .size(60.dp)
                    .circleGlow(c.lime, 12.dp, if (statsActive && c.isDark) 0.28f else 0f)
                    .clip(CircleShape)
                    .background(if (statsActive) c.lime else c.surfaceHigh)
                    .clickable(role = Role.Tab) { onSelect(MainTab.STATS) }
                    .semantics { contentDescription = "Statistics" },
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Rounded.BarChart, contentDescription = null, tint = if (statsActive) c.onLime else c.accent, modifier = Modifier.size(30.dp))
            }
            NavItem("Goals", Icons.Outlined.TrackChanges, Icons.Rounded.TrackChanges, selected == MainTab.GOALS) { onSelect(MainTab.GOALS) }
            NavItem("Profile", Icons.Outlined.Person, Icons.Rounded.Person, selected == MainTab.PROFILE) { onSelect(MainTab.PROFILE) }
        }
    }
}

@Composable
private fun NavItem(label: String, icon: ImageVector, activeIcon: ImageVector, active: Boolean, onClick: () -> Unit) {
    val c = Runova.colors
    val color by animateColorAsState(if (active) c.accent else c.textSecondary)
    val lift by animateFloatAsState(if (active) 1f else 0f, spring(dampingRatio = 0.6f))
    Column(
        Modifier
            .width(64.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(role = Role.Tab, onClick = onClick)
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            if (active) activeIcon else icon,
            contentDescription = null,
            tint = color,
            modifier = Modifier.size(27.dp).graphicsLayer { translationY = -3f * lift; scaleX = 1f + 0.06f * lift; scaleY = 1f + 0.06f * lift },
        )
        Spacer(Modifier.height(4.dp))
        Text(label, style = Runova.type.caption, color = color)
    }
}

// ---------------------------------------------------------------------------------------- metrics

@Composable
fun StatTile(icon: ImageVector, value: String, label: String, modifier: Modifier = Modifier, iconTint: Color = Runova.colors.accent) {
    RunovaCard(modifier) {
        Column(
            Modifier.fillMaxWidth().padding(vertical = 13.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(29.dp))
            Spacer(Modifier.height(8.dp))
            Text(value, style = Runova.type.tileValue, color = Runova.colors.textPrimary, maxLines = 1)
            Spacer(Modifier.height(2.dp))
            Text(label, style = Runova.type.label, color = Runova.colors.textSecondary, maxLines = 1)
        }
    }
}

@Composable
fun LimeProgressBar(progress: Float, modifier: Modifier = Modifier, height: Dp = 10.dp, animate: Boolean = true) {
    val c = Runova.colors
    val anim = remember { Animatable(if (animate) 0f else progress) }
    LaunchedEffect(progress) { anim.animateTo(progress.coerceIn(0f, 1f), tween(1200, easing = FastOutSlowInEasing)) }
    Box(
        modifier
            .fillMaxWidth()
            .height(height)
            .clip(CircleShape)
            .background(c.track),
    ) {
        if (anim.value > 0.001f) {
            Box(
                Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(anim.value)
                    .clip(CircleShape)
                    .background(Brush.horizontalGradient(listOf(c.limeDeep, c.lime))),
            )
        }
    }
}

/** Animates a number from 0 (or its previous value) to [target]. */
@Composable
fun animatedNumber(target: Double, durationMs: Int = 1100): Double {
    val anim = remember { Animatable(0f) }
    LaunchedEffect(target) { anim.animateTo(target.toFloat(), tween(durationMs, easing = FastOutSlowInEasing)) }
    return anim.value.toDouble()
}

@Composable
fun SettingsRow(
    icon: ImageVector,
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    iconTint: Color = Runova.colors.textPrimary,
    subtitle: String? = null,
    value: String? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val c = Runova.colors
    Row(
        modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(26.dp))
        Spacer(Modifier.width(18.dp))
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            Text(title, style = Runova.type.body, color = c.textPrimary)
            if (subtitle != null) {
                Spacer(Modifier.width(5.dp))
                Text(subtitle, style = Runova.type.body, color = c.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (value != null) {
            Text(value, style = Runova.type.body, color = c.textSecondary, textAlign = TextAlign.End)
            Spacer(Modifier.width(6.dp))
        }
        if (trailing != null) trailing() else Icon(Icons.Rounded.ChevronRight, null, tint = c.textSecondary, modifier = Modifier.size(24.dp))
    }
}

@Composable
fun HairlineDivider(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(Runova.colors.divider))
}
