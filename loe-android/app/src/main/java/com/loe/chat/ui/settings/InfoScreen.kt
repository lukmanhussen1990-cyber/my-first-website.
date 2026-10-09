package com.loe.chat.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.loe.chat.BuildConfig
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.MarkdownText
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Intents

private data class InfoPage(val title: String, val body: String)

private val pages = mapOf(
    "about" to InfoPage(
        "About",
        """
        ## Loe
        Loe brings the best AI models together in one app: GPT, Claude, Gemini, Grok, DeepSeek, Perplexity, plus image and video bots. You can also create your own bots with a custom prompt.

        Loe runs entirely on your phone. It connects to AI providers with **your own API keys**, so there's no Loe account, no Loe server and no subscription.

        Version ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})
        """,
    ),
    "privacy" to InfoPage(
        "Privacy",
        """
        ## Your data stays on your phone
        - Your profile, chats, the bots you create and your API keys are stored only on this device.
        - Loe has no servers and collects no analytics.

        ## What gets sent, and where
        When you send a message, Loe sends it (with the earlier messages the bot needs for context, and any photos or files you attach) **directly to the provider that serves that bot**: OpenRouter, Anthropic, OpenAI, Google, xAI, DeepSeek or Poe. That provider's privacy policy applies to what you send them.

        API keys are only ever sent to the provider they belong to.

        ## Deleting
        Deleting a chat removes it from this phone. It doesn't delete anything a provider may keep under their own policy.
        """,
    ),
    "terms" to InfoPage(
        "Terms of service",
        """
        - Loe is provided as is, without warranties.
        - You're responsible for your API keys and for any charges your providers bill you.
        - When you use a bot you also agree to that provider's terms and usage policies.
        - AI answers can be wrong. Check anything important (medical, legal, financial) with a qualified person.
        """,
    ),
    "guidelines" to InfoPage(
        "Usage guidelines",
        """
        - Don't use Loe for anything illegal or to harm, harass or deceive people.
        - Don't paste passwords, API keys or other secrets into chats.
        - Bots can make mistakes and can sound confident when they're wrong: double-check facts.
        - Respect the usage policies of each AI provider.
        """,
    ),
    "contact" to InfoPage(
        "Contact us",
        """
        Questions, ideas or bug reports? Tap the button below to send feedback by email, or use **Menu → Send feedback**.

        For problems with a provider (billing, keys, rate limits), contact that provider directly.
        """,
    ),
    "billing" to InfoPage(
        "How billing works",
        """
        **Loe itself is free.** The AI providers bill you for what you use with your key:

        - **OpenRouter** — buy prepaid credits once, use every bot. Some models are free.
        - **Google AI Studio (Gemini)** — has a free tier with daily limits, great for trying Loe.
        - **Anthropic, OpenAI, xAI, DeepSeek** — pay as you go on each provider's website.
        - **Poe API** — uses the points on your Poe account.

        Loe's own *compute points* are only a spending guard you control in Settings. They're not money.
        """,
    ),
    "points" to InfoPage(
        "Compute points",
        """
        Compute points are Loe's built-in **daily spending guard** for your API keys.

        - Every bot costs a set number of points per message (shown on the bot's card). Bigger models cost more.
        - **Remaining points** reset to your daily amount at midnight.
        - **Per-message budget**: bots that cost more than this won't run until you raise it, so you never send an expensive message by accident.
        - Change both in **Settings → Compute points**.

        Points are a rough guide, not real money: your provider bills you based on the tokens you actually use.
        """,
    ),
)

@Composable
fun InfoScreen(nav: NavController, page: String) {
    val colors = LoeTheme.colors
    val context = LocalContext.current
    val info = pages[page] ?: pages.getValue("about")
    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar(info.title, onBack = { nav.popBackStack() })
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
        ) {
            MarkdownText(info.body.trimIndent())
            if (page == "contact") {
                Spacer(Modifier.height(20.dp))
                PrimaryButton("Send feedback", onClick = { Intents.email(context, to = null, subject = "Loe feedback") })
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}
