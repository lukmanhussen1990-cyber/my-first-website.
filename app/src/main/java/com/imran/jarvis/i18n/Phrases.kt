package com.imran.jarvis.i18n

import com.imran.jarvis.ai.AiException
import com.imran.jarvis.ai.JarvisAction
import com.imran.jarvis.ai.JarvisReply
import com.imran.jarvis.data.AppLanguage
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** One notification, ready to be read aloud. */
data class NotificationLine(val appName: String, val title: String, val text: String)

/**
 * Every sentence JARVIS says by itself (errors, time, battery, notifications...), in both languages.
 * Sentences that come from the AI are NOT here. Hindi is written in Devanagari so the Hindi voice
 * pronounces it correctly.
 */
interface Phrases {

    // ----- Problems talking to the AI -----
    val noInternet: String
    val noApiKey: String
    val invalidApiKey: String
    val rateLimited: String
    val quotaOrBilling: String
    val serverBusy: String
    val timeout: String
    val blocked: String
    val emptyReply: String
    val providerPermission: String
    val genericError: String
    fun modelNotFound(model: String): String

    // ----- Listening -----
    val micDenied: String
    val didntCatch: String
    val heardNothing: String
    val sttUnavailable: String
    val sttBusy: String
    val sttLanguageUnavailable: String
    val ttsVoiceMissing: String

    // ----- Phone actions -----
    val callsOff: String
    val callsNeedPermission: String
    val openAppsOff: String
    val whatsappMissing: String
    val noFlashlight: String
    val alarmTimeUnclear: String
    val timerUnclear: String
    val notificationsOff: String
    val notificationsNotConnected: String
    val noNotifications: String
    val cantOpen: String
    fun contactNotFound(name: String): String
    fun contactAmbiguous(names: List<String>): String
    fun appNotFound(name: String): String
    fun notificationsSummary(items: List<NotificationLine>): String

    // ----- Answers from the phone itself -----
    fun timeNow(time: LocalTime): String
    fun dateToday(date: LocalDate): String
    fun battery(percent: Int, charging: Boolean): String

    /** A short confirmation for an action, used only when the AI forgot to write one. */
    fun defaultReply(reply: JarvisReply): String

    /** Friendly sentence for a failed AI request. */
    fun forAiError(error: AiException): String = when (error) {
        is AiException.NoApiKey -> noApiKey
        is AiException.NoInternet -> noInternet
        is AiException.Timeout -> timeout
        is AiException.InvalidApiKey -> invalidApiKey
        is AiException.PermissionDenied -> providerPermission
        is AiException.ModelNotFound -> modelNotFound(error.model)
        is AiException.RateLimited -> rateLimited
        is AiException.QuotaOrBilling -> quotaOrBilling
        is AiException.ServerError -> serverBusy
        is AiException.Blocked -> blocked
        is AiException.EmptyReply -> emptyReply
        is AiException.BadRequest -> genericError
    }

    companion object {
        fun forLanguage(language: AppLanguage): Phrases =
            if (language == AppLanguage.HINDI) HindiPhrases else EnglishPhrases
    }
}

object EnglishPhrases : Phrases {
    override val noInternet = "I can't reach the internet. Please check your connection and try again."
    override val noApiKey = "Please add your API key in Settings first."
    override val invalidApiKey = "Your API key looks wrong. Please check it in Settings."
    override val rateLimited = "The AI service is getting too many requests or your limit is over. Please try again in a little while."
    override val quotaOrBilling = "There is a credit or billing problem with your AI account. Please check your provider's account."
    override val serverBusy = "The AI service is busy right now. Please try again in a moment."
    override val timeout = "That took too long. Please try again."
    override val blocked = "Sorry, I can't help with that."
    override val emptyReply = "I didn't get an answer. Please ask again."
    override val providerPermission = "Your API key is not allowed to do this. Please check it in Settings."
    override val genericError = "Something went wrong. Please try again."
    override fun modelNotFound(model: String) =
        "The AI model \"$model\" is not available for your API key. Please pick another model in Settings."

