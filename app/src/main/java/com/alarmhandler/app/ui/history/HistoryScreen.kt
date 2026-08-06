package com.alarmhandler.app.ui.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.alarmhandler.app.R
import com.alarmhandler.app.data.ServiceLocator
import com.alarmhandler.app.data.db.AlarmHistoryEntry
import com.alarmhandler.app.data.db.HistoryAction
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.data.repo.HistoryRepository
import com.alarmhandler.app.ui.components.Mascot
import com.alarmhandler.app.ui.components.MascotMood
import com.alarmhandler.app.ui.components.PixelOutlineButton
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.ui.components.PixelTopBar
import com.alarmhandler.app.util.TimeFormat
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class HistoryViewModel(private val repository: HistoryRepository) : ViewModel() {

    val entries: StateFlow<List<AlarmHistoryEntry>> = repository.recent.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = emptyList(),
    )

    fun clear() {
        viewModelScope.launch { repository.clear() }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { HistoryViewModel(ServiceLocator.history) }
        }
    }
}

/** Everything the Alarm Handler has done, newest first. */
@Composable
fun HistoryScreen(
    settings: AppSettings,
    onBack: () -> Unit,
    viewModel: HistoryViewModel = viewModel(factory = HistoryViewModel.Factory),
) {
    val entries by viewModel.entries.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val use24Hour = TimeFormat.use24Hour(context, settings.clockFormat)

    Column(
        Modifier
            .fillMaxSize()
            .padding(top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding())
    ) {
        PixelTopBar(title = stringResource(R.string.history), onBack = onBack)

        if (entries.isEmpty()) {
            Column(
                Modifier
                    .fillMaxSize()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Mascot(
                    mood = MascotMood.SITTING,
                    contentDescription = stringResource(R.string.cd_mascot),
                    modifier = Modifier.size(150.dp, 100.dp),
                )
                Spacer(Modifier.height(16.dp))
                Text(
                    text = "Nothing to report yet.",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Once an alarm rings, everything I do lands here.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            return@Column
        }

        LazyColumn(
            Modifier.weight(1f),
            contentPadding = PaddingValues(vertical = 8.dp),
        ) {
            items(entries, key = { it.id }) { entry ->
                HistoryRow(entry = entry, use24Hour = use24Hour)
            }
        }

        PixelOutlineButton(
            text = "Clear history",
            onClick = viewModel::clear,
            modifier = Modifier.padding(
                start = 16.dp,
                end = 16.dp,
                bottom = 16.dp + WindowInsets.navigationBars.asPaddingValues()
                    .calculateBottomPadding(),
            ),
        )
    }
}

@Composable
private fun HistoryRow(entry: AlarmHistoryEntry, use24Hour: Boolean) {
    PixelSurface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 5.dp),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = actionLabel(entry.action),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = entry.label.ifBlank { "Alarm" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = TimeFormat.dateTime(entry.happenedAt, use24Hour),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (entry.snoozeCount > 0) {
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "×${entry.snoozeCount} snoozed",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

private fun actionLabel(action: HistoryAction): String = when (action) {
    HistoryAction.RANG -> "Rang"
    HistoryAction.SNOOZED -> "Snoozed"
    HistoryAction.DISMISSED -> "Dismissed"
    HistoryAction.MISSED -> "Missed — rang out with no answer"
    HistoryAction.SKIPPED -> "Skipped"
}
