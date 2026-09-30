package com.runova.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.runova.app.ui.theme.Runova

/** Labelled single-line text field in the RUNOVA style. */
@Composable
fun RunovaTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboardType: KeyboardType = KeyboardType.Text,
    secret: Boolean = false,
    supporting: String? = null,
) {
    val c = Runova.colors
    Column(modifier.fillMaxWidth()) {
        Text(label, style = Runova.type.label, color = c.textSecondary, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .height(56.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(c.surfaceHigh)
                .border(1.dp, c.border, RoundedCornerShape(18.dp))
                .padding(horizontal = 18.dp),
            contentAlignment = Alignment.CenterStart,
        ) {
            if (value.isEmpty()) Text(placeholder, style = Runova.type.body, color = c.textTertiary)
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                singleLine = true,
                textStyle = Runova.type.body.copy(color = c.textPrimary),
                cursorBrush = SolidColor(c.lime),
                keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
                visualTransformation = if (secret) PasswordVisualTransformation() else VisualTransformation.None,
                modifier = Modifier.fillMaxWidth().semantics { contentDescription = label },
            )
        }
        if (supporting != null) {
            Text(supporting, style = Runova.type.bodyS, color = c.textTertiary, modifier = Modifier.padding(start = 4.dp, top = 6.dp))
        }
    }
}

/** Value with minus / plus buttons. */
@Composable
fun StepperField(
    label: String,
    valueText: String,
    onMinus: () -> Unit,
    onPlus: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val c = Runova.colors
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(c.surfaceHigh)
            .border(1.dp, c.border, RoundedCornerShape(18.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(label, style = Runova.type.label, color = c.textSecondary)
            Text(valueText, style = Runova.type.metricS, color = c.textPrimary)
        }
        CircleIconButton(Icons.Rounded.Remove, "Decrease $label", onMinus, size = 40.dp, background = c.surface, tint = c.textPrimary)
        Spacer(Modifier.width(8.dp))
        CircleIconButton(Icons.Rounded.Add, "Increase $label", onPlus, size = 40.dp, background = c.lime, tint = c.onLime)
    }
}

/** Compact chips for picking one option. */
@Composable
fun ChoiceChips(options: List<String>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val c = Runova.colors
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEachIndexed { i, label ->
            val active = i == selected
            Box(
                Modifier
                    .weight(1f)
                    .height(46.dp)
                    .clip(CircleShape)
                    .background(if (active) c.lime else c.surfaceHigh)
                    .border(1.dp, if (active) Color.Transparent else c.border, CircleShape)
                    .clickable(role = Role.RadioButton) { onSelect(i) },
                contentAlignment = Alignment.Center,
            ) {
                Text(label, style = Runova.type.label.copy(fontWeight = FontWeight.Bold), color = if (active) c.onLime else c.textPrimary, maxLines = 1)
            }
        }
    }
}

@Composable
fun SectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(text.uppercase(), style = Runova.type.caption.copy(fontWeight = FontWeight.Bold), color = Runova.colors.textTertiary, modifier = modifier.padding(start = 6.dp, top = 18.dp, bottom = 8.dp))
}
