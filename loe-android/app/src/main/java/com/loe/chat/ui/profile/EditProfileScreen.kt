package com.loe.chat.ui.profile

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.data.Profile
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.components.UserAvatar
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Attachments
import com.loe.chat.util.Toasts
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun EditProfileScreen(graph: AppGraph, nav: NavController) {
    val colors = LoeTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val current = graph.settings.current.profile
    var name by remember { mutableStateOf(current.name) }
    var handle by remember { mutableStateOf(current.handle) }
    var bio by remember { mutableStateOf(current.bio) }
    var avatar by remember { mutableStateOf(current.avatarPath) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) {
            scope.launch {
                val path = withContext(Dispatchers.IO) { Attachments.importAvatar(context, uri) }
                if (path != null) avatar = path else Toasts.show(context, "Couldn't use that photo.")
            }
        }
    }
    val fieldColors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, cursorColor = colors.primary, focusedLabelColor = colors.link)

    Column(Modifier.fillMaxSize().background(colors.background).imePadding()) {
        LoeTopBar("Edit profile", onBack = { nav.popBackStack() })
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                UserAvatar(Profile(avatarPath = avatar), 96.dp)
                Spacer(Modifier.height(10.dp))
                Row {
                    Text(
                        "Change photo", color = colors.link, fontWeight = FontWeight.SemiBold, fontSize = 16.sp,
                        modifier = Modifier.clickable {
                            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        }.padding(6.dp),
                    )
                    if (avatar != null) {
                        Spacer(Modifier.width(12.dp))
                        Text(
                            "Remove", color = colors.danger, fontSize = 16.sp,
                            modifier = Modifier.clickable { avatar = null }.padding(6.dp),
                        )
                    }
                }
            }
            OutlinedTextField(name, { name = it.take(50) }, label = { Text("Name") }, singleLine = true, colors = fieldColors, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                handle,
                { handle = it.removePrefix("@").filter { c -> c.isLetterOrDigit() || c == '_' || c == '.' }.take(30) },
                label = { Text("Username") },
                prefix = { Text("@") },
                singleLine = true,
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(bio, { bio = it.take(200) }, label = { Text("Bio") }, minLines = 3, colors = fieldColors, modifier = Modifier.fillMaxWidth())
            PrimaryButton(
                "Save",
                enabled = name.isNotBlank(),
                onClick = {
                    graph.settings.updateProfile(Profile(name = name, handle = handle, bio = bio, avatarPath = avatar))
                    Toasts.show(context, "Profile saved")
                    nav.popBackStack()
                },
            )
            Spacer(Modifier.height(16.dp))
        }
    }
}
