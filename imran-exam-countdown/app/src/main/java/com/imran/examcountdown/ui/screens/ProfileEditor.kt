package com.imran.examcountdown.ui.screens

import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.ScrollView
import android.widget.SeekBar
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.R
import com.imran.examcountdown.data.Avatar
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.column
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.heading
import com.imran.examcountdown.ui.icon
import com.imran.examcountdown.ui.inputField
import com.imran.examcountdown.ui.label
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.row
import com.imran.examcountdown.ui.separator
import com.imran.examcountdown.ui.text
import com.imran.examcountdown.ui.widgets.AvatarView
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.CropView
import com.imran.examcountdown.ui.widgets.pillButton

/**
 * Edit the profile photo and display name. Choosing a photo opens Android's photo picker;
 * the chosen image is cropped here and only saved when Save is tapped.
 */
class ProfileEditor(private val host: MainActivity) {

    private val ctx = host
    val root = FrameLayout(ctx).apply {
        setBackgroundColor(Ui.c.bg)
        isClickable = true
    }
    private val scroll = ScrollView(ctx).apply { isVerticalScrollBarEnabled = false }
    private val column = ctx.column()

    // Edit mode
    private val avatar = AvatarView(ctx)
    private val choose = ctx.pillButton("Choose photo", R.drawable.ic_photo, ButtonStyle.SECONDARY) { host.pickPhoto() }
    private val remove = ctx.pillButton("Remove photo", R.drawable.ic_delete, ButtonStyle.DANGER) { removePhoto() }
    private val nameField = host.inputField("", "Your name", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)
    private val status = ctx.text("", 14f, Ui.c.text3) { setLineSpacing(0f, 1.3f) }
    private val editPanel = ctx.column()

    // Crop mode
    private val crop = CropView(ctx)
    private val zoom = SeekBar(ctx)
    private val cropPanel = ctx.column()

    private var pendingPhoto: Bitmap? = null
    private var removePending = false
    private var cropping = false

    init {
        val topBar = ctx.row {
            minimumHeight = dp(56)
            addView(ImageView(ctx).apply {
                setImageResource(R.drawable.ic_close)
                imageTintList = ColorStateList.valueOf(Ui.c.text)
                setPadding(dp(12), dp(12), dp(12), dp(12))
                background = Shapes.ripple(ctx, null, 24)
                contentDescription = "Close without saving"
                setOnClickListener { close() }
            }, lp(dp(48), dp(48)))
            addView(ctx.heading("Profile", 22f), lp(0, WRAP, 1f) { marginStart = dp(8) })
            addView(ctx.pillButton("Save") { save() }, lp(WRAP, WRAP))
        }
        column.addView(topBar)
        column.addView(ctx.separator(), lp(MATCH, WRAP) { topMargin = ctx.dp(8) })

        editPanel.gravity = Gravity.CENTER_HORIZONTAL
        editPanel.addView(avatar, lp(ctx.dp(132), ctx.dp(132)) { topMargin = ctx.dp(28) })
        editPanel.addView(ctx.row {
            gravity = Gravity.CENTER
            addView(choose, lp(WRAP, WRAP))
            addView(remove, lp(WRAP, WRAP) { marginStart = dp(10) })
        }, lp { topMargin = ctx.dp(22) })
        editPanel.addView(status, lp { topMargin = ctx.dp(14) })
        editPanel.addView(ctx.label("Display name"), lp { topMargin = ctx.dp(28) })
        editPanel.addView(nameField, lp { topMargin = ctx.dp(10) })
        editPanel.addView(ctx.text(
            "Your photo stays on this phone. The app uses Android’s photo picker, so it only ever sees the one photo you choose.",
            14f, Ui.c.text3,
        ) { setLineSpacing(0f, 1.3f) }, lp { topMargin = ctx.dp(16) })
        status.gravity = Gravity.CENTER

        cropPanel.addView(ctx.text("Move and zoom", 16f, Ui.c.text, Fonts.sansSemibold), lp { topMargin = ctx.dp(16) })
        cropPanel.addView(ctx.text("Drag to reposition. Pinch or use the slider to zoom.", 14f, Ui.c.text3), lp { topMargin = ctx.dp(4) })
        cropPanel.addView(FrameLayout(ctx).apply {
            background = Shapes.rounded(ctx, 16, 0xFF000000.toInt())
            clipToOutline = true
            addView(crop, flp(MATCH, MATCH))
        }, lp(MATCH, ctx.dp(320)) { topMargin = ctx.dp(14) })
        zoom.max = 100
        zoom.progressTintList = ColorStateList.valueOf(Ui.c.green)
        zoom.thumbTintList = ColorStateList.valueOf(Ui.c.green)
        zoom.contentDescription = "Zoom"
        zoom.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) {
                if (fromUser) crop.setZoom(value / 100f)
            }

