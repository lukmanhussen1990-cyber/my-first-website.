package com.imran.examcountdown.ui.screens

import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.drawable.ColorDrawable
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.R
import com.imran.examcountdown.core.AvatarFrame
import com.imran.examcountdown.data.Avatar
import com.imran.examcountdown.ui.Ease
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
import com.imran.examcountdown.ui.update
import com.imran.examcountdown.ui.widgets.AvatarView
import com.imran.examcountdown.ui.widgets.ButtonRow
import com.imran.examcountdown.ui.widgets.ButtonStyle
import com.imran.examcountdown.ui.widgets.CropView
import com.imran.examcountdown.ui.widgets.ToggleView
import com.imran.examcountdown.ui.widgets.pillButton

/**
 * Edit the profile photo, frame and display name. Choosing a photo opens Android's photo
 * picker; the chosen image is cropped here and only saved when Save is tapped.
 *
 * Profile frames: tapping one previews it on the large avatar at once; Apply keeps it, Cancel
 * goes back to the saved one (marked with a check), and Reset to Default restores the original
 * gold border. Save also keeps a frame that is still being previewed; closing discards it.
 */
class ProfileEditor(private val host: MainActivity) {

    private val ctx = host
    private val backdrop = ColorDrawable(Ui.c.bg)
    val root = FrameLayout(ctx).apply {
        background = backdrop
        isClickable = true
    }
    private val scroll = ScrollView(ctx).apply { isVerticalScrollBarEnabled = false }
    private val column = ctx.column()

    /** The large avatar; the photo flies in from (and back to) the avatar that was tapped. */
    val avatar = AvatarView(ctx).apply {
        contentDescription = "Your profile photo and frame"
    }
    private val avatarHolder = FrameLayout(ctx).apply {
        addView(avatar, flp(ctx.dp(150), ctx.dp(150), Gravity.CENTER_HORIZONTAL))
    }
    private val topBar: LinearLayout
    private val topRule = ctx.separator()

    // Edit mode
    private val choose = ctx.pillButton("Choose photo", R.drawable.ic_photo, ButtonStyle.SECONDARY) { host.pickPhoto() }.compact()
    private val remove = ctx.pillButton("Remove photo", R.drawable.ic_delete, ButtonStyle.DANGER) { removePhoto() }.compact()
    private val nameField = host.inputField("", "Your name", InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS)
    private val status = ctx.text("", 14f, Ui.c.text3) {
        setLineSpacing(0f, 1.3f)
        visibility = View.GONE
    }
    private val editPanel = ctx.column()

    // Profile frames
    private val tiles = ArrayList<FrameTile>()
    private val frameStatus = ctx.text("", 14f, Ui.c.text2) {
        setLineSpacing(0f, 1.3f)
        visibility = View.GONE
    }
    private val applyButton = ctx.pillButton("Apply", R.drawable.ic_check) { applyFrame() }
    private val cancelButton = ctx.pillButton("Cancel", style = ButtonStyle.SECONDARY) { cancelFrame() }
    private val resetButton = ctx.pillButton("Reset to Default", R.drawable.ic_restore, ButtonStyle.GHOST) { resetFrame() }
    private val animateToggle = ToggleView(ctx)
    private val animateNote = ctx.text("", 14f, Ui.c.text3) { setLineSpacing(0f, 1.3f) }
    private var savedFrame = host.data.avatarFrame
    private var previewFrame = savedFrame

    // Crop mode
    private val crop = CropView(ctx)
    private val zoom = SeekBar(ctx)
    private val cropPanel = ctx.column()

    private var pendingPhoto: Bitmap? = null
    private var removePending = false
    private var cropping = false

