package com.loe.chat.ui

import android.net.Uri
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Explore
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.loe.chat.AppGraph
import com.loe.chat.data.BotCategory
import com.loe.chat.ui.components.CountBadge
import com.loe.chat.ui.bots.BotDetailsScreen
import com.loe.chat.ui.bots.BotsScreen
import com.loe.chat.ui.bots.CreateBotScreen
import com.loe.chat.ui.bots.CreatorsScreen
import com.loe.chat.ui.chat.ChatScreen
import com.loe.chat.ui.explore.ExploreScreen
import com.loe.chat.ui.history.HistoryScreen
import com.loe.chat.ui.home.HomeScreen
import com.loe.chat.ui.menu.MenuScreen
import com.loe.chat.ui.onboarding.WelcomeScreen
import com.loe.chat.ui.profile.EditProfileScreen
import com.loe.chat.ui.profile.ProfileScreen
import com.loe.chat.ui.settings.ApiKeysScreen
import com.loe.chat.ui.settings.InfoScreen
import com.loe.chat.ui.settings.SettingsScreen
import com.loe.chat.ui.subscribe.SubscribeScreen
import com.loe.chat.ui.theme.LoeTheme

object Routes {
    const val WELCOME = "welcome"
    const val HOME = "home"
    const val EXPLORE = "explore?category={category}"
    const val HISTORY = "history?bot={bot}"
    const val MENU = "menu"
    const val CHAT = "chat/{id}?bot={bot}"
    const val SETTINGS = "settings"
    const val API_KEYS = "apikeys"
    const val PROFILE = "profile"
    const val EDIT_PROFILE = "profile/edit"
    const val BOTS = "bots?creator={creator}"
    const val CREATE_BOT = "createbot?edit={edit}&base={base}"
    const val BOT_DETAILS = "bot/{id}"
    const val CREATORS = "creators"
    const val SUBSCRIBE = "subscribe"
    const val INFO = "info/{page}"

    fun explore(category: BotCategory? = null) = "explore?category=${category?.name.orEmpty()}"
    fun history(botId: String? = null) = "history?bot=${Uri.encode(botId.orEmpty())}"
    fun chat(id: Long) = "chat/$id?bot="
    fun newChat(botId: String) = "chat/-1?bot=${Uri.encode(botId)}"
    fun bots(creator: String? = null) = "bots?creator=${Uri.encode(creator.orEmpty())}"
    fun createBot(editId: String? = null, baseId: String? = null) =
        "createbot?edit=${Uri.encode(editId.orEmpty())}&base=${Uri.encode(baseId.orEmpty())}"
    fun botDetails(id: String) = "bot/${Uri.encode(id)}"
    fun info(page: String) = "info/$page"
}

enum class Tab(val label: String, val icon: ImageVector, val route: String) {
    HOME("Home", Icons.Outlined.Home, Routes.HOME),
    EXPLORE("Explore", Icons.Outlined.Explore, Routes.explore()),
    HISTORY("History", Icons.Outlined.Forum, Routes.history()),
    MENU("Menu", Icons.Rounded.Menu, Routes.MENU),
}

private val menuRoutes = setOf(
    Routes.MENU, Routes.SETTINGS, Routes.API_KEYS, Routes.PROFILE, Routes.BOTS,
    Routes.CREATORS, Routes.SUBSCRIBE, Routes.INFO,
)

private fun tabFor(route: String?): Tab? = when (route) {
    Routes.HOME -> Tab.HOME
    Routes.EXPLORE -> Tab.EXPLORE
    Routes.HISTORY -> Tab.HISTORY
    in menuRoutes -> Tab.MENU
    else -> null
}

