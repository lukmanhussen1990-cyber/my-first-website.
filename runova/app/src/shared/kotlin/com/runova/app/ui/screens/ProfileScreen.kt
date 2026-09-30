package com.runova.app.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Contrast
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.PersonOutline
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.HairlineDivider
import com.runova.app.ui.components.MainTab
import com.runova.app.ui.components.ProgressRing
import com.runova.app.ui.components.RunovaBottomBar
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.SettingsRow
import com.runova.app.ui.components.circleGlow
import com.runova.app.ui.model.ProfileUiState
import com.runova.app.ui.theme.Runova
import com.runova.core.format.Fmt

class ProfileActions(
    val onSettings: () -> Unit = {},
    val onEditAvatar: () -> Unit = {},
    val onPersonalInfo: () -> Unit = {},
    val onAchievements: () -> Unit = {},
    val onHeartRate: () -> Unit = {},
    val onNotifications: () -> Unit = {},
    val onTheme: () -> Unit = {},
    val onAbout: () -> Unit = {},
    val onTab: (MainTab) -> Unit = {},
)

@Composable
fun ProfileScreen(state: ProfileUiState, actions: ProfileActions) {
    val c = Runova.colors
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).statusBarsPadding().padding(horizontal = 20.dp)) {
            Row(Modifier.fillMaxWidth().padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Profile", style = Runova.type.titleXL.copy(fontSize = 30.sp), color = c.textPrimary, modifier = Modifier.weight(1f))
                CircleIconButton(Icons.Outlined.Settings, "Settings", actions.onSettings, iconSize = 28.dp)
            }
            Spacer(Modifier.height(14.dp))
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(Modifier.size(146.dp)) {
                    ProgressRing(
                        progress = state.level.fraction.coerceAtLeast(0.02f),
                        modifier = Modifier.fillMaxSize(),
                        strokeWidth = 6.dp,
                        colors = listOf(c.lime, Color(0xFF7FD12A)),
                        glowPadding = 5.dp,
                    ) {
                        Avatar(state, Modifier.size(118.dp))
                    }
                    Box(
                        Modifier
                            .align(Alignment.BottomEnd)
                            .padding(end = 10.dp, bottom = 10.dp)
                            .size(36.dp)
                            .circleGlow(c.lime, 6.dp, if (c.isDark) 0.4f else 0f)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(listOf(c.lime, Color(0xFF6FC419))))
                            .border(3.dp, c.background, CircleShape)
                            .clickable(role = Role.Button, onClick = actions.onEditAvatar)
                            .semantics { contentDescription = "Change profile photo" },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(Icons.Rounded.Edit, null, tint = c.onLime, modifier = Modifier.size(17.dp))
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(state.name, style = Runova.type.titleL.copy(fontSize = 27.sp, fontWeight = FontWeight.ExtraBold), color = c.textPrimary, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
            Text(
                "Level ${state.level.level} • ${Fmt.integer(state.level.totalXp)} XP",
                style = Runova.type.body.copy(fontSize = 17.sp),
                color = c.textSecondary,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(6.dp))
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text(
                    "${state.levelTitle} · ${Fmt.integer(state.level.xpToNext)} XP to Level ${state.level.level + 1}",
                    style = Runova.type.caption.copy(fontSize = 12.sp),
                    color = c.accent,
                    modifier = Modifier.clip(CircleShape).background(c.lime.copy(alpha = 0.12f)).padding(horizontal = 12.dp, vertical = 5.dp),
                )
            }
            Spacer(Modifier.height(18.dp))
            RunovaCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
                Row(Modifier.padding(vertical = 18.dp)) {
                    ProfileStat(Fmt.integer(state.runs), "Runs", Modifier.weight(1f))
                    ProfileStat(Fmt.distanceValue(state.distanceM, state.units, 0).let { if (state.distanceM < 10_000) Fmt.distanceValue(state.distanceM, state.units, 1) else it }, Fmt.distanceUnit(state.units), Modifier.weight(1f))
                    ProfileStat(Fmt.integer(state.calories), "Kcal", Modifier.weight(1f))
                }
            }
            Spacer(Modifier.height(16.dp))
            RunovaCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(24.dp)) {
                Column {
                    SettingsRow(Icons.Outlined.PersonOutline, "Personal Info", actions.onPersonalInfo)
                    HairlineDivider()
                    SettingsRow(Icons.Outlined.EmojiEvents, "Achievements", actions.onAchievements, value = "${state.achievementsUnlocked}/${state.achievementsTotal}")
                    HairlineDivider()
                    SettingsRow(Icons.Rounded.Favorite, "Heart Rate", actions.onHeartRate, iconTint = c.red, subtitle = "(${state.heartRateStatus})")
                    HairlineDivider()
                    SettingsRow(Icons.Rounded.Settings, "Units & Settings", actions.onSettings)
                    HairlineDivider()
                    SettingsRow(Icons.Outlined.NotificationsNone, "Reminders", actions.onNotifications)
                    HairlineDivider()
                    SettingsRow(Icons.Outlined.Contrast, "Theme", actions.onTheme, value = state.themeLabel)
                    HairlineDivider()
                    SettingsRow(Icons.Outlined.Info, "About RUNOVA", actions.onAbout)
                }
            }
            Spacer(Modifier.height(120.dp))
        }
        RunovaBottomBar(MainTab.PROFILE, actions.onTab, Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
fun Avatar(state: ProfileUiState, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Box(modifier.clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFF2B3A40), Color(0xFF151D21)))), contentAlignment = Alignment.Center) {
        val img = state.avatar
        if (img != null) {
            Image(img, contentDescription = "Profile photo", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        } else {
            val initials = state.name.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "R" }
            Text(initials, style = Runova.type.titleXL.copy(fontSize = 40.sp), color = c.accent)
        }
    }
}

@Composable
private fun ProfileStat(value: String, label: String, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = Runova.type.metricM.copy(fontSize = 28.sp), color = c.textPrimary, maxLines = 1)
        Spacer(Modifier.height(2.dp))
        Text(label, style = Runova.type.body, color = c.textSecondary)
    }
}
