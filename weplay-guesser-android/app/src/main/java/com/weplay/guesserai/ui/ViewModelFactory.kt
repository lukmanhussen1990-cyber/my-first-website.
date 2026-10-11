package com.weplay.guesserai.ui

import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.ui.history.HistoryViewModel
import com.weplay.guesserai.ui.home.HomeViewModel
import com.weplay.guesserai.ui.permissions.PermissionsViewModel
import com.weplay.guesserai.ui.settings.SettingsViewModel
import com.weplay.guesserai.ui.setup.SetupViewModel

object AppViewModels {
    val Factory: ViewModelProvider.Factory = viewModelFactory {
        initializer { SetupViewModel(app().container) }
        initializer { PermissionsViewModel(app()) }
        initializer { HomeViewModel(app()) }
        initializer { SettingsViewModel(app()) }
        initializer { HistoryViewModel(app().container) }
    }

    private fun androidx.lifecycle.viewmodel.CreationExtras.app() = this[APPLICATION_KEY] as WePlayGuesserApp
}
