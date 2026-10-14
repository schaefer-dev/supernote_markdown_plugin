package dev.schaefer.supernotemarkdown

import android.graphics.Typeface
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.facebook.react.bridge.*
import java.io.File
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.concurrent.Executors
import kotlin.math.ceil
import kotlin.math.max

/** File access is still subject to PluginHost's declared/granted permissions. */
class MarkdownBridgeModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
    private val worker = Executors.newSingleThreadExecutor()
    private var storageRoot: File? = null
    override fun getName() = "MarkdownBridge"

    private fun run(promise: Promise, action: () -> Any?) {
        worker.execute {
            try { promise.resolve(action()) }
            catch (error: Exception) { promise.reject("MARKDOWN_IMPORT", error.message, error) }
        }
    }

    @ReactMethod fun configureStorageRoot(path: String, promise: Promise) = run(promise) {
        val root = File(path).canonicalFile
        val hostFiles = reactApplicationContext.filesDir.canonicalFile
        require(root.path.startsWith(hostFiles.path + "/plugins/")) { "Invalid plugin storage directory" }
        require(root.exists() || root.mkdirs()) { "Cannot create plugin storage directory" }
        storageRoot = root
        null
    }

    private fun privateFile(name: String): File {
        require(name.matches(Regex("[a-zA-Z0-9._-]+")) && name != "." && name != "..") { "Invalid private filename" }
        return File(requireNotNull(storageRoot) { "Plugin storage is not initialized" }, name)
    }

    @ReactMethod fun readPrivate(name: String, promise: Promise) = run(promise) {
        val file = privateFile(name)
        if (file.exists()) file.readText(Charsets.UTF_8) else null
    }

    @ReactMethod fun writePrivate(name: String, content: String, promise: Promise) = run(promise) {
        val destination = privateFile(name)
        val temp = privateFile("$name.tmp")
        temp.outputStream().use { stream ->
            stream.write(content.toByteArray(Charsets.UTF_8))
            stream.fd.sync()
        }
        Files.move(temp.toPath(), destination.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        null
    }

    @ReactMethod fun readMarkdown(path: String, promise: Promise) = run(promise) {
        val file = File(path).canonicalFile
        require(file.extension.equals("md", ignoreCase = true)) { "Choose a .md Markdown file" }
        require(file.isFile && file.length() <= 1024 * 1024) { "Choose a Markdown file no larger than 1 MB" }
        val decoder = StandardCharsets.UTF_8.newDecoder()
            .onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT)
        decoder.decode(ByteBuffer.wrap(file.readBytes())).toString()
    }

    @ReactMethod fun resolveFont(promise: Promise) = run(promise) {
        listOf("/system/fonts/Roboto-Regular.ttf", "/system/fonts/NotoSans-Regular.ttf")
            .firstOrNull { File(it).isFile }
            ?: throw IllegalStateException("A supported system font was not found on this device")
    }

    @ReactMethod fun measureText(text: String, width: Double, style: ReadableMap, promise: Promise) = run(promise) {
        require(width.isFinite() && width > 0 && width <= 10000) { "Invalid text width" }
        val size = style.getDouble("fontSize")
        require(size.isFinite() && size > 0 && size < 1000) { "Invalid font size" }
        val path = style.getString("fontPath") ?: error("Missing measurement font")
        val base = Typeface.createFromFile(path)
        val fontStyle = (if (style.getBoolean("bold")) Typeface.BOLD else 0) or
            (if (style.getBoolean("italic")) Typeface.ITALIC else 0)
        val paint = TextPaint(TextPaint.ANTI_ALIAS_FLAG).apply {
            textSize = size.toFloat()
            typeface = Typeface.create(base, fontStyle)
        }
        val layout = StaticLayout.Builder.obtain(text, 0, text.length, paint, width.toInt())
            .setAlignment(Layout.Alignment.ALIGN_NORMAL).setIncludePad(true)
            .setBreakStrategy(Layout.BREAK_STRATEGY_SIMPLE).setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NONE)
            .build()
        val result = Arguments.createArray()
        for (line in 0 until layout.lineCount) {
            val start = layout.getLineStart(line)
            val end = layout.getLineEnd(line)
            if (end == start) continue
            result.pushMap(Arguments.createMap().apply {
                putString("text", text.substring(start, end))
                putDouble("height", ceil(max(size, (layout.getLineBottom(line) - layout.getLineTop(line)).toDouble()) * 1.18))
            })
        }
        result
    }

    override fun invalidate() { worker.shutdown(); super.invalidate() }
}
