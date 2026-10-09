package com.loe.chat.ui.bots

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.PersonAddAlt
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.rounded.HowToReg
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.ai.Router
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.BotKind
import com.loe.chat.data.Provider
import com.loe.chat.ui.Routes
import com.loe.chat.ui.chat.creatorLabel
import com.loe.chat.ui.components.BotAvatar
import com.loe.chat.ui.components.CardDivider
import com.loe.chat.ui.components.LoeCard
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.OfficialTag
import com.loe.chat.ui.components.PillButton
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.components.SettingsLabel
import com.loe.chat.ui.components.TextInputDialog
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Intents

@Composable
fun BotDetailsScreen(graph: AppGraph, nav: NavController, botId: String) {
    val colors = LoeTheme.colors
    val context = LocalContext.current
    val settings by graph.settings.state.collectAsState()
    val custom by graph.bots.customBots.collectAsState()
    val bot = remember(botId, custom) { graph.bots.getOrAssistant(botId) }
    val base = Router.baseOf(bot)
    val route = Router.resolve(bot, settings)
    val followed = bot.id in settings.followedBots
    var editModelFor by remember { mutableStateOf<Pair<Provider, String>?>(null) }

    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar(bot.name, onBack = { nav.popBackStack() })
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(8.dp))
            BotAvatar(bot, 96.dp)
            Spacer(Modifier.height(12.dp))
            Text(bot.name, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = colors.text)
            Text("By ${creatorLabel(bot, settings.profile.handle)}", fontSize = 16.sp, color = colors.link)
            if (bot.official) {
                Spacer(Modifier.height(8.dp))
                OfficialTag()
            }
            Spacer(Modifier.height(12.dp))
            Text(bot.description, fontSize = 17.sp, color = colors.text, textAlign = TextAlign.Center, lineHeight = 24.sp)
            Spacer(Modifier.height(16.dp))
            PrimaryButton("Start chat", onClick = { nav.navigate(Routes.newChat(bot.id)) })
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PillButton(
                    if (followed) "Following" else "Follow",
                    onClick = { graph.settings.setFollowed(bot.id, !followed) },
                    icon = if (followed) Icons.Rounded.HowToReg else Icons.Outlined.PersonAddAlt,
                    modifier = Modifier.weight(1f),
                )
                PillButton(
                    "Share",
                    onClick = { Intents.shareText(context, "Chat with ${bot.name} on Loe — ${bot.description}") },
                    icon = Icons.Outlined.Share,
                    modifier = Modifier.weight(1f),
                )
            }
            if (bot.isCustom || bot.kind == BotKind.TEXT) {
                Spacer(Modifier.height(10.dp))
                Text(
                    if (bot.isCustom) "Edit this bot" else "Create a bot based on ${bot.name}",
                    color = colors.link,
                    fontSize = 16.sp,
                    modifier = Modifier.clickable {
                        if (bot.isCustom) nav.navigate(Routes.createBot(editId = bot.id)) else nav.navigate(Routes.createBot(baseId = bot.id))
                    }.padding(6.dp),
                )
            }

            Column(Modifier.fillMaxWidth()) {
                SettingsLabel("Details")
                LoeCard {
                    InfoRow("Runs on", route?.let { "${it.provider.displayName} · ${it.model}" } ?: "No API key connected yet")
                    CardDivider()
                    InfoRow("Points per message", bot.points.toString())
                    if (bot.contextLabel.isNotBlank()) {
                        CardDivider()
                        InfoRow("Context window", bot.contextLabel)
                    }
                    CardDivider()
                    InfoRow(
                        "Can read images",
                        if (bot.kind == BotKind.IMAGE) "Yes (for edits)" else if (bot.vision) "Yes" else "No",
                    )
                    CardDivider()
                    InfoRow("Works with", Router.providersFor(bot).joinToString(", ") { it.displayName })
                    if (bot.isCustom) {
                        CardDivider()
                        InfoRow("Based on", base.name)
                    }
                }
                if (bot.isCustom && !bot.systemPrompt.isNullOrBlank()) {
                    SettingsLabel("Prompt")
                    LoeCard { Text(bot.systemPrompt, fontSize = 15.sp, color = colors.text, lineHeight = 21.sp) }
                }
                if (base.id != BotCatalog.ASSISTANT_ID) {
                    SettingsLabel("Model (advanced)")
                    LoeCard {
                        Text(
                            "Loe picks the model for each provider automatically. If a provider renames a model, you can change it here.",
                            fontSize = 14.sp, color = colors.textSecondary, lineHeight = 20.sp,
                        )
                        Router.candidates(base).forEach { (provider, defaultModel) ->
                            val override = settings.modelOverride(base.id, provider)
                            Spacer(Modifier.height(10.dp))
                            CardDivider()
                            Spacer(Modifier.height(10.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(provider.displayName, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.text)
                                    Text(override ?: defaultModel, fontSize = 14.sp, color = colors.textSecondary)
                                }
                                Text(
                                    "Change", color = colors.link, fontSize = 15.sp,
                                    modifier = Modifier.clickable { editModelFor = provider to (override ?: defaultModel) }.padding(6.dp),
                                )
                                if (override != null) {
                                    Text(
                                        "Reset", color = colors.textSecondary, fontSize = 15.sp,
                                        modifier = Modifier.clickable { graph.settings.setModelOverride(base.id, provider, null) }.padding(6.dp),
                                    )
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    editModelFor?.let { (provider, model) ->
        TextInputDialog(
            title = "${provider.displayName} model",
            initial = model,
            message = "Model ID to use for ${base.name} on ${provider.displayName}.",
            onConfirm = { value ->
                graph.settings.setModelOverride(base.id, provider, value)
                editModelFor = null
            },
            onDismiss = { editModelFor = null },
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    val colors = LoeTheme.colors
    Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.Top) {
        Text(label, fontSize = 16.sp, color = colors.textSecondary, modifier = Modifier.width(140.dp))
        Text(value, fontSize = 16.sp, color = colors.text, modifier = Modifier.weight(1f))
    }
}
