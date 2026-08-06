package com.alarmhandler.app.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.alarmhandler.app.ui.theme.LocalPixelStyle

/**
 * Shared building blocks for the blocky look: a hard offset shadow, a solid
 * border and square corners, all of which soften automatically when the user
 * turns the pixel theme off.
 */

/** A panel with a solid border and a hard offset shadow behind it. */
@Composable
fun PixelSurface(
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.surface,
    borderColor: Color = MaterialTheme.colorScheme.outline,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    onClick: (() -> Unit)? = null,
    shadow: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    val style = LocalPixelStyle.current
    val shape: Shape = style.shape
    val offset = if (shadow) style.shadowOffset else 0.dp

    Box(modifier) {
        if (offset > 0.dp) {
            Box(
                Modifier
                    .matchParentSize()
                    .offset(x = offset, y = offset)
                    .background(borderColor, shape)
            )
        }
        Column(
            Modifier
                .fillMaxWidth()
                .background(color, shape)
                .border(BorderStroke(style.borderWidth, borderColor), shape)
                .then(
                    if (onClick != null) {
                        Modifier.clickable(role = Role.Button, onClick = onClick)
                    } else {
                        Modifier
                    }
                )
                .padding(contentPadding),
            content = content,
        )
    }
}

/** The primary blocky button: large tap target, hard shadow, press travel. */
@Composable
fun PixelButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    containerColor: Color = MaterialTheme.colorScheme.primary,
    contentColor: Color = MaterialTheme.colorScheme.onPrimary,
    borderColor: Color = MaterialTheme.colorScheme.outline,
    icon: ImageVector? = null,
    minHeight: Int = 60,
) {
    val style = LocalPixelStyle.current
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val travel by animateFloatAsState(
        targetValue = if (pressed && enabled) 1f else 0f,
        label = "press",
    )
    val shadow = style.shadowOffset
    val shape = style.shape
    val shift = shadow * travel

    val container = if (enabled) containerColor else containerColor.copy(alpha = 0.35f)
    val content = if (enabled) contentColor else contentColor.copy(alpha = 0.6f)

    Box(modifier.heightIn(min = (minHeight + 4).dp)) {
        if (shadow > 0.dp) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = minHeight.dp)
                    .offset(x = shadow, y = shadow)
                    .background(borderColor, shape)
            )
        }
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = minHeight.dp)
                .offset(x = shift, y = shift)
                .background(container, shape)
                .border(BorderStroke(style.borderWidth, borderColor), shape)
                .clickable(
                    interactionSource = interaction,
                    indication = null,
                    enabled = enabled,
                    role = Role.Button,
                    onClick = onClick,
                )
                .padding(horizontal = 20.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (icon != null) {
                Icon(icon, contentDescription = null, tint = content, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
            }
            Text(
                text = text,
                color = content,
                style = MaterialTheme.typography.labelLarge,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** A quieter button for secondary actions. */
@Composable
fun PixelOutlineButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
) {
    PixelButton(
        text = text,
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.onSurface,
        icon = icon,
        minHeight = 52,
    )
}

/** A selectable chip used for repeat days, snooze lengths and similar. */
@Composable
fun PixelChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    stateDescription: String? = null,
) {
    val style = LocalPixelStyle.current
    val shape = if (style.pixelArt) RectangleShape else RoundedCornerShape(999.dp)
    val container = if (selected) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.surface
    }
    val content = if (selected) {
        MaterialTheme.colorScheme.onPrimary
    } else {
        MaterialTheme.colorScheme.onSurface
    }
    Box(
        modifier
            .defaultMinSize(minWidth = 48.dp, minHeight = 48.dp)
            .background(container, shape)
            .border(
                BorderStroke(
                    if (selected) style.borderWidth else 1.dp,
                    MaterialTheme.colorScheme.outline,
                ),
                shape,
            )
            .clickable(enabled = enabled, role = Role.Checkbox, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Selection is never signalled by colour alone.
            if (selected) {
                Text(
                    "■ ",
                    color = content,
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            Text(
                text = label,
                color = content,
                style = MaterialTheme.typography.labelMedium,
                textAlign = TextAlign.Center,
            )
        }
    }
}

/** Section heading used throughout the settings-style screens. */
@Composable
fun PixelSectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier.padding(start = 4.dp, top = 8.dp, bottom = 6.dp),
    )
}

/** A one-pixel-tall rule, drawn as a solid block rather than a hairline. */
@Composable
fun PixelDivider(modifier: Modifier = Modifier) {
    Box(
        modifier
            .fillMaxWidth()
            .height(2.dp)
            .background(MaterialTheme.colorScheme.outlineVariant)
    )
}

/** Wraps content in the app's body text style with a guaranteed contrast. */
@Composable
fun BodyText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
) {
    CompositionLocalProvider(LocalContentColor provides color) {
        ProvideTextStyle(MaterialTheme.typography.bodyMedium) {
            Text(text = text, color = color, modifier = modifier)
        }
    }
}
