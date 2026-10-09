package com.loe.chat.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.SecondaryTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.BotListRow
import com.loe.chat.ui.components.EmptyState
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.components.UserAvatar
import com.loe.chat.ui.theme.LoeTheme

@Composable
fun ProfileScreen(graph: AppGraph, nav: NavController) {
    val colors = LoeTheme.colors
    val settings by graph.settings.state.collectAsState()
    val created by graph.bots.customBots.collectAsState()
    val allBots by graph.bots.all.collectAsState()
    val followed = allBots.filter { it.id in settings.followedBots }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val profile = settings.profile

    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar("Profile", onBack = { nav.popBackStack() })
        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            UserAvatar(profile, 72.dp)
            Spacer(Modifier.width(24.dp))
            Column(Modifier.weight(1f)) {
                Text(profile.name.ifBlank { "Your name" }, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text)
                Text("@${profile.handle.ifBlank { "username" }}", fontSize = 14.5.sp, color = colors.textSecondary)
            }
            Text(
                "Edit",
                fontSize = 16.5.sp,
                fontWeight = FontWeight.Bold,
                color = colors.text,
                modifier = Modifier.clickable { nav.navigate(Routes.EDIT_PROFILE) }.padding(8.dp),
            )
        }
        if (profile.bio.isNotBlank()) {
            Text(profile.bio, fontSize = 16.sp, color = colors.text, modifier = Modifier.padding(horizontal = 16.dp))
        }
        Row(Modifier.padding(horizontal = 16.dp, vertical = 18.dp)) {
            Text(countText(0, "Followers"), fontSize = 16.sp, color = colors.textSecondary)
            Spacer(Modifier.width(16.dp))
            Text(countText(followed.size, "Following"), fontSize = 16.sp, color = colors.textSecondary)
        }
        SecondaryTabRow(
            selectedTabIndex = tab,
            containerColor = colors.background,
            indicator = {
                TabRowDefaults.SecondaryIndicator(
                    Modifier.tabIndicatorOffset(tab, matchContentSize = false),
                    height = 3.dp,
                    color = colors.link,
                )
            },
            divider = { HorizontalDivider(color = colors.divider) },
        ) {
            listOf("${created.size} Created", "${followed.size} Followed bots").forEachIndexed { index, label ->
                Tab(
                    selected = tab == index,
                    onClick = { tab = index },
                    text = {
                        Text(
                            label,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (tab == index) colors.link else colors.text,
                        )
                    },
                )
            }
        }
        val list = if (tab == 0) created else followed
        if (list.isEmpty()) {
            EmptyState(
                title = if (tab == 0) "No bots yet" else "No followed bots",
                message = if (tab == 0) "Create a bot with your own prompt, name and look." else "Follow bots from their chat page to find them here.",
                action = if (tab == 0) ({ PrimaryButton("Create a bot", { nav.navigate(Routes.createBot()) }) }) else null,
            )
        } else {
            LazyColumn {
                items(list, key = { it.id }) { bot ->
                    BotListRow(bot, onClick = { nav.navigate(Routes.newChat(bot.id)) }, avatarSize = 56.dp)
                }
                item { Spacer(Modifier.height(12.dp)) }
            }
        }
    }
}

@Composable
private fun countText(count: Int, label: String) = buildAnnotatedString {
    withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = LoeTheme.colors.text)) { append(count.toString()) }
    append(" $label")
}
