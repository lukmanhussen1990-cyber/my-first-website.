package com.loe.chat.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.PlayCircle
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Toasts

sealed interface MdBlock {
    data class Paragraph(val text: String) : MdBlock
    data class Heading(val level: Int, val text: String) : MdBlock
    data class Code(val language: String, val code: String) : MdBlock
    data class ListBlock(val items: List<ListItem>) : MdBlock
    data class Quote(val text: String) : MdBlock
    data class Table(val header: List<String>, val rows: List<List<String>>) : MdBlock
    data class Image(val alt: String, val url: String) : MdBlock
    data class Video(val url: String) : MdBlock
    data object Rule : MdBlock
}

data class ListItem(val marker: String, val level: Int, val text: String)

/** Small block-level Markdown parser; tolerant of half-finished text while a reply streams in. */
object MarkdownParser {
    private val heading = Regex("^(#{1,6})\\s+(.*)$")
    private val rule = Regex("^(\\*\\s*){3,}$|^(-\\s*){3,}$|^(_\\s*){3,}$")
    private val listItem = Regex("^(\\s*)([-*+•]|\\d{1,3}[.)])\\s+(.*)$")
    private val imageLine = Regex("^!\\[([^]]*)]\\(([^)\\s]+)(?:\\s+\"[^\"]*\")?\\)$")
    private val tableSeparator = Regex("^\\s*\\|?\\s*:?-{2,}:?\\s*(\\|\\s*:?-{2,}:?\\s*)*\\|?\\s*$")
    private val bareUrl = Regex("^https?://\\S+$")
    private val imageExt = Regex("\\.(png|jpe?g|webp|gif)(\\?.*)?$", RegexOption.IGNORE_CASE)
    private val videoExt = Regex("\\.(mp4|webm|mov|m4v)(\\?.*)?$", RegexOption.IGNORE_CASE)

    fun parse(source: String): List<MdBlock> {
        val lines = source.replace("\r\n", "\n").split('\n')
        val blocks = mutableListOf<MdBlock>()
        val paragraph = StringBuilder()

        fun flush() {
            val text = paragraph.toString().trim()
            paragraph.clear()
            if (text.isEmpty()) return
            blocks += when {
                bareUrl.matches(text) && videoExt.containsMatchIn(text) -> MdBlock.Video(text)
                bareUrl.matches(text) && imageExt.containsMatchIn(text) -> MdBlock.Image("", text)
                else -> MdBlock.Paragraph(text)
            }
        }

        var i = 0
        while (i < lines.size) {
            val line = lines[i]
            val trimmed = line.trim()
            when {
                trimmed.startsWith("```") || trimmed.startsWith("~~~") -> {
                    flush()
                    val fence = trimmed.take(3)
                    val language = trimmed.removePrefix(fence).trim().substringBefore(' ')
                    val code = StringBuilder()
                    i++
                    while (i < lines.size && !lines[i].trim().startsWith(fence)) {
                        if (code.isNotEmpty()) code.append('\n')
                        code.append(lines[i])
                        i++
                    }
                    blocks += MdBlock.Code(language, code.toString())
                    i++
                    continue
                }
                trimmed.isEmpty() -> flush()
                heading.matches(trimmed) -> {
                    flush()
                    val m = heading.find(trimmed)!!
                    blocks += MdBlock.Heading(m.groupValues[1].length, m.groupValues[2].trim().trimEnd('#').trim())
                }
                rule.matches(trimmed) -> {
                    flush()
                    blocks += MdBlock.Rule
                }
                imageLine.matches(trimmed) -> {
                    flush()
                    val m = imageLine.find(trimmed)!!
                    val url = m.groupValues[2]
                    blocks += if (videoExt.containsMatchIn(url)) MdBlock.Video(url) else MdBlock.Image(m.groupValues[1], url)
                }
                trimmed.startsWith(">") -> {
                    flush()
                    val quote = StringBuilder()
                    while (i < lines.size && lines[i].trim().startsWith(">")) {
                        if (quote.isNotEmpty()) quote.append('\n')
                        quote.append(lines[i].trim().removePrefix(">").removePrefix(" "))
                        i++
                    }
                    blocks += MdBlock.Quote(quote.toString())
                    continue
                }
                listItem.matches(line) -> {
                    flush()
                    val items = mutableListOf<ListItem>()
                    val ordered = isOrdered(listItem.find(line)!!.groupValues[2])
                    fun sameList(text: String): Boolean {
                        val m = listItem.find(text) ?: return false
                        return m.groupValues[1].isNotEmpty() || isOrdered(m.groupValues[2]) == ordered
                    }
                    while (i < lines.size) {
                        val current = lines[i]
                        val match = listItem.find(current)
                        if (match != null) {
                            if (items.isNotEmpty() && !sameList(current)) break
                            val indent = match.groupValues[1].replace("\t", "    ").length
                            val marker = match.groupValues[2].let { if (it in setOf("-", "*", "+", "•")) "•" else it.replace(')', '.') }
                            items += ListItem(marker, (indent / 2).coerceAtMost(4), match.groupValues[3])
                            i++
                        } else if (current.isBlank()) {
                            val next = lines.getOrNull(i + 1)
                            if (next != null && sameList(next)) i++ else break
                        } else if (current.startsWith(" ") || current.startsWith("\t")) {
                            val last = items.removeAt(items.lastIndex)
                            items += last.copy(text = last.text + " " + current.trim())
                            i++
                        } else {
                            break
                        }
                    }
                    blocks += MdBlock.ListBlock(items)
                    continue
                }
                trimmed.contains('|') && i + 1 < lines.size && tableSeparator.matches(lines[i + 1]) -> {
                    flush()
                    val header = splitRow(trimmed)
                    i += 2
                    val rows = mutableListOf<List<String>>()
                    while (i < lines.size && lines[i].contains('|') && lines[i].isNotBlank()) {
                        rows += splitRow(lines[i].trim())
                        i++
                    }
                    blocks += MdBlock.Table(header, rows)
                    continue
                }
                else -> {
                    if (paragraph.isNotEmpty()) paragraph.append('\n')
                    paragraph.append(line.trimEnd())
                }
            }
            i++
        }
        flush()
        return blocks
    }

