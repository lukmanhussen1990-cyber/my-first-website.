package com.runova.app.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.DirectionsWalk
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Route
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.ChoiceChips
import com.runova.app.ui.components.GhostButton
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.PlatformBackHandler
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.RunovaTextField
import com.runova.app.ui.components.SectionLabel
import com.runova.app.ui.components.StepperField
import com.runova.app.ui.components.circleGlow
import com.runova.app.ui.theme.Runova
import com.runova.core.format.Fmt
import com.runova.core.format.UnitConv
import com.runova.core.model.Sex
import com.runova.core.model.UnitSystem
import java.util.Locale
import kotlin.math.roundToInt

data class OnboardingDraft(
    val name: String = "",
    val sex: Sex? = null,
    val age: Int = 30,
    val heightCm: Double = 175.0,
    val weightKg: Double = 70.0,
    val units: UnitSystem = UnitSystem.METRIC,
    val dailyDistanceKm: Double = 5.0,
    val dailyCalories: Int = 500,
)

data class PermissionSummary(val location: Boolean, val activity: Boolean, val notifications: Boolean)

@Composable
fun OnboardingScreen(
    permissions: PermissionSummary,
    onRequestPermissions: () -> Unit,
    onFinish: (OnboardingDraft) -> Unit,
    initialPage: Int = 0,
    initialDraft: OnboardingDraft = OnboardingDraft(),
) {
    val c = Runova.colors
    var page by remember { mutableStateOf(initialPage) }
    var draft by remember { mutableStateOf(initialDraft) }
    PlatformBackHandler(enabled = page > 0) { page-- }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(c.backgroundTop, c.background)))) {
        Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()) {
            Row(Modifier.fillMaxWidth().padding(24.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (i in 0 until 4) {
                    val w by animateDpAsState(if (i == page) 28.dp else 8.dp, tween(260))
                    Box(Modifier.height(8.dp).width(w).clip(CircleShape).background(if (i <= page) c.lime else c.surfaceHigh))
                }
            }
            AnimatedContent(
                targetState = page,
                transitionSpec = {
                    val dir = if (targetState > initialState) 1 else -1
                    (slideInHorizontally(tween(320)) { it / 3 * dir } + fadeIn(tween(260))) togetherWith (slideOutHorizontally(tween(260)) { -it / 3 * dir } + fadeOut(tween(200)))
                },
                modifier = Modifier.weight(1f),
            ) { p ->
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp)) {
                    when (p) {
                        0 -> WelcomePage()
                        1 -> ProfilePage(draft) { draft = it }
                        2 -> GoalPage(draft) { draft = it }
                        else -> PermissionPage(permissions)
                    }
                }
            }
            Column(Modifier.padding(horizontal = 24.dp, vertical = 16.dp)) {
                when (page) {
                    0 -> LimeButton("GET STARTED", { page = 1 }, Modifier.fillMaxWidth())
                    1 -> LimeButton("CONTINUE", { page = 2 }, Modifier.fillMaxWidth(), enabled = draft.name.isNotBlank())
                    2 -> LimeButton("CONTINUE", { page = 3 }, Modifier.fillMaxWidth())
                    else -> {
                        val allGranted = permissions.location && permissions.activity && permissions.notifications
                        if (!allGranted) {
                            LimeButton("ALLOW PERMISSIONS", onRequestPermissions, Modifier.fillMaxWidth())
                            Spacer(Modifier.height(10.dp))
                            GhostButton(if (permissions.location) "Continue" else "Skip for now", { onFinish(draft) }, Modifier.fillMaxWidth())
                        } else {
                            LimeButton("LET'S RUN", { onFinish(draft) }, Modifier.fillMaxWidth())
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WelcomePage() {
    val c = Runova.colors
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(24.dp))
        Box(Modifier.size(140.dp).circleGlow(c.lime, 30.dp, 0.2f), contentAlignment = Alignment.Center) {
            GradientIcon(RunovaIcons.Sprinter, Brush.verticalGradient(listOf(Color(0xFFE6FF7A), c.lime, Color(0xFF9BE22E))), Modifier.size(130.dp))
        }
        Spacer(Modifier.height(18.dp))
        Text("Welcome to RUNOVA", style = Runova.type.titleXL, color = c.textPrimary, textAlign = TextAlign.Center)
        Spacer(Modifier.height(8.dp))
        Text("Run. Burn. Level Up.", style = Runova.type.body.copy(fontSize = 18.sp), color = c.accent)
        Spacer(Modifier.height(28.dp))
        Feature(Icons.Rounded.Route, "Precise GPS tracking", "Live route map, distance, pace, splits and elevation — even with the screen off.")
        Feature(Icons.Rounded.EmojiEvents, "Earn XP & achievements", "Level up with every kilometer, keep your streak alive and unlock badges.")
        Feature(RunovaIcons.CoachBot, "Your AI coach", "Personal insights and answers based on your own training data.")
    }
}

@Composable
private fun Feature(icon: ImageVector, title: String, text: String) {
    val c = Runova.colors
    RunovaCard(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(46.dp).clip(RoundedCornerShape(15.dp)).background(c.lime.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = c.accent, modifier = Modifier.size(26.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column {
                Text(title, style = Runova.type.titleS, color = c.textPrimary)
                Text(text, style = Runova.type.bodyS, color = c.textSecondary)
            }
        }
    }
}

@Composable
private fun ProfilePage(draft: OnboardingDraft, onChange: (OnboardingDraft) -> Unit) {
    val c = Runova.colors
    Text("About you", style = Runova.type.titleXL, color = c.textPrimary)
    Spacer(Modifier.height(6.dp))
    Text("Used to personalise your coach and estimate calories and steps. Stays on your device.", style = Runova.type.bodyS, color = c.textSecondary)
    Spacer(Modifier.height(18.dp))
    RunovaTextField("Your name", draft.name, { onChange(draft.copy(name = it.take(40))) }, placeholder = "e.g. Imran")
    SectionLabel("Units")
    ChoiceChips(listOf("Metric (km, kg)", "Imperial (mi, lb)"), if (draft.units == UnitSystem.METRIC) 0 else 1, { onChange(draft.copy(units = if (it == 0) UnitSystem.METRIC else UnitSystem.IMPERIAL)) })
    SectionLabel("Sex (for estimates)")
    val sexes = listOf(Sex.MALE, Sex.FEMALE, Sex.OTHER)
    ChoiceChips(listOf("Male", "Female", "Other"), sexes.indexOf(draft.sex), { onChange(draft.copy(sex = sexes[it])) })
    SectionLabel("Body")
    StepperField("Age", "${draft.age} years", { onChange(draft.copy(age = (draft.age - 1).coerceAtLeast(10))) }, { onChange(draft.copy(age = (draft.age + 1).coerceAtMost(100))) })
    Spacer(Modifier.height(10.dp))
    StepperField(
        "Height",
        Fmt.height(draft.heightCm, draft.units),
        { onChange(draft.copy(heightCm = (draft.heightCm - if (draft.units == UnitSystem.METRIC) 1.0 else UnitConv.CM_PER_INCH).coerceAtLeast(120.0))) },
        { onChange(draft.copy(heightCm = (draft.heightCm + if (draft.units == UnitSystem.METRIC) 1.0 else UnitConv.CM_PER_INCH).coerceAtMost(230.0))) },
    )
    Spacer(Modifier.height(10.dp))
    StepperField(
        "Weight",
        Fmt.weight(draft.weightKg, draft.units),
        { onChange(draft.copy(weightKg = (draft.weightKg - if (draft.units == UnitSystem.METRIC) 0.5 else UnitConv.lbToKg(1.0)).coerceAtLeast(30.0))) },
        { onChange(draft.copy(weightKg = (draft.weightKg + if (draft.units == UnitSystem.METRIC) 0.5 else UnitConv.lbToKg(1.0)).coerceAtMost(250.0))) },
    )
    Spacer(Modifier.height(24.dp))
}

@Composable
private fun GoalPage(draft: OnboardingDraft, onChange: (OnboardingDraft) -> Unit) {
    val c = Runova.colors
    Text("Daily goals", style = Runova.type.titleXL, color = c.textPrimary)
    Spacer(Modifier.height(6.dp))
    Text("Pick a starting point — you can fine-tune daily, weekly and monthly goals any time.", style = Runova.type.bodyS, color = c.textSecondary)
    SectionLabel("Daily distance")
    val kmOptions = listOf(3.0, 5.0, 8.0, 10.0)
    val labels = kmOptions.map {
        val v = UnitConv.kmToDisplay(it, draft.units)
        "${if (draft.units == UnitSystem.METRIC) v.roundToInt().toString() else String.format(Locale.US, "%.1f", v)} ${Fmt.distanceUnit(draft.units)}"
    }
    ChoiceChips(labels, kmOptions.indexOf(draft.dailyDistanceKm), { onChange(draft.copy(dailyDistanceKm = kmOptions[it])) })
    SectionLabel("Daily active calories")
    val kcal = listOf(300, 500, 650, 800)
    ChoiceChips(kcal.map { "$it" }, kcal.indexOf(draft.dailyCalories), { onChange(draft.copy(dailyCalories = kcal[it])) })
    Spacer(Modifier.height(18.dp))
    RunovaCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp).animateContentSize()) {
            Text("Your plan", style = Runova.type.titleS, color = c.textPrimary)
            Spacer(Modifier.height(6.dp))
            Text(
                "Run ${Fmt.distanceSpoken(draft.dailyDistanceKm * 1000, draft.units)} and burn ${draft.dailyCalories} kcal a day. " +
                    "Steps goal: 10,000 · Active time: 60 min. Weekly and monthly goals scale automatically.",
                style = Runova.type.bodyS,
                color = c.textSecondary,
            )
        }
    }
}

