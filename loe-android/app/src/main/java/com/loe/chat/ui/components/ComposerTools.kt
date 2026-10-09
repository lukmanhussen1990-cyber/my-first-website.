package com.loe.chat.ui.components

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.loe.chat.data.Attachment
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Attachments
import com.loe.chat.util.Toasts
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Photo / file pickers and voice typing for a composer. */
class ComposerTools internal constructor(
    val openAttachMenu: () -> Unit,
    val startVoice: () -> Unit,
)

@Composable
fun rememberComposerTools(onAttachment: (Attachment) -> Unit, onSpeech: (String) -> Unit): Pair<ComposerTools, @Composable () -> Unit> {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showMenu by remember { mutableStateOf(false) }

    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch {
                val attachment = withContext(Dispatchers.IO) { Attachments.importImage(context, uri) }
                if (attachment != null) onAttachment(attachment) else Toasts.show(context, "Couldn't open that photo.")
            }
        }
    }
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            scope.launch {
                val attachment = withContext(Dispatchers.IO) { Attachments.importFile(context, uri) }
                if (attachment != null) onAttachment(attachment) else Toasts.show(context, "Couldn't open that file.")
            }
        }
    }
    val voice = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val text = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
            if (!text.isNullOrBlank()) onSpeech(text)
        }
    }

    val tools = remember {
        ComposerTools(
            openAttachMenu = { showMenu = true },
            startVoice = {
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak your message")
                }
                try {
                    voice.launch(intent)
                } catch (e: ActivityNotFoundException) {
                    Toasts.show(context, "Voice typing isn't available on this device.")
                }
            },
        )
    }

    val menu: @Composable () -> Unit = {
        if (showMenu) {
            ActionSheet(onDismiss = { showMenu = false }) {
                Text("Add to message", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = LoeTheme.colors.text)
                SheetActionRow(Icons.Outlined.Image, "Photo", onClick = {
                    showMenu = false
                    photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                })
                SheetActionRow(Icons.Outlined.Description, "Text file (txt, md, csv, code…)", onClick = {
                    showMenu = false
                    try {
                        filePicker.launch(arrayOf("text/*", "application/json", "application/xml", "application/javascript", "application/x-yaml"))
                    } catch (e: ActivityNotFoundException) {
                        Toasts.show(context, "No file picker found.")
                    }
                })
            }
        }
    }
    return tools to menu
}
