package com.loe.chat.ui.explore

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
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
import com.loe.chat.data.BotCategory
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.Creators
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.BotAvatar
import com.loe.chat.ui.components.BotListRow
import com.loe.chat.ui.components.EmptyState
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.SearchField
import com.loe.chat.ui.theme.LoeTheme

@Composable
fun ExploreScreen(graph: AppGraph, nav: NavController, initialCategory: BotCategory?) {
    val colors = LoeTheme.colors
    val allBots by graph.bots.all.collectAsState()
    val customBots by graph.bots.customBots.collectAsState()
    var query by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf(initialCategory ?: BotCategory.OFFICIAL) }

    val categories = remember(customBots) {
        BotCategory.entries.filter { it != BotCategory.YOURS || customBots.isNotEmpty() }
    }
    val q = query.trim()
    val bots = remember(allBots, q, category) {
        if (q.isNotEmpty()) {
            allBots.filter { it.name.contains(q, true) || it.description.contains(q, true) || Creators.displayName(it.creator).contains(q, true) }
        } else {
            allBots.filter { category in it.categories }
        }
    }
    val creators = remember(q) {
        if (q.isEmpty()) emptyList() else Creators.officialHandles.filter { it.contains(q, true) || Creators.displayName(it).contains(q, true) }
    }

    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar("Explore")
        SearchField(query, { query = it }, "Search for bots or people", Modifier.padding(horizontal = 16.dp))
        Spacer(Modifier.height(12.dp))
        if (q.isEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(categories) { c ->
                    val selected = c == category
                    Text(
                        c.label,
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (selected) colors.chipSelectedBg else colors.background)
                            .border(BorderStroke(1.dp, colors.chipBorder), RoundedCornerShape(10.dp))
                            .clickable { category = c }
                            .padding(horizontal = 12.dp, vertical = 5.dp),
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (selected) colors.chipSelectedText else colors.text,
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
        }
        LazyColumn(Modifier.fillMaxSize()) {
            if (creators.isNotEmpty()) {
                item { Text("People", fontSize = 15.sp, color = colors.textSecondary, modifier = Modifier.padding(start = 16.dp, top = 8.dp, bottom = 4.dp)) }
                items(creators) { handle ->
                    val sample = BotCatalog.official.firstOrNull { it.creator == handle }
                    Row(
                        Modifier.fillMaxWidth().clickable { nav.navigate(Routes.bots(handle)) }.padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (sample != null) BotAvatar(sample, 44.dp)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(Creators.displayName(handle), fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.text)
                            Text("@$handle", fontSize = 15.sp, color = colors.textSecondary)
                        }
                    }
                }
                item { Text("Bots", fontSize = 15.sp, color = colors.textSecondary, modifier = Modifier.padding(start = 16.dp, top = 8.dp, bottom = 4.dp)) }
            }
            if (bots.isEmpty()) {
                item {
                    EmptyState(
                        title = "No bots found",
                        message = if (category == BotCategory.YOURS) "Create your own bot from Menu → Create." else "Try a different search.",
                    )
                }
            }
            items(bots, key = { it.id }) { bot ->
                BotListRow(bot, onClick = { nav.navigate(Routes.newChat(bot.id)) })
                HorizontalDivider(Modifier.padding(horizontal = 16.dp), thickness = 1.dp, color = colors.divider)
            }
            item { Spacer(Modifier.height(12.dp)) }
        }
    }
}
