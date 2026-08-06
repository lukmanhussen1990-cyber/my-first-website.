package com.alarmhandler.app.ui.ring

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.net.toUri
import androidx.lifecycle.lifecycleScope
import com.alarmhandler.app.alarm.AlarmIntents
import com.alarmhandler.app.alarm.RingingState
import com.alarmhandler.app.data.ServiceLocator
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.ui.theme.AlarmHandlerTheme
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle

/**
 * The full-screen alarm.
 *
 * It has to appear over the lock screen with the display off, so it turns the
 * screen on itself and asks the keyguard to stand aside. `showWhenLocked` and
 * `turnScreenOn` are also declared in the manifest, which is what lets the
 * system launch it straight from the full-screen intent.
 */
class AlarmRingActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        ServiceLocator.init(applicationContext)

        val settingsFlow = ServiceLocator.settings.settings.stateIn(
            scope = lifecycleScope,
            started = SharingStarted.Eagerly,
            initialValue = AppSettings(),
        )

        setContent {
            val settings by settingsFlow.collectAsStateWithLifecycle()
            AlarmHandlerTheme(settings) {
                AlarmRingScreen(
                    settings = settings,
                    onFinished = { finishAndRemoveTask() },
                )
            }
        }
    }

    private fun showOverLockScreen() {
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
            runCatching { keyguard?.requestDismissKeyguard(this, null) }
        }
    }

    /** The back gesture must not be a way to silence an alarm. */
    override fun onBackPressed() {
        if (!RingingState.isRinging) {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    companion object {
        fun intent(context: Context, alarmId: Long): Intent =
            Intent(context, AlarmRingActivity::class.java).apply {
                // Distinct data keeps each alarm's pending intent separate.
                data = "alarmhandler://ring/$alarmId".toUri()
                putExtra(AlarmIntents.EXTRA_ALARM_ID, alarmId)
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_NO_HISTORY
                )
            }
    }
}
