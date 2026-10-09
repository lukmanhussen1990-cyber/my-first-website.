package com.loe.chat.ui.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.AccountBalance
import androidx.compose.material.icons.outlined.AddReaction
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Reviews
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.SmartToy
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.DiscordMark
import com.loe.chat.ui.components.LoeIcons
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Intents

/** Social links shown at the bottom of the menu. Change these to your own pages. */
object LoeLinks {
    const val X_URL = "https://x.com"
    const val DISCORD_URL = "https://discord.com"
}

@Composable
fun MenuScreen(nav: NavController) {
    val colors = LoeTheme.colors
    val context = LocalContext.current
    Column(
        Modifier
            .fillMaxSize()
            .background(colors.menuBackground)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            "Menu",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = colors.text,
            modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 0.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        MenuCard {
            MenuRow(Icons.Outlined.SmartToy, "Bots") { nav.navigate(Routes.bots()) }
            MenuRow(Icons.Outlined.AddReaction, "Create") { nav.navigate(Routes.createBot()) }
            MenuRow(Icons.Outlined.AccountBalance, "Creators") { nav.navigate(Routes.CREATORS) }
        }
        MenuCard {
            MenuRow(Icons.Outlined.Person, "Profile") { nav.navigate(Routes.PROFILE) }
            MenuRow(Icons.Outlined.Reviews, "Subscribe") { nav.navigate(Routes.SUBSCRIBE) }
            MenuRow(Icons.Outlined.Settings, "Settings") { nav.navigate(Routes.SETTINGS) }
        }
        MenuCard {
            MenuRow(Icons.AutoMirrored.Outlined.Send, "Send feedback") {
                Intents.email(context, to = null, subject = "Loe feedback")
            }
        }
        MenuCard {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { Intents.openUrl(context, LoeLinks.X_URL) }
                    .padding(vertical = 16.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Follow us on", fontSize = 16.5.sp, fontWeight = FontWeight.Bold, color = colors.text)
                Spacer(Modifier.width(10.dp))
                Icon(LoeIcons.X, contentDescription = "X", tint = colors.text, modifier = Modifier.size(22.dp))
            }
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { Intents.openUrl(context, LoeLinks.DISCORD_URL) }
                    .padding(vertical = 16.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Join our", fontSize = 16.5.sp, fontWeight = FontWeight.Bold, color = colors.text)
                Spacer(Modifier.width(8.dp))
                DiscordMark(30.dp)
                Spacer(Modifier.width(6.dp))
                Text("Discord", fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF5865F2))
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun MenuCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(LoeTheme.colors.menuCard)
            .padding(vertical = 4.dp),
        content = content,
    )
}

@Composable
private fun MenuRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    val colors = LoeTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = colors.text, modifier = Modifier.size(24.dp))
        Spacer(Modifier.width(18.dp))
        Text(label, fontSize = 16.5.sp, color = colors.text)
    }
}
