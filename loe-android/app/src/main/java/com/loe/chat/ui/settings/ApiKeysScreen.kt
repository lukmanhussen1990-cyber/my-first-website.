package com.loe.chat.ui.settings

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.ai.ApiException
import com.loe.chat.data.Provider
import com.loe.chat.ui.components.LoeCard
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Intents
import com.loe.chat.util.Toasts
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ApiKeysScreen(graph: AppGraph, nav: NavController) {
    val colors = LoeTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val settings by graph.settings.state.collectAsState()
    var editing by remember { mutableStateOf<Provider?>(null) }
    var testing by remember { mutableStateOf<Provider?>(null) }

    fun test(provider: Provider, key: String) {
        testing = provider
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                try {
                    graph.ai.testKey(provider, key)
                } catch (e: ApiException) {
                    "⚠️ " + e.message
                } catch (e: Exception) {
                    "⚠️ Couldn't check the key: ${e.message}"
                }
            }
            testing = null
            Toasts.show(context, result)
        }
    }

    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar("API keys", onBack = { nav.popBackStack() })
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                "Loe talks to AI providers straight from your phone with your own API keys. " +
                    "Keys are stored only on this device and are sent only to the provider they belong to.",
                fontSize = 16.sp, color = colors.textSecondary, lineHeight = 22.sp,
            )
            LoeCard(color = colors.chipSelectedBg) {
                Text("Which key should I get?", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.chipSelectedText)
                Spacer(Modifier.height(6.dp))
                Text(
                    "• Easiest: one OpenRouter key works with every bot on Loe.\n" +
                        "• Free option: a Google Gemini key from Google AI Studio (free tier) powers Assistant and the Gemini bots.\n" +
                        "• Already pay for one provider? Add that key and its bots will use it directly.",
                    fontSize = 15.sp, color = colors.text, lineHeight = 22.sp,
                )
            }
            Provider.entries.forEach { provider ->
                val key = settings.key(provider)
                LoeCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(provider.displayName, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = colors.text, modifier = Modifier.weight(1f))
                        if (key != null) {
                            Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = colors.primary, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Connected", fontSize = 14.sp, color = colors.link, fontWeight = FontWeight.SemiBold)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(provider.blurb, fontSize = 15.sp, color = colors.textSecondary, lineHeight = 21.sp)
                    if (key != null) {
                        Spacer(Modifier.height(6.dp))
                        Text("Key: ${mask(key)}", fontSize = 15.sp, color = colors.text)
                    }
                    Spacer(Modifier.height(12.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        SmallAction(if (key == null) "Add key" else "Change", primary = key == null) { editing = provider }
                        if (key != null) {
                            if (testing == provider) {
                                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp, color = colors.primary)
                            } else {
                                SmallAction("Test") { test(provider, key) }
                            }
                            SmallAction("Remove") {
                                graph.settings.setApiKey(provider, null)
                                Toasts.show(context, "${provider.displayName} key removed")
                            }
                        }
                        Spacer(Modifier.weight(1f))
                        Row(
                            Modifier.clip(RoundedCornerShape(8.dp)).clickable { Intents.openUrl(context, provider.keyUrl) }.padding(4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("Get a key", fontSize = 15.sp, color = colors.link)
                            Spacer(Modifier.width(2.dp))
                            Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = null, tint = colors.link, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }
    }

    editing?.let { provider ->
        KeyDialog(
            provider = provider,
            initial = settings.key(provider).orEmpty(),
            onSave = { value ->
                graph.settings.setApiKey(provider, value)
                editing = null
                if (value.isNotBlank()) test(provider, value.trim())
            },
            onDismiss = { editing = null },
        )
    }
}

@Composable
private fun KeyDialog(provider: Provider, initial: String, onSave: (String) -> Unit, onDismiss: () -> Unit) {
    val colors = LoeTheme.colors
    var value by remember { mutableStateOf(initial) }
    var visible by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = colors.background,
        title = { Text("${provider.displayName} API key", fontWeight = FontWeight.Bold) },
        text = {
            Column {
                Text("Paste the key you created on the provider's website.", color = colors.textSecondary, fontSize = 15.sp)
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = value,
                    onValueChange = { value = it.trim() },
                    placeholder = { Text(provider.keyHint) },
                    singleLine = true,
                    visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    trailingIcon = {
                        IconButton(onClick = { visible = !visible }) {
                            Icon(if (visible) Icons.Rounded.VisibilityOff else Icons.Rounded.Visibility, contentDescription = "Show key")
                        }
                    },
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, cursorColor = colors.primary),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(value) }, enabled = value.isNotBlank()) {
                Text("Save", color = colors.link, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = colors.textSecondary) } },
    )
}

@Composable
private fun SmallAction(label: String, primary: Boolean = false, onClick: () -> Unit) {
    val colors = LoeTheme.colors
    Text(
        label,
        modifier = Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(if (primary) colors.primary else colors.pill)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp),
        color = if (primary) colors.onPrimary else colors.text,
        fontSize = 15.sp,
        fontWeight = FontWeight.SemiBold,
    )
}

private fun mask(key: String): String = if (key.length <= 8) "••••" else key.take(4) + "••••••" + key.takeLast(4)
