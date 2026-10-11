package com.imran.jarvis.actions

import android.content.Context
import android.provider.ContactsContract.CommonDataKinds.Phone
import android.provider.ContactsContract.Data
import android.telephony.PhoneNumberUtils
import android.telephony.TelephonyManager
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** A person from the phone's contacts, with the number JARVIS would use. */
data class Contact(val id: Long, val name: String, val number: String, val e164: String?)

/** Looks people up in the address book by name (needs the READ_CONTACTS permission). */
class ContactFinder(private val context: Context) {

    sealed interface Result {
        data class Found(val contact: Contact) : Result
        data class Ambiguous(val names: List<String>) : Result
        data object NotFound : Result
    }

    private class Row(val id: Long, val name: String, val number: String, val e164: String?, val rank: Int)

    suspend fun find(spokenName: String): Result = withContext(Dispatchers.IO) {
        val query = spokenName.trim()
        if (query.isEmpty()) return@withContext Result.NotFound

        val byContact = LinkedHashMap<Long, MutableList<Row>>()
        context.contentResolver.query(
            Phone.CONTENT_URI,
            arrayOf(Phone.CONTACT_ID, Phone.DISPLAY_NAME, Phone.NUMBER, Phone.NORMALIZED_NUMBER, Phone.TYPE, Phone.IS_SUPER_PRIMARY),
            null,
            null,
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val number = cursor.getString(2).orEmpty()
                if (number.isBlank()) continue
                val type = cursor.getInt(4)
                val superPrimary = cursor.getInt(5) != 0
                val rank = when {
                    superPrimary -> 0
                    type == Phone.TYPE_MOBILE -> 1
                    else -> 2
                }
                val row = Row(cursor.getLong(0), cursor.getString(1).orEmpty(), number, cursor.getString(3), rank)
                byContact.getOrPut(row.id) { mutableListOf() } += row
            }
        }

        val scored = byContact.values.map { rows -> rows to TextMatching.score(query, rows.first().name) }
        val best = scored.maxOfOrNull { it.second } ?: 0
        if (best < MIN_SCORE) return@withContext Result.NotFound

        val winners = scored.filter { it.second == best }
        if (winners.size > 1) {
            return@withContext Result.Ambiguous(winners.map { it.first.first().name }.distinct().take(3))
        }
        val rows = winners.first().first
        val chosen = rows.minBy { it.rank }
        Result.Found(Contact(chosen.id, chosen.name, chosen.number, chosen.e164))
    }

    /**
     * The number to open a WhatsApp chat with, as digits with the country code (no "+").
     * WhatsApp stores its own address for each contact, which is the most reliable source.
     */
    suspend fun whatsappNumber(contact: Contact): String? = withContext(Dispatchers.IO) {
        context.contentResolver.query(
            Data.CONTENT_URI,
            arrayOf(Data.DATA1),
            "${Data.CONTACT_ID} = ? AND ${Data.MIMETYPE} = ?",
            arrayOf(contact.id.toString(), WHATSAPP_PROFILE_MIME),
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val digits = cursor.getString(0).orEmpty().substringBefore('@').filter { it.isDigit() }
                if (digits.length >= 8) return@withContext digits
            }
        }
        digitsForWhatsapp(contact.number, contact.e164)
    }

    /**
     * Best effort: [rawNumber] as digits with the country code (no "+"), using the phone's own
     * country when the number does not include one. Returns null if it does not look like a phone number.
     */
    fun digitsForWhatsapp(rawNumber: String, e164: String? = null): String? {
        e164?.filter { it.isDigit() }?.takeIf { it.length >= 8 }?.let { return it }

        val raw = rawNumber
        val plain = raw.filter { it.isDigit() || it == '+' }
        if (plain.startsWith("+")) return plain.filter { it.isDigit() }.takeIf { it.length >= 8 }
        if (plain.startsWith("00")) return plain.drop(2).takeIf { it.length >= 8 }

        val country = deviceCountry()
        val formatted = if (country != null) PhoneNumberUtils.formatNumberToE164(raw, country) else null
        return formatted?.filter { it.isDigit() }?.takeIf { it.length >= 8 }
            ?: plain.filter { it.isDigit() }.takeIf { it.length >= 8 }
    }

    private fun deviceCountry(): String? {
        val telephony = context.getSystemService(TelephonyManager::class.java)
        val iso = telephony?.simCountryIso?.takeIf { it.isNotBlank() }
            ?: telephony?.networkCountryIso?.takeIf { it.isNotBlank() }
            ?: Locale.getDefault().country.takeIf { it.isNotBlank() }
        return iso?.uppercase(Locale.ROOT)
    }

    private companion object {
        const val MIN_SCORE = 60
        const val WHATSAPP_PROFILE_MIME = "vnd.android.cursor.item/vnd.com.whatsapp.profile"
    }
}