    private fun isOrdered(marker: String): Boolean = marker.first().isDigit()

    private fun splitRow(row: String): List<String> =
        row.trim().removePrefix("|").removeSuffix("|").split('|').map { it.trim() }
}

/** Inline Markdown (bold, italic, code, strikethrough, links) to an AnnotatedString. */
object InlineMarkdown {
    private const val ESCAPABLE = "\\`*_{}[]()#+-.!~|>"

    fun render(text: String, link: Color, codeBackground: Color): AnnotatedString = buildAnnotatedString {
        append(this, text, link, codeBackground)
    }

    private fun append(builder: AnnotatedString.Builder, text: String, link: Color, codeBg: Color) {
        var i = 0
        with(builder) {
            while (i < text.length) {
                val c = text[i]
                when {
                    c == '\\' && i + 1 < text.length && text[i + 1] in ESCAPABLE -> {
                        append(text[i + 1]); i += 2
                    }
                    c == '`' -> {
                        val end = text.indexOf('`', i + 1)
                        if (end > i) {
                            withStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = codeBg, fontSize = 0.92.em)) {
                                append(text.substring(i + 1, end))
                            }
                            i = end + 1
                        } else {
                            append(c); i++
                        }
                    }
                    text.startsWith("**", i) || text.startsWith("__", i) -> {
                        val delimiter = text.substring(i, i + 2)
                        val end = text.indexOf(delimiter, i + 2)
                        if (end > i + 2) {
                            withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append(builder, text.substring(i + 2, end), link, codeBg) }
                            i = end + 2
                        } else {
                            append(delimiter); i += 2
                        }
                    }
                    text.startsWith("~~", i) -> {
                        val end = text.indexOf("~~", i + 2)
                        if (end > i + 2) {
                            withStyle(SpanStyle(textDecoration = TextDecoration.LineThrough)) { append(builder, text.substring(i + 2, end), link, codeBg) }
                            i = end + 2
                        } else {
                            append("~~"); i += 2
                        }
                    }
                    (c == '*' || c == '_') && canOpenEmphasis(text, i) -> {
                        val end = findEmphasisEnd(text, c, i + 1)
                        if (end > 0) {
                            withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append(builder, text.substring(i + 1, end), link, codeBg) }
                            i = end + 1
                        } else {
                            append(c); i++
                        }
                    }
                    c == '!' && text.startsWith("![", i) -> {
                        val parsed = parseLink(text, i + 1)
                        if (parsed != null) {
                            withLink(LinkAnnotation.Url(parsed.second, TextLinkStyles(SpanStyle(color = link)))) {
                                append("🖼 " + parsed.first.ifBlank { "Image" })
                            }
                            i = parsed.third
                        } else {
                            append(c); i++
                        }
                    }
                    c == '[' -> {
                        val parsed = parseLink(text, i)
                        if (parsed != null) {
                            withLink(LinkAnnotation.Url(parsed.second, TextLinkStyles(SpanStyle(color = link, textDecoration = TextDecoration.Underline)))) {
                                append(builder, parsed.first, link, codeBg)
                            }
                            i = parsed.third
                        } else {
                            append(c); i++
                        }
                    }
                    text.startsWith("http://", i) || text.startsWith("https://", i) -> {
                        var end = i
                        while (end < text.length && !text[end].isWhitespace() && text[end] != '<' && text[end] != '>') end++
                        while (end > i && text[end - 1] in ".,;:!?)]}'\"") end--
                        val url = text.substring(i, end)
                        withLink(LinkAnnotation.Url(url, TextLinkStyles(SpanStyle(color = link, textDecoration = TextDecoration.Underline)))) {
                            append(url)
                        }
                        i = end
                    }
                    else -> {
                        append(c); i++
                    }
                }
            }
        }
    }

    private fun canOpenEmphasis(text: String, i: Int): Boolean {
        val next = text.getOrNull(i + 1) ?: return false
        if (next.isWhitespace()) return false
        // Underscores inside words (snake_case) are not emphasis.
        if (text[i] == '_' && i > 0 && text[i - 1].isLetterOrDigit()) return false
        return true
    }

    private fun findEmphasisEnd(text: String, delimiter: Char, from: Int): Int {
        var j = from
        while (j < text.length) {
            if (text[j] == delimiter && !text[j - 1].isWhitespace()) {
                val after = text.getOrNull(j + 1)
                if (delimiter == '_' && after != null && after.isLetterOrDigit()) {
                    j++; continue
                }
                if (after == delimiter) {
                    j += 2; continue
                }
                return j
            }
            if (text[j] == '\n') return -1
            j++
        }
        return -1
    }

    /** Parses "[label](url)" starting at [start]; returns label, url and the index after it. */
    private fun parseLink(text: String, start: Int): Triple<String, String, Int>? {
        if (text.getOrNull(start) != '[') return null
        var depth = 0
        var j = start
        while (j < text.length) {
            when (text[j]) {
                '[' -> depth++
                ']' -> {
                    depth--
                    if (depth == 0) break
                }
                '\n' -> return null
            }
            j++
        }
        if (j >= text.length || text.getOrNull(j + 1) != '(') return null
        val close = text.indexOf(')', j + 2)
        if (close < 0) return null
        val url = text.substring(j + 2, close).trim().substringBefore(' ')
        if (url.isEmpty()) return null
        return Triple(text.substring(start + 1, j), url, close + 1)
    }
}