            override fun onStartTrackingTouch(bar: SeekBar) = Unit
            override fun onStopTrackingTouch(bar: SeekBar) = Unit
        })
        crop.onZoomChanged = { f -> zoom.progress = (f * 100).toInt() }
        cropPanel.addView(ctx.row {
            addView(ctx.icon(R.drawable.ic_zoom, Ui.c.text2, 22))
            addView(zoom, lp(0, WRAP, 1f) { marginStart = dp(8) })
        }, lp { topMargin = ctx.dp(14) })
        cropPanel.addView(ctx.row {
            gravity = Gravity.END
            addView(ctx.pillButton("Cancel", style = ButtonStyle.GHOST) { showEdit() }, lp(WRAP, WRAP))
            addView(ctx.pillButton("Use photo", R.drawable.ic_check) { usePhoto() }, lp(WRAP, WRAP) { marginStart = dp(8) })
        }, lp { topMargin = ctx.dp(18) })

        column.addView(editPanel)
        column.addView(cropPanel)
        scroll.addView(column, FrameLayout.LayoutParams(MATCH, WRAP))
        root.addView(scroll, flp(MATCH, MATCH))
        load()
        showEdit()
    }

    private fun load() {
        val profile = host.data.profile
        nameField.setText(profile.name)
        nameField.setSelection(nameField.text.length)
        avatar.initials = profile.initials
        avatar.setPhoto(host.avatarBitmap(ctx.dp(132)))
        updateButtons()
    }

    fun applyInsets(top: Int, bottom: Int) {
        column.setPadding(ctx.dp(16), top + ctx.dp(4), ctx.dp(16), bottom + ctx.dp(24))
    }

    /** Back button: leave crop mode first, then close. */
    fun back(): Boolean {
        if (cropping) showEdit() else close()
        return true
    }

    private fun showEdit() {
        cropping = false
        editPanel.visibility = View.VISIBLE
        cropPanel.visibility = View.GONE
    }

    /** Called by the activity with the photo the picker returned (already decoded upright). */
    fun onPhotoPicked(bitmap: Bitmap?) {
        if (bitmap == null) {
            setStatus("That photo couldn’t be opened. Try a different one.")
            return
        }
        cropping = true
        editPanel.visibility = View.GONE
        cropPanel.visibility = View.VISIBLE
        crop.setBitmap(bitmap)
        zoom.progress = 0
        scroll.scrollTo(0, 0)
    }

    /** The picker was closed without choosing anything: nothing changes. */
    fun onPickCancelled() {
        setStatus("No photo chosen. Your current picture is unchanged.")
    }

    private fun usePhoto() {
        val result = crop.result(512) ?: return
        pendingPhoto = result
        removePending = false
        avatar.setPhoto(result)
        showEdit()
        setStatus("Looks good! Tap Save to keep it.")
        updateButtons()
    }

    private fun removePhoto() {
        pendingPhoto = null
        removePending = true
        avatar.setPhoto(null)
        setStatus("Photo removed. Tap Save to confirm — your initials will show instead.")
        updateButtons()
    }

    private fun updateButtons() {
        val hasPhoto = avatar.hasPhoto
        choose.text = if (hasPhoto) "Replace photo" else "Choose photo"
        remove.visibility = if (hasPhoto) View.VISIBLE else View.GONE
    }

    private fun setStatus(text: String) {
        status.text = text
        status.visibility = View.VISIBLE
    }

    private fun save() {
        val name = nameField.text.toString().trim()
        val photo = pendingPhoto
        when {
            photo != null -> if (!Avatar.save(ctx, photo)) {
                setStatus("Couldn’t save the photo. Please try again.")
                return
            }
            removePending -> Avatar.remove(ctx)
        }
        if (name.isNotEmpty() && name != host.data.profile.name) host.updateProfile(host.data.profile.copy(name = name))
        host.onAvatarChanged()
        close()
    }

    private fun close() {
        host.closeProfileEditor()
    }
}
