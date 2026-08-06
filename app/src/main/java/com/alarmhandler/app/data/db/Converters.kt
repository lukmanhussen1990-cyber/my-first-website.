package com.alarmhandler.app.data.db

import androidx.room.TypeConverter
import com.alarmhandler.app.data.model.DismissChallenge

/** Enums are stored by their stable string id, never by ordinal. */
class Converters {

    @TypeConverter
    fun challengeToString(value: DismissChallenge): String = value.id

    @TypeConverter
    fun stringToChallenge(value: String?): DismissChallenge = DismissChallenge.fromId(value)

    @TypeConverter
    fun actionToString(value: HistoryAction): String = value.id

    @TypeConverter
    fun stringToAction(value: String?): HistoryAction = HistoryAction.fromId(value)
}
