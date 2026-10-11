package com.weplay.guesserai.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.CaptureSpeed
import com.weplay.guesserai.service.GameAppMonitor
import com.weplay.guesserai.ui.AppViewModels
import com.weplay.guesserai.ui.components.GlassCard
import com.weplay.guesserai.ui.components.SectionTitle
import com.weplay.guesserai.ui.theme.Bad
import com.weplay.guesserai.ui.theme.Ok
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(private val app: WePlayGuesserApp) : AndroidViewModel(app) {
    private val c = app.container
    val settings = c.settings.settings
    private val _test = MutableStateFlow<Pair<Boolean, String>?>(null)
    val test = _test.asStateFlow()
    val wePlayApps: List<Pair<String, String>> by lazy { GameAppMonitor.findWePlayApps(app) }

    fun update(f: (AppSettings) -> AppSettings) { c.settings.update(f); _test.value = null }

    fun testConnection() {
        _test.value = true to "Testing…"
        viewModelScope.launch {
            val r = c.visionAnalyzer.testConnection(c.settings.current)
            _test.value = r.fold({ true to "✓ $it" }, { false to "✗ ${it.message ?: "Connection failed"}" })
        }
    }
}

@Composable
fun SettingsScreen(onBack: () -> Unit, vm: SettingsViewModel = viewModel(factory = AppViewModels.Factory)) {
    val s by vm.settings.collectAsState()
    val test by vm.test.collectAsState()
    var keyDraft by remember { mutableStateOf(s.apiKey) }
    var showKey by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack) { Text("‹ Back") }
            Text("Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        }

        SectionTitle("AI connection")
        GlassCard {
            OutlinedTextField(
                value = keyDraft,
                onValueChange = { keyDraft = it.trim(); vm.update { st -> st.copy(apiKey = keyDraft) } },
                label = { Text("API Key") }, singleLine = true,
                visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = { TextButton(onClick = { showKey = !showKey }) { Text(if (showKey) "Hide" else "Show") } },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = s.baseUrl, onValueChange = { v -> vm.update { it.copy(baseUrl = v.trim()) } },
                label = { Text("API base URL") }, singleLine = true,
                supportingText = { Text("Default: ${AppSettings.DEFAULT_BASE_URL}") },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedButton(onClick = vm::testConnection) { Text("Test connection") }
            test?.let { (ok, msg) -> Text(msg, color = if (ok) Ok else Bad, fontSize = 13.sp) }
        }

        SectionTitle("Model (Claude Vision)")
        GlassCard {
            AiModel.entries.forEach { m ->
                Row(
                    Modifier.fillMaxWidth().selectable(selected = s.model == m, onClick = { vm.update { it.copy(model = m) } }),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = s.model == m, onClick = { vm.update { it.copy(model = m) } })
                    Column {
                        Text(m.label, fontWeight = FontWeight.Medium)
                        Text(if (m.id.isNotEmpty()) "${m.id} • ${m.note}" else m.note, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                    }
                }
            }
            if (s.model == AiModel.CUSTOM) {
                OutlinedTextField(
                    value = s.customModelId, onValueChange = { v -> vm.update { it.copy(customModelId = v.trim()) } },
                    label = { Text("Model ID") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                )
            }
            Text(
                "Opus is the most accurate; Sonnet and Haiku answer faster and cost less per frame.",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp,
            )
        }

        SectionTitle("Capture speed")
        GlassCard {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CaptureSpeed.entries.forEach { sp ->
                    FilterChip(
                        selected = s.captureSpeed == sp,
                        onClick = { vm.update { it.copy(captureSpeed = sp) } },
                        label = { Text(sp.label) },
                    )
                }
            }
            Text(
                "Time between captures. Unchanged frames are never sent, and only one request runs at a time.",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp,
            )
        }

        SectionTitle("Game & battery")
        GlassCard {
            Text("WePlay app", fontWeight = FontWeight.Medium)
            if (vm.wePlayApps.isEmpty()) {
                Text("WePlay was not found on this phone. Enter its package name if it is installed.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            }
            vm.wePlayApps.forEach { (pkg, label) ->
                Row(
                    Modifier.fillMaxWidth().selectable(selected = s.gamePackage == pkg, onClick = { vm.update { it.copy(gamePackage = pkg) } }),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = s.gamePackage == pkg, onClick = { vm.update { it.copy(gamePackage = pkg) } })
                    Column { Text(label); Text(pkg, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp) }
                }
            }
            OutlinedTextField(
                value = s.gamePackage, onValueChange = { v -> vm.update { it.copy(gamePackage = v.trim()) } },
                label = { Text("Game package name") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
            )
            SwitchRow(
                "Pause AI when WePlay is closed",
                "Needs Usage access (Permissions screen). Saves battery and API calls.",
                s.autoPauseWhenGameClosed,
            ) { v -> vm.update { it.copy(autoPauseWhenGameClosed = v) } }
            SwitchRow(
                "Save drawing screenshots",
                "Stored privately on this phone with each answer you confirm.",
                s.saveScreenshots,
            ) { v -> vm.update { it.copy(saveScreenshots = v) } }
        }
    }
}

@Composable
private fun SwitchRow(title: String, body: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, fontWeight = FontWeight.Medium)
            Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
