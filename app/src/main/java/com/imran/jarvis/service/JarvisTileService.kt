package com.imran.jarvis.service

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.imran.jarvis.MainActivity

/**
 * A "JARVIS" button in Quick Settings (swipe down from the top of the screen). One tap opens JARVIS
 * and it starts listening straight away, from anywhere on the phone.
 */
class JarvisTileService : TileService() {

    override fun onStartListening() {
        val tile = qsTile ?: return
        tile.state = Tile.STATE_ACTIVE
        tile.label = "JARVIS"
        if (Build.VERSION.SDK_INT >= 29) tile.subtitle = "Tap to talk"
        tile.updateTile()
    }

    override fun onClick() {
        if (isLocked) unlockAndRun { openListening() } else openListening()
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    private fun openListening() {
        val intent = MainActivity.listenIntent(this)
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(
                PendingIntent.getActivity(this, 4, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT),
            )
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
