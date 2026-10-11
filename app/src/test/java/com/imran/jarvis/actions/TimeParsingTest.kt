package com.imran.jarvis.actions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class TimeParsingTest {

    private fun alarm(text: String) = TimeParsing.parseAlarm(text)

    @Test
    fun `24 hour times`() {
        assertEquals(AlarmSpec(6, 30, ""), alarm("06:30"))
        assertEquals(AlarmSpec(19, 45, ""), alarm("19:45"))
        assertEquals(AlarmSpec(0, 0, ""), alarm("00:00"))
        assertEquals(AlarmSpec(23, 59, ""), alarm("23:59"))
    }

    @Test
    fun `am and pm`() {
        assertEquals(AlarmSpec(18, 30, ""), alarm("6:30 pm"))
        assertEquals(AlarmSpec(7, 0, ""), alarm("7 am"))
        assertEquals(AlarmSpec(0, 15, ""), alarm("12:15 AM"))
        assertEquals(AlarmSpec(12, 5, ""), alarm("12:05 pm"))
        assertEquals(AlarmSpec(21, 0, ""), alarm("9 p.m."))
    }

    @Test
    fun `dots, plain hours and baje`() {
        assertEquals(AlarmSpec(19, 45, ""), alarm("19.45"))
        assertEquals(AlarmSpec(7, 0, ""), alarm("7"))
        assertEquals(AlarmSpec(6, 0, ""), alarm("6 baje"))
        assertEquals(AlarmSpec(6, 0, ""), alarm("6 बजे"))
    }

    @Test
    fun `label after a pipe`() {
        assertEquals(AlarmSpec(6, 30, "gym"), alarm("06:30 | gym"))
    }

    @Test
    fun `invalid alarm times are rejected`() {
        assertNull(alarm("25:00"))
        assertNull(alarm("12:75"))
        assertNull(alarm("13 pm"))
        assertNull(alarm("tomorrow morning"))
        assertNull(alarm(""))
    }

    private fun timer(text: String) = TimeParsing.parseTimerSeconds(text)

    @Test
    fun `plain numbers are seconds`() {
        assertEquals(300, timer("300"))
        assertEquals(90, timer(" 90 "))
    }

    @Test
    fun `words with units`() {
        assertEquals(300, timer("5 minutes"))
        assertEquals(300, timer("5 min"))
        assertEquals(5400, timer("1 hour 30 minutes"))
        assertEquals(90, timer("90 sec"))
        assertEquals(3600, timer("1 hr"))
        assertEquals(150, timer("2.5 minutes"))
        assertEquals(150, timer("2,5 minutes"))
    }

    @Test
    fun `hindi units`() {
        assertEquals(7200, timer("2 घंटे"))
        assertEquals(600, timer("10 मिनट"))
        assertEquals(30, timer("30 सेकंड"))
    }

    @Test
    fun `timers are kept between one second and one day`() {
        assertEquals(86400, timer("999999"))
        assertEquals(86400, timer("30 hours"))
        assertNull(timer("0"))
        assertNull(timer("soon"))
        assertNull(timer(""))
        assertNotNull(timer("1"))
    }
}