    override val micDenied = "I need microphone permission to hear you. Please allow it in your phone's Settings."
    override val didntCatch = "Sorry, I didn't catch that. Tap the mic and try again."
    override val heardNothing = "I didn't hear anything. Tap the mic and speak."
    override val sttUnavailable = "Speech recognition isn't available on this phone. Please install or update the Google app."
    override val sttBusy = "Speech recognition is busy. Please try again in a moment."
    override val sttLanguageUnavailable = "Speech recognition isn't available for this language on your phone."
    override val ttsVoiceMissing = "This voice isn't installed on your phone, so I'll use another one. You can install it in Google Text-to-speech settings."

    override val callsOff = "Calls are turned off. Please turn on Calls in Settings."
    override val callsNeedPermission = "I need Phone and Contacts permission to do that."
    override val openAppsOff = "Opening apps is turned off. Please turn on Open Apps in Settings."
    override val whatsappMissing = "WhatsApp isn't installed on this phone."
    override val noFlashlight = "This phone doesn't have a flashlight I can use."
    override val alarmTimeUnclear = "I didn't understand the time for the alarm, so I opened the clock app."
    override val timerUnclear = "I didn't understand how long the timer should be."
    override val notificationsOff = "Reading notifications is turned off. Please turn on Notifications in Settings."
    override val notificationsNotConnected = "I'm still connecting to your notifications. Please ask again in a moment."
    override val noNotifications = "You have no new notifications."
    override val cantOpen = "Sorry, I couldn't open that."
    override fun contactNotFound(name: String) = "I couldn't find \"$name\" in your contacts."
    override fun contactAmbiguous(names: List<String>) =
        "I found more than one match: ${names.joinToString(", ")}. Please say the full name."
    override fun appNotFound(name: String) = "I couldn't find an app named \"$name\"."

    override fun notificationsSummary(items: List<NotificationLine>): String {
        val count = if (items.size == 1) "1 notification" else "${items.size} notifications"
        val lines = items.joinToString(" ") { item ->
            val body = listOf(item.title, item.text).filter { it.isNotBlank() }.joinToString(", ")
            "From ${item.appName}: $body."
        }
        return "You have $count. $lines"
    }

    private val timeFormat = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)
    private val dateFormat = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", Locale.ENGLISH)

    override fun timeNow(time: LocalTime) = "It's ${time.format(timeFormat)}."
    override fun dateToday(date: LocalDate) = "Today is ${date.format(dateFormat)}."
    override fun battery(percent: Int, charging: Boolean) =
        "Your battery is at $percent percent" + if (charging) " and it's charging." else "."

    override fun defaultReply(reply: JarvisReply): String {
        val t = reply.target.substringBefore('|').trim()
        return when (reply.action) {
            JarvisAction.OPEN_APP -> "Opening $t."
            JarvisAction.CALL -> "Calling $t."
            JarvisAction.WHATSAPP -> "Opening WhatsApp chat with $t."
            JarvisAction.YOUTUBE_SEARCH -> if (t.isEmpty()) "Opening YouTube." else "Searching YouTube for $t."
            JarvisAction.GOOGLE_SEARCH -> "Searching Google for $t."
            JarvisAction.FLASHLIGHT_ON -> "Flashlight on."
            JarvisAction.FLASHLIGHT_OFF -> "Flashlight off."
            JarvisAction.SET_ALARM -> "Setting the alarm."
            JarvisAction.SET_TIMER -> "Starting the timer."
            JarvisAction.VOLUME_UP -> "Volume up."
            JarvisAction.VOLUME_DOWN -> "Volume down."
            JarvisAction.OPEN_WIFI -> "Opening Wi-Fi settings."
            JarvisAction.OPEN_BLUETOOTH -> "Opening Bluetooth settings."
            JarvisAction.TIME, JarvisAction.BATTERY, JarvisAction.READ_NOTIFICATIONS, JarvisAction.NONE -> ""
        }
    }
}

