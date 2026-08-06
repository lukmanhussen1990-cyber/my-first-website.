package com.alarmhandler.app.alarm

/** Intent actions and extras shared by the receiver, the service and the UI. */
object AlarmIntents {

    const val ACTION_FIRE = "com.alarmhandler.app.action.FIRE"
    const val ACTION_SNOOZE = "com.alarmhandler.app.action.SNOOZE"
    const val ACTION_DISMISS = "com.alarmhandler.app.action.DISMISS"
    const val ACTION_AUTO_SILENCE = "com.alarmhandler.app.action.AUTO_SILENCE"

    const val EXTRA_ALARM_ID = "alarm_id"
    const val EXTRA_ALARM_JSON = "alarm_json"
    const val EXTRA_FROM_SNOOZE = "from_snooze"

    /**
     * Reserved id for the "test alarm in 5 seconds" button. It is negative so
     * it can never collide with a Room generated primary key, and the alarm
     * itself travels inside the intent rather than the database so the test
     * never appears in the user's list.
     */
    const val TEST_ALARM_ID = -1L

    /**
     * Request codes must be distinct per alarm *and* per purpose, otherwise a
     * snooze would silently replace the alarm's own next occurrence.
     */
    fun mainRequestCode(alarmId: Long): Int = (alarmId.toInt() * 10)

    fun snoozeRequestCode(alarmId: Long): Int = (alarmId.toInt() * 10) + 1

    fun mainUri(alarmId: Long): String = "alarmhandler://alarm/$alarmId"

    fun snoozeUri(alarmId: Long): String = "alarmhandler://snooze/$alarmId"
}
