package com.loe.chat.ui.subscribe

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.LoeAppIcon
import com.loe.chat.ui.components.LoeCard
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.theme.LoeTheme

@Composable
fun SubscribeScreen(nav: NavController) {
    val colors = LoeTheme.colors
    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar("Subscribe", onBack = { nav.popBackStack() })
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.height(12.dp))
            LoeAppIcon(88.dp)
            Spacer(Modifier.height(18.dp))
            Text("Loe is free", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = colors.text)
            Spacer(Modifier.height(8.dp))
            Text(
                "No subscription needed. Loe uses your own API keys, so you pay AI providers directly, only for what you use.",
                fontSize = 17.sp, color = colors.textSecondary, textAlign = TextAlign.Center, lineHeight = 24.sp,
            )
            Spacer(Modifier.height(24.dp))
            listOf(
                "Chat with 20+ official bots: GPT, Claude, Gemini, Grok, DeepSeek and Perplexity",
                "Make images with GPT-Image and Nano-Banana",
                "Create your own bots with custom prompts",
                "Attach photos and files, use your voice, and stop or retry any reply",
                "Your chats stay on your phone",
            ).forEach { feature ->
                Row(Modifier.fillMaxWidth().padding(vertical = 7.dp), verticalAlignment = Alignment.Top) {
                    Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = colors.primary, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(12.dp))
                    Text(feature, fontSize = 17.sp, color = colors.text, lineHeight = 23.sp)
                }
            }
            Spacer(Modifier.height(20.dp))
            LoeCard(color = colors.chipSelectedBg) {
                Text("Recommended: OpenRouter", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.chipSelectedText)
                Text("One key unlocks every bot on Loe.", fontSize = 15.sp, color = colors.text)
                Spacer(Modifier.height(10.dp))
                Text("Free option: Google Gemini", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.chipSelectedText)
                Text("A free Google AI Studio key powers Assistant and the Gemini bots.", fontSize = 15.sp, color = colors.text)
            }
            Spacer(Modifier.height(20.dp))
            PrimaryButton("Set up API keys", onClick = { nav.navigate(Routes.API_KEYS) })
            Spacer(Modifier.height(28.dp))
        }
    }
}
