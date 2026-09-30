package com.runova.preview

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.runova.app.ui.components.AchievementBadge
import com.runova.app.ui.components.BarChart
import com.runova.app.ui.components.GoalRing
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.HeroBadge
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.MapMarkerStyle
import com.runova.app.ui.components.ProgressRing
import com.runova.app.ui.components.RunMap
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.SegmentedTabs
import com.runova.app.ui.components.SplashScene
import com.runova.app.ui.components.UnderlineTabs
import com.runova.app.ui.theme.Runova
import com.runova.core.progress.Achievements
import java.io.File

fun main(args: Array<String>) {
    val fonts = loadFonts(File(args[0]))
    val out = File(args[1]).apply { mkdirs() }
    val only = args.drop(2).toSet()
    fun want(name: String) = only.isEmpty() || name in only

    if (want("gallery")) renderScreen(out, "gallery", fonts) {
        val c = Runova.colors
        Column(Modifier.fillMaxSize().background(c.background).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                GradientIcon(RunovaIcons.Sprinter, androidx.compose.ui.graphics.Brush.verticalGradient(listOf(c.lime, c.limeDeep)), Modifier.size(90.dp))
                Spacer(Modifier.size(12.dp))
                GradientIcon(RunovaIcons.Sneaker, androidx.compose.ui.graphics.Brush.verticalGradient(listOf(c.lime, c.lime)), Modifier.size(48.dp))
                Spacer(Modifier.size(12.dp))
                GradientIcon(RunovaIcons.CoachBot, androidx.compose.ui.graphics.Brush.verticalGradient(listOf(c.teal, c.green)), Modifier.size(48.dp))
                Spacer(Modifier.size(12.dp))
                ProgressRing(0.67f, Modifier.size(120.dp), strokeWidth = 12.dp) { Text("67%", style = Runova.type.metricM, color = c.textPrimary) }
                GoalRing(0.7f, c.orange, Modifier.size(64.dp))
            }
            LimeButton("START RUN", {}, Modifier.fillMaxWidth(), icon = Icons.Rounded.PlayArrow)
            SegmentedTabs(listOf("Daily", "Weekly", "Monthly"), 0, {})
            UnderlineTabs(listOf("Map", "Splits", "Stats", "Charts"), 0, {})
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(c.surface).padding(16.dp)) {
                BarChart(listOf(310.0, 450.0, 380.0, 350.0, 420.0, 520.0, 430.0), listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"), chartHeight = 130.dp)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Achievements.all.take(6).forEach { AchievementBadge(it.icon, it.tone, size = 60.dp) }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                Achievements.all.drop(6).take(3).forEach { AchievementBadge(it.icon, it.tone, size = 60.dp, locked = it.id == "marathon" || it.id == "total_500km") }
                HeroBadge(Achievements.all[1].icon, Achievements.all[1].tone, size = 120.dp)
            }
            RunMap(listOf(demoLoop()), Modifier.fillMaxWidth().height(260.dp).clip(RoundedCornerShape(20.dp)), markers = MapMarkerStyle.START_END)
        }
    }

    if (want("home")) renderScreen(out, "home", fonts) {
        com.runova.app.ui.screens.HomeScreen(Fake.home, com.runova.app.ui.screens.HomeActions())
    }

    if (want("running")) renderScreen(out, "running", fonts) {
        com.runova.app.ui.screens.RunningScreen(FakeRun.running, com.runova.app.ui.screens.RunningActions())
    }
    if (want("running-paused")) renderScreen(out, "running-paused", fonts) {
        com.runova.app.ui.screens.RunningScreen(FakeRun.running.copy(status = com.runova.app.ui.model.LiveStatus.PAUSED, heartRateConnected = false), com.runova.app.ui.screens.RunningActions())
    }
    if (want("countdown")) renderScreen(out, "countdown", fonts, seconds = 0.6f) {
        com.runova.app.ui.screens.RunningScreen(FakeRun.running.copy(status = com.runova.app.ui.model.LiveStatus.COUNTDOWN, countdown = 3, distanceM = 0.0, movingTimeMs = 0, route = emptyList()), com.runova.app.ui.screens.RunningActions())
    }

    if (want("details")) renderScreen(out, "details", fonts) {
        com.runova.app.ui.screens.RunDetailsScreen(FakeMore.details, com.runova.app.ui.screens.RunDetailsActions())
    }
    for ((i, n) in listOf("splits", "stats-tab", "charts").withIndex()) {
        if (want("details-$n")) renderScreen(out, "details-$n", fonts) {
            com.runova.app.ui.screens.RunDetailsScreen(FakeMore.details, com.runova.app.ui.screens.RunDetailsActions(), initialTab = i + 1)
        }
    }
    if (want("achievements")) renderScreen(out, "achievements", fonts, seconds = 1.2f) {
        com.runova.app.ui.screens.AchievementsScreen(FakeMore.achievements, com.runova.app.ui.screens.AchievementsActions())
    }
    if (want("goals")) renderScreen(out, "goals", fonts) {
        com.runova.app.ui.screens.GoalsScreen(FakeMore.goals, com.runova.app.ui.screens.GoalsActions())
    }
    if (want("coach")) renderScreen(out, "coach", fonts) {
        com.runova.app.ui.screens.CoachScreen(FakeMore.coach, com.runova.app.ui.screens.CoachActions())
    }
    if (want("coach-chat")) renderScreen(out, "coach-chat", fonts) {
        com.runova.app.ui.screens.CoachScreen(FakeMore.coachChat, com.runova.app.ui.screens.CoachActions(onBack = {}))
    }
    if (want("stats")) renderScreen(out, "stats", fonts) {
        com.runova.app.ui.screens.StatsScreen(FakeMore.stats, com.runova.app.ui.screens.StatsActions())
    }
    if (want("history")) renderScreen(out, "history", fonts) {
        com.runova.app.ui.screens.HistoryScreen(FakeMore.history, com.runova.app.ui.screens.HistoryActions())
    }
    if (want("profile")) renderScreen(out, "profile", fonts) {
        com.runova.app.ui.screens.ProfileScreen(FakeMore.profile, com.runova.app.ui.screens.ProfileActions())
    }

    if (want("splash")) renderScreen(out, "splash", fonts, seconds = 0.1f) {
        com.runova.app.ui.screens.SplashScreen(onFinished = {}, fixedTime = 0.4f)
    }
    for (pg in 0..3) {
        if (want("onboarding-$pg")) renderScreen(out, "onboarding-$pg", fonts, seconds = 0.8f) {
            com.runova.app.ui.screens.OnboardingScreen(
                com.runova.app.ui.screens.PermissionSummary(location = true, activity = false, notifications = false),
                {}, {}, initialPage = pg,
                initialDraft = com.runova.app.ui.screens.OnboardingDraft(name = "Imran", sex = com.runova.core.model.Sex.MALE),
            )
        }
    }
    if (want("settings")) renderScreen(out, "settings", fonts, height = 3200) {
        com.runova.app.ui.screens.SettingsScreen(FakeRest.settings, com.runova.app.ui.screens.SettingsActions())
    }
    if (want("personal")) renderScreen(out, "personal", fonts) {
        com.runova.app.ui.screens.PersonalInfoScreen(FakeRest.personal, com.runova.app.ui.screens.PersonalInfoActions())
    }
    if (want("heart")) renderScreen(out, "heart", fonts) {
        com.runova.app.ui.screens.HeartRateScreen(FakeRest.heart, com.runova.app.ui.screens.HeartRateActions())
    }
    if (want("heart-connected")) renderScreen(out, "heart-connected", fonts) {
        com.runova.app.ui.screens.HeartRateScreen(FakeRest.heartConnected, com.runova.app.ui.screens.HeartRateActions())
    }
    if (want("about")) renderScreen(out, "about", fonts, height = 3000) {
        com.runova.app.ui.screens.AboutScreen("1.0.0", {})
    }
    if (want("notifications")) renderScreen(out, "notifications", fonts) {
        com.runova.app.ui.screens.NotificationsScreen(FakeRest.inbox, "Every day at 18:30", com.runova.app.ui.screens.NotificationsActions())
    }
    if (want("complete")) renderScreen(out, "complete", fonts, seconds = 5f, height = 2800) {
        com.runova.app.ui.screens.RunCompleteScreen(FakeRest.complete, com.runova.app.ui.screens.RunCompleteActions())
    }
    if (want("home-light")) renderScreen(out, "home-light", fonts, dark = false) {
        com.runova.app.ui.screens.HomeScreen(Fake.home, com.runova.app.ui.screens.HomeActions())
    }
    if (want("running-light")) renderScreen(out, "running-light", fonts, dark = false) {
        com.runova.app.ui.screens.RunningScreen(FakeRun.running, com.runova.app.ui.screens.RunningActions())
    }

    if (want("splash-scene")) {
        for ((i, t) in listOf(0.0f, 0.185f, 0.37f).withIndex()) {
            renderScreen(out, "splash-scene-$i", fonts, width = 540, height = 1170, seconds = 0.05f) {
                SplashScene(time = t, modifier = Modifier.fillMaxSize())
            }
        }
    }
}
