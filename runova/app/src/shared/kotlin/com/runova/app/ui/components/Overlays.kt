package com.runova.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.runova.app.ui.theme.Runova

/** Platform hook for the system back gesture (Android provides BackHandler, desktop does nothing). */
val LocalBackHandler = staticCompositionLocalOf<@Composable (enabled: Boolean, onBack: () -> Unit) -> Unit> { { _, _ -> } }

@Composable
fun PlatformBackHandler(enabled: Boolean = true, onBack: () -> Unit) {
    LocalBackHandler.current(enabled, onBack)
}

private fun Modifier.consumeClicks(): Modifier = this.clickable(
    interactionSource = MutableInteractionSource(),
    indication = null,
    onClick = {},
)

/** Modal bottom sheet in the RUNOVA style (scrim, rounded top, slides up). */
@Composable
fun RunovaSheet(visible: Boolean, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val c = Runova.colors
    PlatformBackHandler(enabled = visible, onBack = onDismiss)
    AnimatedVisibility(visible, enter = fadeIn(tween(220)), exit = fadeOut(tween(220))) {
        Box(
            Modifier
                .fillMaxSize()
                .background(c.scrim)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss),
        )
    }
    AnimatedVisibility(
        visible,
        enter = slideInVertically(tween(320)) { it } + fadeIn(tween(200)),
        exit = slideOutVertically(tween(260)) { it } + fadeOut(tween(200)),
        modifier = Modifier.fillMaxSize(),
    ) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
                    .background(c.surface)
                    .border(1.dp, c.border, RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp))
                    .consumeClicks()
                    .navigationBarsPadding()
                    .imePadding()
                    .padding(horizontal = 22.dp),
            ) {
                Box(Modifier.fillMaxWidth().padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                    Box(Modifier.width(40.dp).height(4.dp).clip(CircleShape).background(c.textTertiary.copy(alpha = 0.6f)))
                }
                content()
                Spacer(Modifier.height(18.dp))
            }
        }
    }
}

/** Centered dialog in the RUNOVA style. */
@Composable
fun RunovaDialog(
    visible: Boolean,
    onDismiss: () -> Unit,
    title: String,
    message: String,
    confirmText: String,
    onConfirm: () -> Unit,
    dismissText: String? = "Cancel",
    icon: ImageVector? = null,
    iconTint: Color = Runova.colors.accent,
    destructive: Boolean = false,
) {
    val c = Runova.colors
    PlatformBackHandler(enabled = visible, onBack = onDismiss)
    AnimatedVisibility(visible, enter = fadeIn(tween(200)), exit = fadeOut(tween(200))) {
        Box(
            Modifier
                .fillMaxSize()
                .background(c.scrim)
                .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDismiss),
        )
    }
    AnimatedVisibility(visible, enter = scaleIn(tween(240), initialScale = 0.9f) + fadeIn(tween(200)), exit = scaleOut(tween(180), targetScale = 0.95f) + fadeOut(tween(180)), modifier = Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
            Column(
                Modifier
                    .widthIn(max = 420.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(28.dp))
                    .background(c.surface)
                    .border(1.dp, c.border, RoundedCornerShape(28.dp))
                    .consumeClicks()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                if (icon != null) {
                    Box(Modifier.size(58.dp).clip(CircleShape).background(iconTint.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                        androidx.compose.material3.Icon(icon, null, tint = iconTint, modifier = Modifier.size(30.dp))
                    }
                    Spacer(Modifier.height(14.dp))
                }
                Text(title, style = Runova.type.titleM, color = c.textPrimary, textAlign = TextAlign.Center)
                Spacer(Modifier.height(8.dp))
                Text(message, style = Runova.type.bodyS, color = c.textSecondary, textAlign = TextAlign.Center)
                Spacer(Modifier.height(22.dp))
                if (destructive) {
                    GhostButton(confirmText, onConfirm, Modifier.fillMaxWidth(), color = c.red)
                } else {
                    LimeButton(confirmText, onConfirm, Modifier.fillMaxWidth(), height = 54.dp, glow = false, textStyle = Runova.type.titleS)
                }
                if (dismissText != null) {
                    Spacer(Modifier.height(10.dp))
                    GhostButton(dismissText, onDismiss, Modifier.fillMaxWidth())
                }
            }
        }
    }
}

/** Small transient banner that slides in from the top. */
@Composable
fun TopToast(text: String?, modifier: Modifier = Modifier, icon: ImageVector? = null) {
    val c = Runova.colors
    AnimatedVisibility(
        text != null,
        enter = slideInVertically(tween(300)) { -it } + fadeIn(),
        exit = slideOutVertically(tween(300)) { -it } + fadeOut(),
        modifier = modifier,
    ) {
        Box(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 24.dp, vertical = 8.dp), contentAlignment = Alignment.TopCenter) {
            Row(
                Modifier
                    .neonGlow(c.lime, 12.dp, alpha = if (c.isDark) 0.2f else 0f)
                    .clip(CircleShape)
                    .background(c.lime)
                    .padding(horizontal = 18.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (icon != null) {
                    androidx.compose.material3.Icon(icon, null, tint = c.onLime, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(8.dp))
                }
                Text(text ?: "", style = Runova.type.titleS, color = c.onLime)
            }
        }
    }
}

/** Row with a label and a switch, used in settings screens and sheets. */
@Composable
fun ToggleRow(title: String, subtitle: String?, checked: Boolean, onChange: (Boolean) -> Unit, icon: ImageVector? = null, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Row(
        modifier
            .fillMaxWidth()
            .clickable { onChange(!checked) }
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            androidx.compose.material3.Icon(icon, null, tint = c.textPrimary, modifier = Modifier.size(24.dp))
            Spacer(Modifier.width(16.dp))
        }
        Column(Modifier.weight(1f)) {
            Text(title, style = Runova.type.body, color = c.textPrimary)
            if (subtitle != null) Text(subtitle, style = Runova.type.bodyS, color = c.textSecondary)
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = c.onLime,
                checkedTrackColor = c.lime,
                uncheckedThumbColor = c.textSecondary,
                uncheckedTrackColor = c.surfaceHigh,
                uncheckedBorderColor = c.border,
            ),
        )
    }
}
