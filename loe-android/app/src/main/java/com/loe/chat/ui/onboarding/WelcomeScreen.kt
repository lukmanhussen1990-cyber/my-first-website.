package com.loe.chat.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.loe.chat.AppGraph
import com.loe.chat.ui.components.LoeAppIcon
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.theme.LoeTheme

/** First launch: a name for the profile (stored on the device only). */
@Composable
fun WelcomeScreen(graph: AppGraph, onDone: () -> Unit) {
    val colors = LoeTheme.colors
    var name by rememberSaveable { mutableStateOf(graph.settings.current.profile.name) }
    var email by rememberSaveable { mutableStateOf(graph.settings.current.emails.firstOrNull().orEmpty()) }
    val fieldColors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, cursorColor = colors.primary, focusedLabelColor = colors.link)

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .statusBarsPadding()
            .navigationBarsPadding()
            .imePadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Spacer(Modifier.height(72.dp))
        LoeAppIcon(104.dp)
        Spacer(Modifier.height(28.dp))
        Text("Welcome to Loe", fontSize = 30.sp, fontWeight = FontWeight.Bold, color = colors.text)
        Spacer(Modifier.height(10.dp))
        Text(
            "Chat with GPT, Claude, Gemini, Grok, DeepSeek and more — all in one app.",
            fontSize = 17.sp,
            color = colors.textSecondary,
            textAlign = TextAlign.Center,
            lineHeight = 24.sp,
        )
        Spacer(Modifier.height(36.dp))
        OutlinedTextField(
            value = name,
            onValueChange = { name = it.take(50) },
            label = { Text("Your name") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            colors = fieldColors,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it.trim() },
            label = { Text("Email (optional)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            colors = fieldColors,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(24.dp))
        PrimaryButton(
            "Continue",
            enabled = name.isNotBlank(),
            onClick = {
                val validEmail = email.takeIf { android.util.Patterns.EMAIL_ADDRESS.matcher(it).matches() }
                graph.settings.completeOnboarding(name, validEmail)
                onDone()
            },
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "Your profile is saved only on this phone. Next, add an API key in Settings to start chatting.",
            fontSize = 14.sp,
            color = colors.textSecondary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(32.dp))
    }
}