@Composable
fun MarkdownText(
    markdown: String,
    modifier: Modifier = Modifier,
    color: Color = LoeTheme.colors.text,
    fontSize: TextUnit = 17.sp,
) {
    val blocks = remember(markdown) { MarkdownParser.parse(markdown) }
    val colors = LoeTheme.colors
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        blocks.forEach { block ->
            when (block) {
                is MdBlock.Paragraph -> Text(
                    InlineMarkdown.render(block.text, colors.link, colors.codeBackground),
                    color = color, fontSize = fontSize, lineHeight = fontSize * 1.4f,
                )
                is MdBlock.Heading -> Text(
                    InlineMarkdown.render(block.text, colors.link, colors.codeBackground),
                    color = color,
                    fontWeight = FontWeight.Bold,
                    fontSize = when (block.level) {
                        1 -> fontSize * 1.3f
                        2 -> fontSize * 1.18f
                        3 -> fontSize * 1.08f
                        else -> fontSize
                    },
                )
                is MdBlock.Code -> CodeBlock(block)
                is MdBlock.ListBlock -> Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    block.items.forEach { item ->
                        Row(Modifier.padding(start = (item.level * 16).dp)) {
                            Text(
                                item.marker,
                                color = color, fontSize = fontSize,
                                modifier = Modifier.widthIn(min = if (item.marker == "•") 16.dp else 24.dp),
                            )
                            Text(
                                InlineMarkdown.render(item.text, colors.link, colors.codeBackground),
                                color = color, fontSize = fontSize, lineHeight = fontSize * 1.4f,
                            )
                        }
                    }
                }
                is MdBlock.Quote -> Row {
                    Box(Modifier.width(3.dp).heightIn(min = 20.dp).background(colors.textTertiary, RoundedCornerShape(2.dp)))
                    Spacer(Modifier.width(10.dp))
                    Text(
                        InlineMarkdown.render(block.text, colors.link, colors.codeBackground),
                        color = colors.textSecondary, fontSize = fontSize, fontStyle = FontStyle.Italic,
                    )
                }
                is MdBlock.Table -> TableBlock(block, color, fontSize)
                is MdBlock.Image -> MarkdownImage(block.url, block.alt)
                is MdBlock.Video -> VideoLink(block.url)
                MdBlock.Rule -> HorizontalDivider(color = colors.divider)
            }
        }
    }
}

