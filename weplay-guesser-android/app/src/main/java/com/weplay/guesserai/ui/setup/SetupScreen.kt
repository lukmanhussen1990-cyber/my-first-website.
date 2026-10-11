package com.weplay.guesserai.ui.setup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.weplay.guesserai.AppContainer
import com.weplay.guesserai.ui.AppViewModels
import com.weplay.guesserai.ui.components.AppLogo
import com.weplay.guesserai.ui.components.GlassCard
import com.weplay.guesserai.ui.theme.Bad
import com.weplay.guesserai.ui.theme.Ok
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import androidx.compose.runtime.collectAsState

data class SetupUiState(
    val apiKey: String = "",
    val baseUrl: String = "",
    val testing: Boolean = false,
    val result: String? = null,
    val success: Boolean = false,
)

class SetupViewModel(private val container: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(
        container.settings.current.let { SetupUiState(apiKey = it.apiKey, baseUrl = it.baseUrl) }
    )
    val state = _state.asStateFlow()

    fun onKey(v: String) = _state.update { it.copy(apiKey = v.trim(), result = null, success = false) }
    fun onBaseUrl(v: String) = _state.update { it.copy(baseUrl = v.trim(), result = null, success = false) }

    fun test() {
        val s = _state.value
        if (s.apiKey.isBlank()) { _state.update { it.copy(result = "Enter your API key first", success = false) }; return }
        _state.update { it.copy(testing = true, result = null) }
        viewModelScope.launch {
            val trial = container.settings.current.copy(apiKey = s.apiKey, baseUrl = s.baseUrl)
            val r = container.visionAnalyzer.testConnection(trial)
            _state.update {
                it.copy(
                    testing = false,
                    success = r.isSuccess,
                    result = r.fold({ msg -> "✓ $msg" }, { e -> "✗ ${e.message ?: "Connection failed"}" }),
                )
            }
        }
    }

    fun save() = container.settings.update { it.copy(apiKey = _state.value.apiKey, baseUrl = _state.value.baseUrl) }
}

@Composable
fun SetupScreen(onDone: () -> Unit, vm: SetupViewModel = viewModel(factory = AppViewModels.Factory)) {
    val s by vm.state.collectAsState()
    var showKey by remember { mutableStateOf(false) }
    var advanced by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(rememberScrollState()).padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Spacer(Modifier.height(24.dp))
        AppLogo(104.dp)
        Text("WePlay Drawing Guesser AI", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
        Text(
            "A floating AI assistant that watches the drawing and suggests answers in real time.",
            color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, fontSize = 14.sp,
        )
        Spacer(Modifier.height(4.dp))
        GlassCard {
            Text("Claude API key", fontWeight = FontWeight.SemiBold)
            Text(
                "Create one at console.anthropic.com. It is stored encrypted on this phone and only sent to the API endpoint below.",
                color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp,
            )
            OutlinedTextField(
                value = s.apiKey, onValueChange = vm::onKey, singleLine = true,
                label = { Text("API Key") }, placeholder = { Text("sk-ant-…") },
                visualTransformation = if (showKey) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                trailingIcon = { TextButton(onClick = { showKey = !showKey }) { Text(if (showKey) "Hide" else "Show") } },
                modifier = Modifier.fillMaxWidth(),
            )
            TextButton(onClick = { advanced = !advanced }) { Text(if (advanced) "Hide advanced ▴" else "Advanced: custom endpoint ▾") }
            if (advanced) {
                OutlinedTextField(
                    value = s.baseUrl, onValueChange = vm::onBaseUrl, singleLine = true,
                    label = { Text("API base URL") },
                    supportingText = { Text("Any Anthropic-compatible Messages API") },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            OutlinedButton(onClick = vm::test, enabled = !s.testing, modifier = Modifier.fillMaxWidth()) {
                if (s.testing) CircularProgressIndicator(Modifier.height(18.dp), strokeWidth = 2.dp) else Text("Test connection")
            }
            s.result?.let { Text(it, color = if (s.success) Ok else Bad, fontSize = 13.sp) }
        }
        Button(
            onClick = { vm.save(); onDone() },
            enabled = s.apiKey.isNotBlank(),
            modifier = Modifier.fillMaxWidth().height(52.dp),
        ) { Text("Continue", fontWeight = FontWeight.Bold) }
    }
}
