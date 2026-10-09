package com.loe.chat.ui.bots

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.data.Bot
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.Creators
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.BotAvatar
import com.loe.chat.ui.components.BotListRow
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.SearchField
import com.loe.chat.ui.theme.LoeTheme

@Composable
fun BotsScreen(graph: AppGraph, nav: NavController, creator: String?) {
    val colors = LoeTheme.colors
    val settings by graph.settings.state.collectAsState()
    val custom by graph.bots.customBots.collectAsState()
    var query by rememberSaveable { mutableStateOf("") }

    fun matches(bot: Bot) = query.isBlank() || bot.name.contains(query, true) || bot.description.contains(query, true)

    val yours = if (creator == null || creator == "you") custom.filter(::matches) else emptyList()
    val following = if (creator == null) (BotCatalog.official + custom).filter { it.id in settings.followedBots && matches(it) } else emptyList()
    val official = BotCatalog.official.filter { (creator == null || it.creator == creator) && matches(it) }

    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar(
            title = when (creator) {
                null -> "Bots"
                "you" -> "Your bots"
                else -> "${Creators.displayName(creator)} bots"
            },
            onBack = { nav.popBackStack() },
        )
        SearchField(query, { query = it }, "Search bots", Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
        LazyColumn(Modifier.fillMaxSize()) {
            if (creator == null || creator == "you") {
                item { SectionLabel("Your bots") }
                item {
                    Row(
                        Modifier.fillMaxWidth().clickable { nav.navigate(Routes.createBot()) }.padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier.size(56.dp).clip(RoundedCornerShape(14.dp)).background(colors.chipSelectedBg),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Rounded.Add, contentDescription = null, tint = colors.chipSelectedText)
                        }
                        Spacer(Modifier.width(14.dp))
                        Column {
                            Text("Create a bot", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text)
                            Text("Give it a name, a look and a prompt", fontSize = 15.sp, color = colors.textSecondary)
                        }
                    }
                }
                items(yours, key = { "yours-" + it.id }) { bot ->
                    BotListRow(bot, onClick = { nav.navigate(Routes.newChat(bot.id)) }, avatarSize = 56.dp)
                }
            }
            if (following.isNotEmpty()) {
                item { SectionLabel("Following") }
                items(following, key = { "following-" + it.id }) { bot ->
                    BotListRow(bot, onClick = { nav.navigate(Routes.newChat(bot.id)) }, avatarSize = 56.dp, descriptionLines = 1)
                }
            }
            if (official.isNotEmpty()) {
                item { SectionLabel(if (creator == null) "All official bots" else "Bots") }
                items(official, key = { "official-" + it.id }) { bot ->
                    BotListRow(bot, onClick = { nav.navigate(Routes.newChat(bot.id)) }, avatarSize = 56.dp, descriptionLines = 1)
                    HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = colors.divider)
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        fontSize = 18.sp,
        fontWeight = FontWeight.Bold,
        color = LoeTheme.colors.text,
        modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 18.dp, bottom = 6.dp),
    )
}

@Composable
fun CreatorsScreen(graph: AppGraph, nav: NavController) {
    val colors = LoeTheme.colors
    val custom by graph.bots.customBots.collectAsState()
    val settings by graph.settings.state.collectAsState()
    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar("Creators", onBack = { nav.popBackStack() })
        LazyColumn {
            items(Creators.officialHandles) { handle ->
                val bots = BotCatalog.official.filter { it.creator == handle }
                CreatorRow(
                    sample = bots.firstOrNull(),
                    name = Creators.displayName(handle),
                    subtitle = "@$handle · ${bots.size} bots",
                    onClick = { nav.navigate(Routes.bots(handle)) },
                )
                HorizontalDivider(Modifier.padding(horizontal = 16.dp), color = colors.divider)
            }
            if (custom.isNotEmpty()) {
                item {
                    CreatorRow(
                        sample = custom.first(),
                        name = settings.profile.name.ifBlank { "You" },
                        subtitle = "@${settings.profile.handle.ifBlank { "you" }} · ${custom.size} bots",
                        onClick = { nav.navigate(Routes.bots("you")) },
                    )
                }
            }
        }
    }
}

@Composable
private fun CreatorRow(sample: Bot?, name: String, subtitle: String, onClick: () -> Unit) {
    val colors = LoeTheme.colors
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (sample != null) BotAvatar(sample, 52.dp)
        Spacer(Modifier.width(14.dp))
        Column {
            Text(name, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text)
            Text(subtitle, fontSize = 15.sp, color = colors.textSecondary)
        }
    }
}
