package com.weplay.guesserai.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
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
import com.weplay.guesserai.data.ai.ClaudeVisionClient
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.CaptureSpeed
import com.weplay.guesserai.domain.OverlaySize
import com.weplay.guesserai.service.GameAppMonitor
import com.weplay.guesserai.ui.AppViewModels
import com.weplay.guesserai.ui.components.GlassCard
import com.weplay.guesserai.ui.components.SectionTitle
import com.weplay.guesserai.ui.theme.Bad
import com.weplay.guesserai.ui.theme.Ok
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(private val app: WePlayGuesserApp) : AndroidViewModel(app) {
    private val c = app.container
    val settings = c.settings.settings
    val keySaved = c.settings.keySaved
    private val _test = MutableStateFlow<Pair<Boolean, String>?>(null)
    val test = _test.asStateFlow()
    private val _wePlayApps = MutableStateFlow<List<Pair<String, String>>?>(null)
    /** Installed WePlay apps; null while the scan runs (it loads every launcher app's label). */
    val wePlayApps = _wePlayApps.asStateFlow()
    private val _builtInWordCount = MutableStateFlow<Int?>(null)
    val builtInWordCount = _builtInWordCount.asStateFlow()

    init {
        viewModelScope.launch(Dispatchers.IO) {
            _builtInWordCount.value = c.wordBank.builtInCount
            _wePlayApps.value = GameAppMonitor.findWePlayApps(app)
        }
    }

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
    val keySaved by vm.keySaved.collectAsState()
    val wePlayApps by vm.wePlayApps.collectAsState()
    val builtInWordCount by vm.builtInWordCount.collectAsState()
    var keyDraft by remember { mutableStateOf(s.apiKey) }
    var showKey by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back" }) { Text("‹ Back") }
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
                supportingText = if (keySaved) null else {
                    { Text("This phone's secure storage failed, so the key is only kept until the app closes.", color = Bad) }
                },
                modifier = Modifier.fillMaxWidth(),
            )
            val urlOk = s.baseUrl.isBlank() || ClaudeVisionClient.isHttpUrl(s.baseUrl.trim().trimEnd('/'))
            OutlinedTextField(
                value = s.baseUrl, onValueChange = { v -> vm.update { it.copy(baseUrl = v.trim()) } },
                label = { Text("API base URL") }, singleLine = true, isError = !urlOk,
                supportingText = {
                    Text(if (urlOk) "Default: ${AppSettings.DEFAULT_BASE_URL}" else "Enter a full address, like ${AppSettings.DEFAULT_BASE_URL}")
                },
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedButton(onClick = vm::testConnection) { Text("Test connection") }
            test?.let { (ok, msg) -> Text(msg, color = if (ok) Ok else Bad, fontSize = 13.sp) }
        }

        SectionTitle("Model (Claude Vision)")
        GlassCard {
            AiModel.entries.forEach { m ->
                // The whole row is the option, read out once with its label.
                Row(
                    Modifier.fillMaxWidth().selectable(selected = s.model == m, role = Role.RadioButton, onClick = { vm.update { it.copy(model = m) } }),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = s.model == m, onClick = null)
                    Column {
                        Text(m.label, fontWeight = FontWeight.Medium)
                        Text(if (m.id.isNotEmpty()) "${m.id} • ${m.note}" else m.note, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                    }
                }
            }
            if (s.model == AiModel.CUSTOM) {
                OutlinedTextField(
                    value = s.customModelId, onValueChange = { v -> vm.update { it.copy(customModelId = v.trim()) } },
                    label = { Text("Model ID") }, singleLine = true, isError = s.customModelId.isBlank(),
                    supportingText = if (s.customModelId.isBlank()) ({ Text("Enter the model ID, e.g. ${AiModel.SONNET.id}") }) else null,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            Text(
                "Haiku answers fastest and costs the least. If your key has no Haiku access the app switches to Opus automatically.",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp,
            )
            SwitchRow(
                "Fast mode",
                "Answer without extended thinking (Haiku and Sonnet). Much quicker guesses.",
                s.fastMode,
            ) { v -> vm.update { it.copy(fastMode = v) } }
            SwitchRow(
                "Accuracy boost",
                "Haiku answers instantly; Claude Sonnet 5.5 double-checks the drawing every few seconds. " +
                    "More accurate, costs a little more.",
                s.accuracyBoost,
            ) { v -> vm.update { it.copy(accuracyBoost = v) } }
        }

        SectionTitle("Word list")
        GlassCard {
            Text(
                "The AI is told which common answers fit the hint (1 letter → A, 2 letters → TV, GO, AC, CD, DJ, " +
                    "2 words • 8 letters → Free Fire …) and they fill the list when it runs short. " +
                    "Add your own words below, one per line; add |90 to rank one higher (e.g. Free Fire|90).",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp,
            )
            builtInWordCount?.let { Text("$it built-in words", color = MaterialTheme.colorScheme.tertiary, fontSize = 12.sp) }
            OutlinedTextField(
                value = s.customWords, onValueChange = { v -> vm.update { it.copy(customWords = v) } },
                label = { Text("My words") }, placeholder = { Text("Free Fire\nTV\nMobile Legends") },
                minLines = 3, maxLines = 8, modifier = Modifier.fillMaxWidth(),
            )
        }

        SectionTitle("Overlay")
        GlassCard {
            Text("Window size", fontWeight = FontWeight.Medium)
            ChipRow {
                OverlaySize.entries.forEach { size ->
                    FilterChip(
                        selected = s.overlaySize == size,
                        onClick = { vm.update { it.copy(overlaySize = size) } },
                        label = { Text(size.label, maxLines = 1, softWrap = false) },
                    )
                }
            }
            Text(s.overlaySize.note, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            SwitchRow(
                "Keep window off the drawing",
                "The AI cannot see strokes under the window, so it moves below the drawing when dropped on it.",
                s.keepOffDrawing,
            ) { v -> vm.update { it.copy(keepOffDrawing = v) } }
        }

        SectionTitle("Capture speed")
        GlassCard {
            ChipRow {
                CaptureSpeed.entries.forEach { sp ->
                    FilterChip(
                        selected = s.captureSpeed == sp,
                        onClick = { vm.update { it.copy(captureSpeed = sp) } },
                        label = { Text(sp.label, maxLines = 1, softWrap = false) },
                    )
                }
            }
            Text(
                "Time between captures. Unchanged frames are never sent.",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp,
            )
        }

        SectionTitle("Game & battery")
        GlassCard {
            Text("WePlay app", fontWeight = FontWeight.Medium)
            if (wePlayApps?.isEmpty() == true) {
                Text("WePlay was not found on this phone. Enter its package name if it is installed.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            }
            wePlayApps.orEmpty().forEach { (pkg, label) ->
                Row(
                    Modifier.fillMaxWidth().selectable(selected = s.gamePackage == pkg, role = Role.RadioButton, onClick = { vm.update { it.copy(gamePackage = pkg) } }),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = s.gamePackage == pkg, onClick = null)
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

/** Chips that move to a second line on a narrow phone instead of squeezing their labels ("5 / second / s"). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChipRow(content: @Composable () -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { content() }
}

@Composable
private fun SwitchRow(title: String, body: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    // The whole row toggles, so the title is a touch target too and screen readers say what is switched.
    Row(
        Modifier.fillMaxWidth().toggleable(value = checked, role = Role.Switch, onValueChange = onChange),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, fontWeight = FontWeight.Medium)
            Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        }
        Switch(checked = checked, onCheckedChange = null)
    }
}