fun NavHostController.openTab(tab: Tab) {
    navigate(tab.route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

@Composable
fun LoeApp(graph: AppGraph, openConversationId: Long?, onOpenedConversation: () -> Unit) {
    val nav = rememberNavController()
    val settings by graph.settings.state.collectAsState()
    val start = remember { if (graph.settings.current.onboarded) Routes.HOME else Routes.WELCOME }
    val entry by nav.currentBackStackEntryAsState()
    val currentTab = tabFor(entry?.destination?.route)
    val unread by remember { graph.repository.totalUnread() }.collectAsState(initial = 0)

    LaunchedEffect(openConversationId) {
        if (openConversationId != null && openConversationId > 0 && settings.onboarded) {
            nav.navigate(Routes.chat(openConversationId))
            onOpenedConversation()
        }
    }

    Scaffold(
        containerColor = LoeTheme.colors.background,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        bottomBar = {
            if (currentTab != null) LoeBottomBar(currentTab, unread) { nav.openTab(it) }
        },
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = start,
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            composable(Routes.WELCOME) {
                WelcomeScreen(graph) {
                    nav.navigate(Routes.HOME) { popUpTo(Routes.WELCOME) { inclusive = true } }
                }
            }
            composable(Routes.HOME) { HomeScreen(graph, nav) }
            composable(
                Routes.EXPLORE,
                arguments = listOf(navArgument("category") { type = NavType.StringType; defaultValue = "" }),
            ) { backStack ->
                val category = backStack.arguments?.getString("category")?.takeIf { it.isNotBlank() }
                    ?.let { runCatching { BotCategory.valueOf(it) }.getOrNull() }
                ExploreScreen(graph, nav, category)
            }
            composable(
                Routes.HISTORY,
                arguments = listOf(navArgument("bot") { type = NavType.StringType; defaultValue = "" }),
            ) { backStack ->
                HistoryScreen(graph, nav, backStack.arguments?.getString("bot")?.takeIf { it.isNotBlank() })
            }
            composable(Routes.MENU) { MenuScreen(nav) }
            composable(
                Routes.CHAT,
                arguments = listOf(
                    navArgument("id") { type = NavType.LongType },
                    navArgument("bot") { type = NavType.StringType; defaultValue = "" },
                ),
            ) { backStack ->
                ChatScreen(
                    graph = graph,
                    nav = nav,
                    initialConversationId = backStack.arguments?.getLong("id") ?: -1L,
                    initialBotId = backStack.arguments?.getString("bot")?.takeIf { it.isNotBlank() },
                )
            }
            composable(Routes.SETTINGS) { SettingsScreen(graph, nav) }
            composable(Routes.API_KEYS) { ApiKeysScreen(graph, nav) }
            composable(Routes.PROFILE) { ProfileScreen(graph, nav) }
            composable(Routes.EDIT_PROFILE) { EditProfileScreen(graph, nav) }
            composable(
                Routes.BOTS,
                arguments = listOf(navArgument("creator") { type = NavType.StringType; defaultValue = "" }),
            ) { backStack ->
                BotsScreen(graph, nav, backStack.arguments?.getString("creator")?.takeIf { it.isNotBlank() })
            }
            composable(
                Routes.CREATE_BOT,
                arguments = listOf(
                    navArgument("edit") { type = NavType.StringType; defaultValue = "" },
                    navArgument("base") { type = NavType.StringType; defaultValue = "" },
                ),
            ) { backStack ->
                CreateBotScreen(
                    graph, nav,
                    editId = backStack.arguments?.getString("edit")?.takeIf { it.isNotBlank() },
                    baseId = backStack.arguments?.getString("base")?.takeIf { it.isNotBlank() },
                )
            }
            composable(
                Routes.BOT_DETAILS,
                arguments = listOf(navArgument("id") { type = NavType.StringType }),
            ) { backStack ->
                BotDetailsScreen(graph, nav, backStack.arguments?.getString("id").orEmpty())
            }
            composable(Routes.CREATORS) { CreatorsScreen(graph, nav) }
            composable(Routes.SUBSCRIBE) { SubscribeScreen(nav) }
            composable(
                Routes.INFO,
                arguments = listOf(navArgument("page") { type = NavType.StringType }),
            ) { backStack ->
                InfoScreen(nav, backStack.arguments?.getString("page").orEmpty())
            }
        }
    }
}

@Composable
private fun LoeBottomBar(selected: Tab, unread: Int, onSelect: (Tab) -> Unit) {
    val colors = LoeTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .background(colors.background)
            .navigationBarsPadding()
            .height(70.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Tab.entries.forEach { tab ->
            val isSelected = tab == selected
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .selectable(
                        selected = isSelected,
                        onClick = { onSelect(tab) },
                        role = Role.Tab,
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box(
                    Modifier
                        .size(width = 64.dp, height = 32.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(if (isSelected) colors.pill else Color.Transparent),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        tab.icon,
                        contentDescription = null,
                        tint = if (isSelected) colors.text else colors.textTertiary,
                        modifier = Modifier.size(24.dp),
                    )
                    if (tab == Tab.HISTORY && unread > 0) {
                        Box(Modifier.matchParentSize()) {
                            CountBadge(unread, Modifier.offset(x = 33.dp, y = (-3).dp), size = 20.dp)
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    tab.label,
                    fontSize = 12.5.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    color = if (isSelected) colors.text else colors.textTertiary,
                )
            }
        }
    }
}
