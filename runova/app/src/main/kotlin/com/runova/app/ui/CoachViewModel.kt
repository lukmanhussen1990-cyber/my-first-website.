package com.runova.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.runova.app.graph
import com.runova.app.state.UiEnv
import com.runova.app.state.UiMapper
import com.runova.app.ui.model.CoachUiState
import com.runova.core.coach.CoachEngine
import com.runova.core.coach.CoachInsight
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** AI Coach: insight cards from the offline engine plus the chat. */
class CoachViewModel(app: Application) : AndroidViewModel(app) {
    private val coach = app.graph.coach

    private val insights = app.graph.repository.data
        .map { d -> CoachEngine.insights(UiMapper.coachSnapshot(d, UiEnv.system())).take(MAX_INSIGHTS) }
        .flowOn(Dispatchers.Default)

    val state: StateFlow<CoachUiState> = combine(insights, coach.messages, coach.thinking, coach.usingClaude, coach.notice) { ins: List<CoachInsight>, msgs, thinking, claude, notice ->
        CoachUiState(ins, msgs, thinking, claude, notice)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CoachUiState(emptyList(), emptyList(), false, false))

    fun send(text: String) = coach.send(text)
    fun clear() = coach.clear()

    private companion object {
        const val MAX_INSIGHTS = 4
    }
}