@Composable
private fun CodeBlock(block: MdBlock.Code) {
    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    val colors = LoeTheme.colors
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(colors.codeBackground),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(block.language.ifBlank { "code" }, fontSize = 13.sp, color = colors.textSecondary, modifier = Modifier.weight(1f))
            Row(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable {
                        clipboard.setText(AnnotatedString(block.code))
                        Toasts.show(context, "Code copied")
                    }
                    .padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.ContentCopy, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(15.dp))
                Spacer(Modifier.width(4.dp))
                Text("Copy", fontSize = 13.sp, color = colors.textSecondary)
            }
        }
        Text(
            block.code,
            fontFamily = FontFamily.Monospace,
            fontSize = 14.sp,
            lineHeight = 20.sp,
            color = colors.text,
            softWrap = false,
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(start = 12.dp, end = 12.dp, bottom = 12.dp, top = 4.dp),
        )
    }
}

@Composable
private fun TableBlock(block: MdBlock.Table, color: Color, fontSize: TextUnit) {
    val colors = LoeTheme.colors
    val columns = maxOf(block.header.size, block.rows.maxOfOrNull { it.size } ?: 0)
    Column(
        Modifier
            .horizontalScroll(rememberScrollState())
            .border(1.dp, colors.divider, RoundedCornerShape(8.dp))
            .clip(RoundedCornerShape(8.dp)),
    ) {
        (listOf(block.header) + block.rows).forEachIndexed { index, row ->
            Row(Modifier.background(if (index == 0) colors.composer else Color.Transparent)) {
                for (c in 0 until columns) {
                    Text(
                        InlineMarkdown.render(row.getOrElse(c) { "" }, colors.link, colors.codeBackground),
                        color = color,
                        fontSize = fontSize * 0.9f,
                        fontWeight = if (index == 0) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.widthIn(min = 90.dp, max = 220.dp).padding(horizontal = 10.dp, vertical = 8.dp),
                    )
                }
            }
            if (index < block.rows.size) HorizontalDivider(color = colors.divider)
        }
    }
}

@Composable
fun MarkdownImage(url: String, alt: String) {
    val uriHandler = LocalUriHandler.current
    AsyncImage(
        model = url,
        contentDescription = alt.ifBlank { "Image" },
        contentScale = ContentScale.FillWidth,
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(max = 420.dp)
            .clip(RoundedCornerShape(12.dp))
            .clickable { runCatching { uriHandler.openUri(url) } },
    )
}

@Composable
private fun VideoLink(url: String) {
    val uriHandler = LocalUriHandler.current
    val colors = LoeTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(colors.composer)
            .clickable { runCatching { uriHandler.openUri(url) } }
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.PlayCircle, contentDescription = null, tint = colors.primary, modifier = Modifier.size(32.dp))
        Spacer(Modifier.width(12.dp))
        Column {
            Text("Play video", fontWeight = FontWeight.SemiBold, color = colors.text)
            Text(url.substringAfterLast('/').take(40), fontSize = 13.sp, color = colors.textSecondary)
        }
    }
}
