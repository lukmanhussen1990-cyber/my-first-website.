package com.weplay.guesserai.ui.history

import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.weplay.guesserai.AppContainer
import com.weplay.guesserai.data.db.DrawingRecord
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.ui.AppViewModels
import com.weplay.guesserai.ui.components.GlassCard
import com.weplay.guesserai.ui.theme.CyanAccent
import com.weplay.guesserai.ui.theme.NeonPink
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

class HistoryViewModel(private val c: AppContainer) : ViewModel() {
    val records = c.history.records.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    fun clear() = viewModelScope.launch { c.history.clear() }
}

@Composable
fun HistoryScreen(onBack: () -> Unit, vm: HistoryViewModel = viewModel(factory = AppViewModels.Factory)) {
    val records by vm.records.collectAsState()
    var confirm by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onBack, modifier = Modifier.semantics { contentDescription = "Back" }) { Text("‹ Back") }
            Text("Learning history", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (records.isNotEmpty()) TextButton(onClick = { confirm = true }) { Text("Clear") }
        }
        if (records.isEmpty()) {
            Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
                Text(
                    "Nothing learned yet.\n\nDuring a game, hold the right answer in the floating window to save the drawing. " +
                        "Saved answers are ranked higher and suggested to the AI in later rounds.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(records, key = { it.id }) { RecordCard(it) }
            }
        }
    }

    if (confirm) {
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text("Clear history?") },
            text = { Text("Deletes all saved drawings and everything the AI has learned.") },
            confirmButton = { TextButton(onClick = { vm.clear(); confirm = false }) { Text("Clear") } },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun RecordCard(r: DrawingRecord) {
    var thumb by remember(r.imagePath) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(r.imagePath) { thumb = loadThumbnail(r.imagePath) }
    GlassCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
                thumb?.let { Image(it, "Drawing", Modifier.size(64.dp), contentScale = ContentScale.Crop) }
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(r.correctAnswer, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Text(
                    HintPattern(r.wordCount, r.letterCount).label() + if (r.category.isNotBlank()) " • ${r.category}" else "",
                    color = CyanAccent, fontSize = 12.sp,
                )
                Text(DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(r.timestamp)),
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            }
            Text(if (r.confidence > 0) "${r.confidence}%" else "—", color = NeonPink, fontWeight = FontWeight.Bold)
        }
    }
}

private suspend fun loadThumbnail(path: String?): ImageBitmap? = if (path == null) null else withContext(Dispatchers.IO) {
    runCatching { BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = 4 })?.asImageBitmap() }.getOrNull()
}