object HindiPhrases : Phrases {
    override val noInternet = "इंटरनेट नहीं चल रहा है। कृपया अपना कनेक्शन जाँचकर फिर से कोशिश कीजिए।"
    override val noApiKey = "पहले सेटिंग्स में जाकर अपनी API key डालिए।"
    override val invalidApiKey = "आपकी API key गलत लग रही है। कृपया सेटिंग्स में उसे जाँच लीजिए।"
    override val rateLimited = "अभी बहुत ज़्यादा अनुरोध हो गए हैं या आपकी लिमिट पूरी हो गई है। थोड़ी देर बाद फिर कोशिश कीजिए।"
    override val quotaOrBilling = "आपके AI अकाउंट में क्रेडिट या बिलिंग की दिक्कत है। कृपया अपने प्रोवाइडर का अकाउंट देख लीजिए।"
    override val serverBusy = "AI सर्विस अभी व्यस्त है। थोड़ी देर बाद फिर कोशिश कीजिए।"
    override val timeout = "जवाब आने में बहुत देर हो गई। कृपया फिर से कोशिश कीजिए।"
    override val blocked = "माफ़ कीजिए, मैं इसमें मदद नहीं कर सकता।"
    override val emptyReply = "मुझे कोई जवाब नहीं मिला। कृपया फिर से पूछिए।"
    override val providerPermission = "आपकी API key को इसकी अनुमति नहीं है। कृपया सेटिंग्स में उसे जाँच लीजिए।"
    override val genericError = "कुछ गड़बड़ हो गई। कृपया फिर से कोशिश कीजिए।"
    override fun modelNotFound(model: String) =
        "यह AI मॉडल \"$model\" आपकी API key के लिए उपलब्ध नहीं है। कृपया सेटिंग्स में कोई दूसरा मॉडल चुनिए।"

    override val micDenied = "आपकी आवाज़ सुनने के लिए मुझे माइक्रोफ़ोन की अनुमति चाहिए। कृपया फ़ोन की सेटिंग्स में उसे चालू कीजिए।"
    override val didntCatch = "माफ़ कीजिए, मैं समझ नहीं पाया। माइक दबाकर फिर से बोलिए।"
    override val heardNothing = "मुझे कुछ सुनाई नहीं दिया। माइक दबाकर बोलिए।"
    override val sttUnavailable = "इस फ़ोन पर आवाज़ पहचान उपलब्ध नहीं है। कृपया Google ऐप इंस्टॉल या अपडेट कीजिए।"
    override val sttBusy = "आवाज़ पहचान अभी व्यस्त है। एक पल बाद फिर कोशिश कीजिए।"
    override val sttLanguageUnavailable = "आपके फ़ोन पर इस भाषा के लिए आवाज़ पहचान उपलब्ध नहीं है।"
    override val ttsVoiceMissing = "Hindi voice is not installed on your phone, so I will use another voice. You can install it in the Google Text-to-speech settings."

    override val callsOff = "कॉल की सुविधा बंद है। कृपया सेटिंग्स में Calls चालू कीजिए।"
    override val callsNeedPermission = "यह करने के लिए मुझे फ़ोन और कॉन्टैक्ट्स की अनुमति चाहिए।"
    override val openAppsOff = "ऐप खोलने की सुविधा बंद है। कृपया सेटिंग्स में Open Apps चालू कीजिए।"
    override val whatsappMissing = "इस फ़ोन में WhatsApp इंस्टॉल नहीं है।"
    override val noFlashlight = "इस फ़ोन में मैं फ्लैशलाइट नहीं चला सकता।"
    override val alarmTimeUnclear = "मैं अलार्म का समय समझ नहीं पाया, इसलिए मैंने घड़ी का ऐप खोल दिया है।"
    override val timerUnclear = "मैं टाइमर की अवधि समझ नहीं पाया।"
    override val notificationsOff = "नोटिफ़िकेशन पढ़ने की सुविधा बंद है। कृपया सेटिंग्स में Notifications चालू कीजिए।"
    override val notificationsNotConnected = "मैं अभी नोटिफ़िकेशन से कनेक्ट हो रहा हूँ। एक पल बाद फिर पूछिए।"
    override val noNotifications = "आपके पास कोई नया नोटिफ़िकेशन नहीं है।"
    override val cantOpen = "माफ़ कीजिए, मैं इसे खोल नहीं पाया।"
    override fun contactNotFound(name: String) = "मुझे आपके कॉन्टैक्ट्स में \"$name\" नहीं मिला।"
    override fun contactAmbiguous(names: List<String>) =
        "मुझे एक से ज़्यादा नाम मिले: ${names.joinToString(", ")}। कृपया पूरा नाम बोलिए।"
    override fun appNotFound(name: String) = "मुझे \"$name\" नाम का ऐप नहीं मिला।"

