package com.runova.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Sort
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.CircleIconButton
import com.runova.app.ui.components.FlameBrush
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.MainTab
import com.runova.app.ui.components.PlatformBackHandler
import com.runova.app.ui.components.RouteThumbnail
import com.runova.app.ui.components.RunovaBottomBar
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.ScreenTopBar
import com.runova.app.ui.components.neonGlow
import com.runova.app.ui.model.HistoryFilter
import com.runova.app.ui.model.HistoryItemUi
import com.runova.app.ui.model.HistorySort
import com.runova.app.ui.model.HistoryUiState
import com.runova.app.ui.theme.Runova
import com.runova.core.format.Fmt

class HistoryActions(
    val onBack: () -> Unit = {},
    val onOpen: (Long) -> Unit = {},
    val onSort: (HistorySort) -> Unit = {},
    val onFilter: (HistoryFilter) -> Unit = {},
    val onStartRun: () -> Unit = {},
    val onTab: (MainTab) -> Unit = {},
)

@Composable
fun HistoryScreen(state: HistoryUiState, actions: HistoryActions) {
    val c = Runova.colors
    var menu by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            ScreenTopBar("Run History", actions.onBack) {
                CircleIconButton(Icons.Rounded.Sort, "Sort and filter", { menu = !menu }, iconSize = 26.dp)
            }
            if (state.items.isEmpty()) {
                EmptyHistory(state.filter != HistoryFilter.ALL, actions)
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 18.dp, end = 18.dp, top = 6.dp, bottom = 130.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    item {
                        val total = state.items.sumOf { it.distanceM }
                        Text(
                            "${state.items.size} ${if (state.items.size == 1) "run" else "runs"} · ${Fmt.distance(total, state.units, 1)}${if (state.filter != HistoryFilter.ALL) " · " + filterLabel(state.filter).lowercase() else ""}",
                            style = Runova.type.label,
                            color = c.textSecondary,
                            modifier = Modifier.padding(start = 4.dp, bottom = 2.dp),
                        )
                    }
                    items(state.items, key = { it.id }) { item -> HistoryCard(item, state, actions) }
                }
            }
        }
        // sort & filter popup
        if (menu) {
            PlatformBackHandler { menu = false }
            Box(Modifier.fillMaxSize().clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { menu = false })
        }
        AnimatedVisibility(
            menu,
            enter = scaleIn(tween(180), initialScale = 0.9f, transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0f)) + fadeIn(tween(150)),
            exit = scaleOut(tween(150), targetScale = 0.9f, transformOrigin = androidx.compose.ui.graphics.TransformOrigin(1f, 0f)) + fadeOut(tween(120)),
            modifier = Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top = 52.dp, end = 14.dp),
        ) {
            Column(
                Modifier
                    .width(230.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(c.surfaceHigh)
                    .border(1.dp, c.border, RoundedCornerShape(20.dp))
                    .padding(vertical = 8.dp),
            ) {
                MenuHeader("Sort by")
                for (s in HistorySort.entries) MenuItem(sortLabel(s), s == state.sort) { actions.onSort(s); menu = false }
                Spacer(Modifier.height(6.dp))
                MenuHeader("Show")
                for (f in HistoryFilter.entries) MenuItem(filterLabel(f), f == state.filter) { actions.onFilter(f); menu = false }
            }
        }
        RunovaBottomBar(MainTab.ACTIVITY, actions.onTab, Modifier.align(Alignment.BottomCenter))
    }
}

private fun sortLabel(s: HistorySort) = when (s) {
    HistorySort.NEWEST -> "Newest first"
    HistorySort.OLDEST -> "Oldest first"
    HistorySort.LONGEST -> "Longest distance"
    HistorySort.FASTEST -> "Fastest pace"
}

private fun filterLabel(f: HistoryFilter) = when (f) {
    HistoryFilter.ALL -> "All runs"
    HistoryFilter.WEEK -> "This week"
    HistoryFilter.MONTH -> "This month"
    HistoryFilter.YEAR -> "This year"
}

@Composable
private fun MenuHeader(text: String) {
    Text(text.uppercase(), style = Runova.type.caption, color = Runova.colors.textTertiary, modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp))
}

@Composable
private fun MenuItem(text: String, checked: Boolean, onClick: () -> Unit) {
    val c = Runova.colors
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 18.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = Runova.type.body, color = if (checked) c.accent else c.textPrimary, modifier = Modifier.weight(1f))
        if (checked) Icon(Icons.Rounded.Check, null, tint = c.accent, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun HistoryCard(item: HistoryItemUi, state: HistoryUiState, actions: HistoryActions) {
    val c = Runova.colors
    RunovaCard(
        Modifier
            .fillMaxWidth()
            .neonGlow(c.lime, 12.dp, cornerRadius = 24.dp, alpha = if (item.highlighted && c.isDark) 0.12f else 0f),
        onClick = { actions.onOpen(item.id) },
        shape = RoundedCornerShape(24.dp),
        border = if (item.highlighted) c.lime.copy(alpha = 0.85f) else c.border,
        borderWidth = if (item.highlighted) 1.6.dp else 1.dp,
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            RouteThumbnail(item.route, Modifier.size(width = 104.dp, height = 96.dp).clip(RoundedCornerShape(16.dp)))
            Spacer(Modifier.width(16.dp))
            Column(Modifier.weight(1f)) {
                Text("${Fmt.distanceValue(item.distanceM, state.units)} ${Fmt.distanceUnit(state.units)}", style = Runova.type.metricM.copy(fontSize = 25.sp), color = c.textPrimary)
                Spacer(Modifier.height(2.dp))
                Text("${item.dateText} • ${item.durationText}", style = Runova.type.bodyS.copy(fontSize = 15.sp), color = c.textSecondary, maxLines = 1)
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    GradientIcon(Icons.Rounded.LocalFireDepartment, FlameBrush, Modifier.size(20.dp))
                    Spacer(Modifier.width(4.dp))
                    Text("${Fmt.integer(item.calories)} kcal", style = Runova.type.bodyS.copy(fontSize = 15.sp), color = c.textSecondary)
                }
            }
            Icon(Icons.Rounded.ChevronRight, null, tint = c.textSecondary, modifier = Modifier.align(Alignment.Top).size(26.dp))
        }
    }
}

@Composable
private fun EmptyHistory(filtered: Boolean, actions: HistoryActions) {
    val c = Runova.colors
    Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Box(Modifier.size(110.dp).clip(RoundedCornerShape(36.dp)).background(c.surface), contentAlignment = Alignment.Center) {
            Icon(RunovaIcons.Sneaker, null, tint = c.accent, modifier = Modifier.size(64.dp))
        }
        Spacer(Modifier.height(20.dp))
        Text(if (filtered) "No runs in this period" else "No runs yet", style = Runova.type.titleM, color = c.textPrimary)
        Spacer(Modifier.height(6.dp))
        Text(
            if (filtered) "Try another filter to see older runs." else "Your runs will appear here with their route, pace and calories.",
            style = Runova.type.bodyS,
            color = c.textSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        if (!filtered) LimeButton("START FIRST RUN", actions.onStartRun, Modifier.fillMaxWidth(), icon = Icons.Rounded.PlayArrow)
        Spacer(Modifier.height(90.dp))
    }
}