    init {
        topBar = ctx.row {
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
        column.addView(topRule, lp(MATCH, WRAP) { topMargin = ctx.dp(8) })
        column.addView(avatarHolder, lp(MATCH, WRAP) { topMargin = ctx.dp(22) })

        editPanel.gravity = Gravity.CENTER_HORIZONTAL
        // Side by side when they fit; stacked on small screens or with large text.
        editPanel.addView(ButtonRow(ctx, ctx.dp(10)).apply {
            addView(choose)
            addView(remove)
        }, lp { topMargin = ctx.dp(18) })
        editPanel.addView(status, lp { topMargin = ctx.dp(12) })
        status.gravity = Gravity.CENTER
        buildFrames()
        editPanel.addView(ctx.separator(), lp(MATCH, WRAP) { topMargin = ctx.dp(24) })
        editPanel.addView(ctx.label("Display name"), lp { topMargin = ctx.dp(24) })
        editPanel.addView(nameField, lp { topMargin = ctx.dp(10) })
        editPanel.addView(ctx.text(
            "Your photo stays on this phone. The app uses Android’s photo picker, so it only ever sees the one photo you choose.",
            14f, Ui.c.text3,
        ) { setLineSpacing(0f, 1.3f) }, lp { topMargin = ctx.dp(16) })

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

    /** Slightly smaller buttons, so the two photo actions fit side by side on most phones. */
    private fun TextView.compact(): TextView = apply {
        textSize = 15f
        setPadding(dp(14), dp(8), dp(16), dp(8))
    }

    // ------------------------------------------------------------------ frames

    private fun buildFrames() {
        editPanel.addView(ctx.separator(), lp(MATCH, WRAP) { topMargin = ctx.dp(22) })
        editPanel.addView(ctx.label("Profile frames"), lp { topMargin = ctx.dp(22) })
        editPanel.addView(
            ctx.text("Tap a frame to preview it. Only the border moves; your photo stays still.", 14f, Ui.c.text3) {
                setLineSpacing(0f, 1.3f)
            },
            lp { topMargin = ctx.dp(6) },
        )
        val frames = AvatarFrame.entries
        for (rowStart in frames.indices step 3) {
            editPanel.addView(ctx.row {
                gravity = Gravity.TOP
                for (i in rowStart until minOf(rowStart + 3, frames.size)) {
                    val tile = FrameTile(frames[i])
                    tiles += tile
                    addView(tile.view, lp(0, WRAP, 1f) { if (i > rowStart) marginStart = dp(8) })
                }
            }, lp { topMargin = ctx.dp(if (rowStart == 0) 14 else 8) })
        }
        editPanel.addView(frameStatus, lp { topMargin = ctx.dp(12) })
        editPanel.addView(ctx.row {
            addView(cancelButton, lp(0, WRAP, 1f))
            addView(applyButton, lp(0, WRAP, 1f) { marginStart = dp(10) })
        }, lp { topMargin = ctx.dp(12) })
        editPanel.addView(resetButton, lp(WRAP, WRAP) { topMargin = ctx.dp(4) })
        editPanel.addView(ctx.row {
            minimumHeight = dp(64)
            setPadding(0, dp(8), 0, dp(8))
            addView(ctx.column {
                addView(ctx.text("Animate frame", 16f, Ui.c.text, Fonts.sansSemibold))
                addView(animateNote, lp { topMargin = dp(2) })
            }, lp(0, WRAP, 1f))
            addView(animateToggle, lp(WRAP, WRAP) { marginStart = dp(12) })
            animateToggle.contentDescription = "Animate frame"
            setOnClickListener { animateToggle.performClick() }
        }, lp { topMargin = ctx.dp(8) })
        animateToggle.onChange = { on ->
            host.setFrameAnimated(on)
            refreshFrameMotion()
        }
    }

    /** One frame in the picker: the real photo in that frame, its name, and a check if saved. */
    private inner class FrameTile(val frame: AvatarFrame) {
        val preview = AvatarView(ctx).apply {
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            setFrame(this@FrameTile.frame)
        }
        private val name = ctx.text(frame.label, 13f, Ui.c.text2, Fonts.sansMedium) {
            gravity = Gravity.CENTER
            maxLines = 2
        }
        private val badge = ImageView(ctx).apply {
            setImageResource(R.drawable.ic_check)
            imageTintList = ColorStateList.valueOf(Ui.c.onGreen)
            background = Shapes.oval(Ui.c.green)
            setPadding(dp(3), dp(3), dp(3), dp(3))
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        val view = FrameLayout(ctx).apply {
            addView(ctx.column {
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(dp(4), dp(10), dp(4), dp(10))
                addView(preview, lp(dp(60), dp(60)))
                addView(name, lp(MATCH, WRAP) { topMargin = dp(6) })
            }, flp(MATCH, WRAP))
            addView(badge, flp(dp(20), dp(20), Gravity.TOP or Gravity.END).apply {
                topMargin = dp(6)
                marginEnd = dp(6)
            })
            isClickable = true
            setOnClickListener { showPreview(frame) }
        }

        fun bind(previewed: Boolean, saved: Boolean) {
            val c = Ui.c
            val fill = if (previewed) Shapes.rounded(ctx, 14, c.greenSoft, c.greenText, 1.5f) else Shapes.rounded(ctx, 14, c.surface, c.separator)
            view.background = Shapes.ripple(ctx, fill, 14)
            name.setTextColor(if (previewed) c.greenText else c.text2)
            name.typeface = if (previewed) Fonts.sansSemibold else Fonts.sansMedium
            badge.visibility = if (saved) View.VISIBLE else View.GONE
            view.isSelected = previewed
            view.contentDescription = frame.label + " frame" +
                (if (saved) ", saved" else "") + (if (previewed && !saved) ", previewing" else "")
        }
    }

    /** Shows [frame] on the large avatar straight away; nothing is saved until Apply or Save. */
    private fun showPreview(frame: AvatarFrame) {
        previewFrame = frame
        avatar.setFrame(frame, animate = true)
        setFrameStatus(if (frame == savedFrame) "${frame.label} is your saved frame." else "Previewing ${frame.label}. Tap Apply to keep it.")
        bindFrames()
    }

    private fun setFrameStatus(text: String) {
        frameStatus.update(text)
        frameStatus.visibility = View.VISIBLE
    }

    private fun applyFrame() {
        if (previewFrame == savedFrame) return
        savedFrame = previewFrame
        host.setAvatarFrame(savedFrame)
        setFrameStatus("${savedFrame.label} saved.")
        bindFrames()
    }

    private fun cancelFrame() {
        if (previewFrame == savedFrame) return
        previewFrame = savedFrame
        avatar.setFrame(savedFrame, animate = true)
        setFrameStatus("Back to ${savedFrame.label}.")
        bindFrames()
    }

    private fun resetFrame() {
        previewFrame = AvatarFrame.DEFAULT
        avatar.setFrame(AvatarFrame.DEFAULT, animate = true)
        if (savedFrame != AvatarFrame.DEFAULT) {
            savedFrame = AvatarFrame.DEFAULT
            host.setAvatarFrame(AvatarFrame.DEFAULT)
        }
        setFrameStatus("Frame reset to Default.")
        bindFrames()
    }

    private fun bindFrames() {
        tiles.forEach { it.bind(previewed = it.frame == previewFrame, saved = it.frame == savedFrame) }
        val pending = previewFrame != savedFrame
        listOf(applyButton, cancelButton).forEach {
            it.isEnabled = pending
            it.alpha = if (pending) 1f else 0.4f
        }
        val canReset = savedFrame != AvatarFrame.DEFAULT || previewFrame != AvatarFrame.DEFAULT
        resetButton.isEnabled = canReset
        resetButton.alpha = if (canReset) 1f else 0.4f
    }

    /** Frames move only when allowed (see [MainActivity.framesMoving]); otherwise they hold still. */
    fun refreshFrameMotion() {
        val moving = host.framesMoving
        avatar.animateFrame = moving
        tiles.forEach { it.preview.animateFrame = moving }
        animateToggle.setChecked(host.data.frameAnimated)
        animateNote.update(
            when {
                !host.data.frameAnimated -> "Off: your chosen border stays still."
                !host.policy.ambient -> "Paused while motion is reduced or Battery Saver is on."
                else -> "The border moves gently. Your photo never moves."
            },
        )
    }

    // ------------------------------------------------------------------ opening and closing

    /** Views that fade in once the avatar has landed (everything but the avatar). */
    private fun controls(): List<View> =
        listOf<View>(topBar, topRule) + (0 until editPanel.childCount).map { editPanel.getChildAt(it) }.filter { it.visibility == View.VISIBLE }

    /** Before the avatar flies in: an empty, transparent screen. */
    fun prepareEnter() {
        backdrop.alpha = 0
        avatar.visibility = View.INVISIBLE
        controls().forEach { it.alpha = 0f }
    }

    fun setBackdrop(alpha: Float) {
        backdrop.alpha = (255 * alpha.coerceIn(0f, 1f)).toInt()
    }

    /** After the avatar settles: the controls fade in, top to bottom, rising slightly. */
    fun revealControls() {
        val rise = ctx.dp(8).toFloat()
        controls().forEachIndexed { i, v ->
            v.animate().cancel()
            v.alpha = 0f
            v.translationY = rise
            v.animate().alpha(1f).translationY(0f).setStartDelay(minOf(i, 6) * 25L).setDuration(200).setInterpolator(Ease.out).start()
        }
    }

    /** Before the avatar flies back: the controls fade out. */
    fun hideControls() {
        controls().forEach { v ->
            v.animate().cancel()
            v.animate().alpha(0f).setStartDelay(0).setDuration(120).setInterpolator(Ease.exit).start()
        }
    }

    // ------------------------------------------------------------------ photo and name

    private fun load() {
        val profile = host.data.profile
        nameField.setText(profile.name)
        nameField.setSelection(nameField.text.length)
        avatar.initials = profile.initials
        avatar.setFrame(savedFrame)
        showPhoto(host.avatarBitmap(ctx.dp(150)))
        refreshFrameMotion()
        bindFrames()
    }

    /** The photo on the large avatar and in every frame preview. */
    private fun showPhoto(bitmap: Bitmap?) {
        avatar.setPhoto(bitmap)
        val initials = host.data.profile.initials
        tiles.forEach {
            it.preview.initials = initials
            it.preview.setPhoto(bitmap)
        }
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
        avatarHolder.visibility = View.VISIBLE
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
        avatarHolder.visibility = View.GONE
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
        showPhoto(result)
        showEdit()
        setStatus("Looks good! Tap Save to keep it.")
    }

    private fun removePhoto() {
        pendingPhoto = null
        removePending = true
        showPhoto(null)
        setStatus("Photo removed. Tap Save to confirm — your initials will show instead.")
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
        // A frame still being previewed is kept too.
        if (previewFrame != savedFrame) host.setAvatarFrame(previewFrame)
        if (name.isNotEmpty() && name != host.data.profile.name) host.updateProfile(host.data.profile.copy(name = name))
        host.onAvatarChanged()
        close()
    }

    private fun close() {
        host.closeProfileEditor()
    }
}
