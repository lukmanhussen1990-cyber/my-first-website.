package com.runova.app.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.AchievementBadge
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.ConfettiBurst
import com.runova.app.ui.components.HeroBadge
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.LimeProgressBar
import com.runova.app.ui.components.ScreenTopBar
import com.runova.app.ui.model.AchievementItemUi
import com.runova.app.ui.model.AchievementsUiState
import com.runova.app.ui.theme.Runova

class AchievementsActions(
    val onBack: () -> Unit = {},
    val onSelect: (String) -> Unit = {},
    val onAcknowledge: () -> Unit = {},
    val onShare: (String) -> Unit = {},
)

@Composable
fun AchievementsScreen(state: AchievementsUiState, actions: AchievementsActions) {
    val c = Runova.colors
    val featured = state.featured
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            ScreenTopBar("Achievements", actions.onBack) {
                if (featured != null && featured.unlocked) {
                    CircleIconButton(Icons.Outlined.IosShare, "Share achievement", { actions.onShare(featured.def.id) }, iconSize = 24.dp)
                }
            }
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp)) {
                if (featured != null) {
                    AnimatedContent(
                        targetState = featured,
                        transitionSpec = { (scaleIn(spring(dampingRatio = 0.55f), initialScale = 0.85f) + fadeIn(tween(200))) togetherWith fadeOut(tween(150)) },
                    ) { item ->
                        FeaturedAchievement(item, state.celebrate, actions)
                    }
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    "${state.unlockedCount} of ${state.items.size} unlocked",
                    style = Runova.type.label,
                    color = c.textSecondary,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                )
                Spacer(Modifier.height(18.dp))
                state.items.chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        row.forEach { item ->
                            GridBadge(item, selected = item.def.id == featured?.def?.id, modifier = Modifier.weight(1f)) { actions.onSelect(item.def.id) }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                    Spacer(Modifier.height(14.dp))
                }
                Spacer(Modifier.navigationBarsPadding().height(20.dp))
            }
        }
    }
}

@Composable
private fun FeaturedAchievement(item: AchievementItemUi, celebrate: Boolean, actions: AchievementsActions) {
    val c = Runova.colors
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.fillMaxWidth().height(250.dp), contentAlignment = Alignment.Center) {
            if (item.unlocked) ConfettiBurst(trigger = item.def.id + celebrate, modifier = Modifier.fillMaxSize())
            HeroBadge(item.def.icon, item.def.tone, size = 210.dp, locked = !item.unlocked)
        }
        Text(item.def.title, style = Runova.type.titleXL.copy(fontSize = 30.sp), color = c.textPrimary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text(
            if (item.unlocked) item.def.unlockText else item.def.description,
            style = Runova.type.body.copy(fontSize = 17.sp, lineHeight = 25.sp),
            color = c.textPrimary.copy(alpha = 0.85f),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 34.dp),
        )
        Spacer(Modifier.height(18.dp))
        when {
            item.unlocked && celebrate && item.isNew -> LimeButton("Nice!", actions.onAcknowledge, Modifier.fillMaxWidth(), height = 54.dp, textStyle = Runova.type.titleS.copy(fontWeight = FontWeight.Bold, fontSize = 18.sp))
            item.unlocked -> Box(
                Modifier.clip(CircleShape).background(c.lime.copy(alpha = 0.14f)).padding(horizontal = 16.dp, vertical = 8.dp),
            ) { Text(item.unlockedText ?: "Unlocked", style = Runova.type.label.copy(fontWeight = FontWeight.SemiBold), color = c.accent) }
            else -> Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                LimeProgressBar(item.fraction, height = 10.dp)
                Spacer(Modifier.height(8.dp))
                Text("${item.progressText} · +${item.def.xp} XP", style = Runova.type.label, color = c.textSecondary)
            }
        }
    }
}

@Composable
private fun GridBadge(item: AchievementItemUi, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val c = Runova.colors
    Column(
        modifier
            .clip(RoundedCornerShape(18.dp))
            .then(if (selected) Modifier.background(c.surface).border(1.dp, c.lime.copy(alpha = 0.5f), RoundedCornerShape(18.dp)) else Modifier)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(vertical = 10.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box {
            AchievementBadge(item.def.icon, item.def.tone, size = 82.dp, locked = !item.unlocked)
            if (item.isNew && item.unlocked) {
                Box(Modifier.align(Alignment.TopEnd).clip(CircleShape).background(c.lime).padding(horizontal = 6.dp, vertical = 2.dp)) {
                    Text("NEW", style = Runova.type.caption.copy(fontSize = 9.sp, fontWeight = FontWeight.ExtraBold), color = c.onLime)
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            item.def.title,
            style = Runova.type.label.copy(fontWeight = FontWeight.Bold, fontSize = 14.sp),
            color = if (item.unlocked) c.textPrimary else c.textSecondary,
            textAlign = TextAlign.Center,
            maxLines = 2,
        )
        if (!item.unlocked) {
            Text("${(item.fraction * 100).toInt()}%", style = Runova.type.caption, color = c.textTertiary)
        }
    }
}
