package com.weplay.guesserai

import android.content.Context
import com.weplay.guesserai.data.HistoryRepository
import com.weplay.guesserai.data.WordBankRepository
import com.weplay.guesserai.data.ai.ClaudeVisionClient
import com.weplay.guesserai.data.db.AppDatabase
import com.weplay.guesserai.data.settings.SettingsRepository
import com.weplay.guesserai.domain.VisionAnalyzer
import kotlinx.coroutines.flow.MutableStateFlow

/** Manual dependency injection: one instance of each repository for the whole app. */
class AppContainer(context: Context) {
    val settings = SettingsRepository(context)
    private val db = AppDatabase.create(context)
    val history = HistoryRepository(context, db.drawingDao())
    val visionAnalyzer: VisionAnalyzer = ClaudeVisionClient()
    val wordBank = WordBankRepository(context)

    /** True while the overlay service is running. */
    val assistantRunning = MutableStateFlow(false)
}