@Composable
private fun PermissionPage(p: PermissionSummary) {
    val c = Runova.colors
    Text("Permissions", style = Runova.type.titleXL, color = c.textPrimary)
    Spacer(Modifier.height(6.dp))
    Text("RUNOVA only uses these while you track runs or count steps. Nothing leaves your phone.", style = Runova.type.bodyS, color = c.textSecondary)
    Spacer(Modifier.height(18.dp))
    PermissionRow(Icons.Rounded.LocationOn, "Location", "Required for GPS run tracking and the live route map.", p.location)
    PermissionRow(Icons.Rounded.DirectionsWalk, "Physical activity", "Counts your steps with the phone's step sensor.", p.activity)
    PermissionRow(Icons.Rounded.Notifications, "Notifications", "Shows the live run notification, achievements and reminders.", p.notifications)
    Spacer(Modifier.height(12.dp))
    Text("You can change these later in Android settings.", style = Runova.type.bodyS, color = c.textTertiary)
}

@Composable
private fun PermissionRow(icon: ImageVector, title: String, text: String, granted: Boolean) {
    val c = Runova.colors
    RunovaCard(Modifier.fillMaxWidth().padding(vertical = 6.dp), border = if (granted) c.lime.copy(alpha = 0.5f) else c.border) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(44.dp).clip(CircleShape).background(c.surfaceHigh), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = c.accent, modifier = Modifier.size(24.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = Runova.type.titleS, color = c.textPrimary)
                Text(text, style = Runova.type.bodyS, color = c.textSecondary)
            }
            if (granted) {
                Spacer(Modifier.width(8.dp))
                Icon(Icons.Rounded.CheckCircle, "Granted", tint = c.accent, modifier = Modifier.size(24.dp))
            }
        }
    }
}