    override fun notificationsSummary(items: List<NotificationLine>): String {
        val lines = items.joinToString(" ") { item ->
            val body = listOf(item.title, item.text).filter { it.isNotBlank() }.joinToString(", ")
            "${item.appName} से: $body।"
        }
        return "आपके पास ${items.size} नोटिफ़िकेशन हैं। $lines"
    }

    private val weekdays = listOf("सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार", "रविवार")
    private val months = listOf(
        "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून",
        "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
    )

    override fun timeNow(time: LocalTime): String {
        val hour24 = time.hour
        val hour12 = if (hour24 % 12 == 0) 12 else hour24 % 12
        val part = when (hour24) {
            in 4..11 -> "सुबह"
            in 12..15 -> "दोपहर"
            in 16..19 -> "शाम"
            else -> "रात"
        }
        return if (time.minute == 0) "अभी $part के $hour12 बजे हैं।"
        else "अभी $part के $hour12 बजकर ${time.minute} मिनट हुए हैं।"
    }

    override fun dateToday(date: LocalDate) =
        "आज ${weekdays[date.dayOfWeek.value - 1]}, ${date.dayOfMonth} ${months[date.monthValue - 1]} ${date.year} है।"

    override fun battery(percent: Int, charging: Boolean) =
        "बैटरी $percent प्रतिशत है" + if (charging) " और फ़ोन चार्ज हो रहा है।" else "।"

    override fun defaultReply(reply: JarvisReply): String {
        val t = reply.target.substringBefore('|').trim()
        return when (reply.action) {
            JarvisAction.OPEN_APP -> "$t खोल रहा हूँ।"
            JarvisAction.CALL -> "$t को कॉल कर रहा हूँ।"
            JarvisAction.WHATSAPP -> "$t की WhatsApp चैट खोल रहा हूँ।"
            JarvisAction.YOUTUBE_SEARCH -> if (t.isEmpty()) "YouTube खोल रहा हूँ।" else "YouTube पर $t खोज रहा हूँ।"
            JarvisAction.GOOGLE_SEARCH -> "Google पर $t खोज रहा हूँ।"
            JarvisAction.FLASHLIGHT_ON -> "फ्लैशलाइट चालू कर दी।"
            JarvisAction.FLASHLIGHT_OFF -> "फ्लैशलाइट बंद कर दी।"
            JarvisAction.SET_ALARM -> "अलार्म लगा रहा हूँ।"
            JarvisAction.SET_TIMER -> "टाइमर शुरू कर रहा हूँ।"
            JarvisAction.VOLUME_UP -> "आवाज़ बढ़ा दी।"
            JarvisAction.VOLUME_DOWN -> "आवाज़ कम कर दी।"
            JarvisAction.OPEN_WIFI -> "वाई-फ़ाई की सेटिंग्स खोल रहा हूँ।"
            JarvisAction.OPEN_BLUETOOTH -> "ब्लूटूथ की सेटिंग्स खोल रहा हूँ।"
            JarvisAction.TIME, JarvisAction.BATTERY, JarvisAction.READ_NOTIFICATIONS, JarvisAction.NONE -> ""
        }
    }
}
