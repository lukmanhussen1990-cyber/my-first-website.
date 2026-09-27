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

/** Rounded, on-brand dialogs built from plain framework views. */
object Dialogs {

    /**
     * A card-style dialog. [build] adds the body; it receives a function that dismisses it.
     */
    fun sheet(
        activity: Activity,
        title: String,
        message: String? = null,
        build: LinearLayout.(dismiss: () -> Unit) -> Unit,
    ): Dialog {
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val card = activity.column {
            background = Shapes.rounded(context, 28, Palette.SURFACE_SOLID, Palette.STROKE_STRONG)
            setPadding(dp(24), dp(24), dp(24), dp(20))
            addView(activity.text(title, 21f, Palette.TEXT, Fonts.semibold))
            if (message != null) {
                addView(activity.text(message, 15f, Palette.TEXT_2) { setLineSpacing(0f, 1.3f) }, lp { topMargin = dp(10) })
            }
        }
        card.build { dialog.dismiss() }
        val scroll = ScrollView(activity).apply {
            isFillViewport = false
            isVerticalScrollBarEnabled = false
            addView(card)
        }
        dialog.setContentView(scroll)
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(0))
            val metrics = activity.resources.displayMetrics
            setLayout(min(metrics.widthPixels - activity.dp(32), activity.dp(440)), WindowManager.LayoutParams.WRAP_CONTENT)
            setDimAmount(0.62f)
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
        addView(row, lp { topMargin = context.dp(22) })
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
            field = EditText(context).apply {
                setText(initial)
                setHint(hint)
                this.inputType = inputType
                textSize = 17f
                typeface = Fonts.regular
                setTextColor(Palette.TEXT)
                setHintTextColor(Palette.TEXT_3)
                background = Shapes.rounded(context, 16, 0x14FFFFFF, Palette.STROKE_STRONG)
                setPadding(dp(16), dp(14), dp(16), dp(14))
                setSingleLine(true)
                imeOptions = EditorInfo.IME_ACTION_DONE
                setSelection(text.length)
                setOnEditorActionListener { _, action, _ ->
                    if (action == EditorInfo.IME_ACTION_DONE) {
                        val value = text.toString().trim()
                        if (value.isNotEmpty() || onDelete == null) {
                            onSave(value)
                            dismiss()
                        }
                        true
                    } else {
                        false
                    }
                }
            }
            addView(field, lp { topMargin = dp(18) })
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
                    setPadding(dp(14), dp(10), dp(14), dp(10))
                    background = Shapes.ripple(
                        context,
                        if (chosen) Shapes.rounded(context, 16, Palette.withAlpha(Palette.BLUE, 0.16f), Palette.withAlpha(Palette.BLUE, 0.5f)) else null,
                        16,
                    )
                    addView(
                        View(context).apply {
                            background = if (chosen) {
                                Shapes.ovalGradient(Palette.ACCENT_GRADIENT)
                            } else {
                                Shapes.oval(0, Palette.withAlpha(Palette.TEXT, 0.35f), dp(2))
                            }
                        },
                        lp(dp(18), dp(18)),
                    )
                    addView(context.text(label, 16f, Palette.TEXT, if (chosen) Fonts.semibold else Fonts.regular), lp(0, WRAP, 1f) { marginStart = dp(14) })
                    isClickable = true
                    setOnClickListener {
                        onPick(index)
                        dismiss()
                    }
                }
                list.addView(option, lp { topMargin = if (index == 0) dp(14) else dp(6) })
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
