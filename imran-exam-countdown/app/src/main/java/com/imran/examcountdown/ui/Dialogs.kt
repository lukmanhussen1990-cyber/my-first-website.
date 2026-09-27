package com.imran.examcountdown.ui

import android.app.Activity
import android.app.Dialog
import android.graphics.drawable.ColorDrawable
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import com.imran.examcountdown.R
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.pillButton
import kotlin.math.min

/** Dialogs built from plain framework views in the app's own style. */
object Dialogs {

    fun sheet(
        activity: Activity,
        title: String,
        message: String? = null,
        build: LinearLayout.(dismiss: () -> Unit) -> Unit,
    ): Dialog {
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val card = activity.column {
            background = Shapes.rounded(context, 22, Ui.c.surface, Ui.c.separator)
            setPadding(dp(24), dp(22), dp(24), dp(18))
            addView(activity.heading(title, 21f))
            if (message != null) {
                addView(activity.text(message, 15f, Ui.c.text2) { setLineSpacing(0f, 1.3f) }, lp { topMargin = dp(10) })
            }
        }
        card.build { dialog.dismiss() }
        val scroll = ScrollView(activity).apply {
            isVerticalScrollBarEnabled = false
            addView(card)
        }
        dialog.setContentView(scroll)
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(0))
            val metrics = activity.resources.displayMetrics
            setLayout(min(metrics.widthPixels - activity.dp(32), activity.dp(440)), WindowManager.LayoutParams.WRAP_CONTENT)
            setDimAmount(0.45f)
            addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
        }
        dialog.show()
        return dialog
    }

    /** Right-aligned action buttons for the bottom of a [sheet]. */
    fun LinearLayout.actions(vararg buttons: View) {
        val row = context.row {
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            buttons.forEachIndexed { i, b ->
                addView(b, lp(WRAP, WRAP) { if (i > 0) marginStart = context.dp(8) })
            }
        }
        addView(row, lp { topMargin = context.dp(20) })
    }

    fun editText(
        activity: Activity,
        title: String,
        initial: String,
        hint: String = "",
        inputType: Int = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS,
        onDelete: (() -> Unit)? = null,
        onSave: (String) -> Unit,
    ) {
        lateinit var field: EditText
        val dialog = sheet(activity, title) { dismiss ->
            field = activity.inputField(initial, hint, inputType)
            field.setOnEditorActionListener { _, action, _ ->
                if (action == EditorInfo.IME_ACTION_DONE) {
                    val value = field.text.toString().trim()
                    if (value.isNotEmpty() || onDelete == null) {
                        onSave(value)
                        dismiss()
                    }
                    true
                } else {
                    false
                }
            }
            addView(field, lp { topMargin = dp(16) })
            val buttons = mutableListOf<View>()
            if (onDelete != null) {
                buttons += activity.pillButton("Delete", R.drawable.ic_delete, ButtonStyle.DANGER) {
                    onDelete()
                    dismiss()
                }
            }
            buttons += activity.pillButton("Cancel", style = ButtonStyle.GHOST) { dismiss() }
            buttons += activity.pillButton("Save") {
                val value = field.text.toString().trim()
                if (value.isEmpty() && onDelete != null) return@pillButton
                onSave(value)
                dismiss()
            }
            actions(*buttons.toTypedArray())
        }
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE)
        field.requestFocus()
    }

    fun choice(
        activity: Activity,
        title: String,
        options: List<String>,
        selected: Int,
        message: String? = null,
        onPick: (Int) -> Unit,
    ) {
        sheet(activity, title, message) { dismiss ->
            val list = context.column()
            options.forEachIndexed { index, label ->
                val chosen = index == selected
                val option = context.row {
                    minimumHeight = dp(52)
                    setPadding(dp(12), dp(8), dp(12), dp(8))
                    background = Shapes.ripple(context, if (chosen) Shapes.rounded(context, 12, Ui.c.greenSoft) else null, 12)
                    addView(
                        View(context).apply {
                            background = if (chosen) {
                                Shapes.oval(Ui.c.green, Ui.c.green, dp(2))
                            } else {
                                Shapes.oval(0, Ui.c.text3, dp(2))
                            }
                        },
                        lp(dp(18), dp(18)),
                    )
                    addView(
                        context.text(label, 16f, Ui.c.text, if (chosen) Fonts.sansSemibold else Fonts.sans),
                        lp(0, WRAP, 1f) { marginStart = dp(14) },
                    )
                    isClickable = true
                    setOnClickListener {
                        onPick(index)
                        dismiss()
                    }
                }
                list.addView(option, lp { topMargin = if (index == 0) dp(12) else dp(4) })
            }
            addView(list)
            actions(activity.pillButton("Cancel", style = ButtonStyle.GHOST) { dismiss() })
        }
    }

    fun confirm(
        activity: Activity,
        title: String,
        message: String,
        confirmLabel: String,
        destructive: Boolean = false,
        onConfirm: () -> Unit,
    ) {
        sheet(activity, title, message) { dismiss ->
            actions(
                activity.pillButton("Cancel", style = ButtonStyle.GHOST) { dismiss() },
                activity.pillButton(confirmLabel, style = if (destructive) ButtonStyle.DANGER else ButtonStyle.PRIMARY) {
                    onConfirm()
                    dismiss()
                },
            )
        }
    }
}

/** A single-line text field in the app's style. */
fun Activity.inputField(initial: String, hint: String, type: Int): EditText = EditText(this).apply {
    setText(initial)
    setHint(hint)
    inputType = type
    textSize = 17f
    typeface = Fonts.sans
    setTextColor(Ui.c.text)
    setHintTextColor(Ui.c.text3)
    background = Shapes.rounded(context, 12, Ui.c.bg, Ui.c.separator, 1.5f)
    setPadding(dp(14), dp(12), dp(14), dp(12))
    setSingleLine(true)
    imeOptions = EditorInfo.IME_ACTION_DONE
    setSelection(text.length)
}
