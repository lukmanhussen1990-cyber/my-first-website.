package com.runova.claude

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.runova.core.coach.CoachEngine
import com.runova.core.coach.CoachSnapshot
import com.runova.core.model.BodyProfile
import com.runova.core.model.GoalPeriod
import com.runova.core.model.Goals
import com.runova.core.model.RunRecord
import com.runova.core.model.UnitSystem
import com.runova.core.progress.AchievementInput
import com.runova.core.progress.Achievements
import com.runova.core.progress.Levels
import com.runova.core.stats.StatsCalculator
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.net.InetSocketAddress
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ClaudeCoachTest {

    private data class Recorded(val method: String, val path: String, val headers: Map<String, String>, val body: String)

    private class Canned(val status: Int, val body: String)

    private lateinit var server: HttpServer
    private val requests = CopyOnWriteArrayList<Recorded>()
    private var next: Canned = Canned(200, "{}")
    private val json = ObjectMapper()

    @Before
    fun start() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { ex ->
            val body = ex.requestBody.readBytes().decodeToString()
            val headers = ex.requestHeaders.entries.associate { (k, v) -> k.lowercase() to v.joinToString(",") }
            requests += Recorded(ex.requestMethod, ex.requestURI.path, headers, body)
            val bytes = next.body.encodeToByteArray()
            ex.responseHeaders.add("content-type", "application/json")
            ex.sendResponseHeaders(next.status, bytes.size.toLong())
            ex.responseBody.use { it.write(bytes) }
        }
        server.start()
    }

    @After
    fun stop() = server.stop(0)

    private fun coach() = ClaudeCoach(
        baseUrl = "http://127.0.0.1:${server.address.port}",
        timeout = Duration.ofSeconds(10),
        maxRetries = 0,
        dispatcher = Dispatchers.IO,
    )

    private val zone = ZoneId.of("Europe/Berlin")
    private val now = LocalDateTime.of(2026, 9, 30, 18, 0)

    private fun snapshot(): CoachSnapshot {
        val start = now.minusDays(1).atZone(zone).toInstant().toEpochMilli()
        val runs = listOf(RunRecord(1, start, start + 1_900_000, 1_800_000, 5_200.0, 380.0))
        val profile = BodyProfile(68.0, 172.0, 31)
        val goals = Goals()
        val today = now.toLocalDate()
        fun progress(p: GoalPeriod) = StatsCalculator.goalProgress(p, today, runs, zone, emptyMap(), profile, goals)
        val level = Levels.progress(420)
        return CoachSnapshot(
            now = now,
            zone = zone,
            name = "Alex",
            units = UnitSystem.METRIC,
            profile = profile,
            goals = goals,
            runs = runs,
            today = StatsCalculator.dayActivity(today, runs, zone, null, profile),
            daily = progress(GoalPeriod.DAILY),
            weekly = progress(GoalPeriod.WEEKLY),
            monthly = progress(GoalPeriod.MONTHLY),
            currentStreak = 1,
            longestStreak = 1,
            level = level,
            achievements = Achievements.evaluate(AchievementInput(runs, 1, level.level, 0, zone)),
        )
    }

    private fun message(content: String, stop: String, extra: String = "") =
        """{"id":"msg_01","type":"message","role":"assistant","model":"claude-opus-5-5","content":$content,"stop_reason":"$stop","stop_sequence":null$extra,"usage":{"input_tokens":12,"output_tokens":7}}"""

    private fun error(type: String, msg: String) = """{"type":"error","error":{"type":"$type","message":"$msg"}}"""

    private fun lastBody(): JsonNode = json.readTree(requests.last().body)

    @Test
    fun withoutKeyTheOfflineCoachAnswersAndNothingIsSent() = runBlocking {
        val s = snapshot()
        val reply = coach().reply(null, ClaudeModel.DEFAULT, emptyList(), "How is my streak?", s)
        val offline = assertIs<CoachReply.Offline>(reply)
        assertEquals(OfflineReason.NO_KEY, offline.reason)
        assertEquals(CoachEngine.answer("How is my streak?", s), offline.text)
        assertNull(offline.notice)
        assertTrue(requests.isEmpty())
    }

    @Test
    fun opusRequestUsesLowEffortAndDefaultFallbacks() = runBlocking {
        next = Canned(200, message("""[{"type":"thinking","thinking":"","signature":"sig"},{"type":"text","text":"Nice 5.2 km yesterday! "},{"type":"text","text":"Try an easy 5 km today."}]""", "end_turn"))
        val history = listOf(
            ChatTurn(false, "Hi Alex! I'm your coach."), // leading coach greeting is dropped
            ChatTurn(true, "What did I run yesterday?"),
            ChatTurn(false, "You ran 5.20 km."),
        )
        val reply = coach().reply("sk-ant-test-key", ClaudeModel.OPUS_5_5, history, "What should I run today?", snapshot())

        val fromClaude = assertIs<CoachReply.FromClaude>(reply)
        assertEquals("Nice 5.2 km yesterday! Try an easy 5 km today.", fromClaude.text)
        val req = requests.single()
        assertEquals("/v1/messages", req.path)
        assertEquals("sk-ant-test-key", req.headers["x-api-key"])
        assertTrue(req.headers["anthropic-beta"].orEmpty().contains(ClaudeCoach.FALLBACK_BETA))
        val body = lastBody()
        assertEquals("claude-opus-5-5", body["model"].asText())
        assertEquals("default", body["fallbacks"].asText())
        assertEquals("low", body["output_config"]["effort"].asText())
        assertFalse(body.has("thinking"), "Opus 5.5 always thinks adaptively; the field is omitted")
        assertEquals(16_000, body["max_tokens"].asInt())
        val system = body["system"].asText()
        assertTrue(system.startsWith("You are the RUNOVA Coach"))
        assertTrue(system.contains("<runner_data>\nRunner: Alex."))
        assertFalse(system.contains("\n    "), "instructions must not keep source indentation")
        val messages = body["messages"]
        assertEquals(listOf("user", "assistant", "user"), messages.map { it["role"].asText() })
        assertEquals("What should I run today?", messages[2]["content"].asText())
    }

    @Test
    fun haikuRequestOmitsEffortAndFallbacks() = runBlocking {
        next = Canned(200, message("""[{"type":"text","text":"Go for it!"}]""", "end_turn"))
        val reply = coach().reply("sk-ant-test-key", ClaudeModel.HAIKU_4_5, emptyList(), "Motivate me", snapshot())
        assertIs<CoachReply.FromClaude>(reply)
        val body = lastBody()
        assertEquals("claude-haiku-4-5", body["model"].asText())
        assertFalse(body.has("output_config"))
        assertFalse(body.has("fallbacks"))
        assertFalse(requests.last().headers["anthropic-beta"].orEmpty().contains("server-side-fallback"))
    }

    @Test
    fun declinedRequestFallsBackOffline() = runBlocking {
        next = Canned(200, message("[]", "refusal", ""","stop_details":{"type":"refusal","category":"cyber","explanation":"declined"}"""))
        val reply = coach().reply("sk-ant-test-key", ClaudeModel.OPUS_5_5, emptyList(), "hello", snapshot())
        val offline = assertIs<CoachReply.Offline>(reply)
        assertEquals(OfflineReason.DECLINED, offline.reason)
        assertTrue(offline.text.isNotBlank())
        assertTrue(offline.notice!!.contains("offline coach"))
    }

    @Test
    fun truncatedReplyIsMarked() = runBlocking {
        next = Canned(200, message("""[{"type":"text","text":"Week one: three easy runs"}]""", "max_tokens"))
        val reply = coach().reply("sk-ant-test-key", ClaudeModel.SONNET_5_5, emptyList(), "Plan my week", snapshot())
        assertEquals("Week one: three easy runs…", assertIs<CoachReply.FromClaude>(reply).text)
    }

    @Test
    fun apiErrorsMapToOfflineReasons() = runBlocking {
        val cases = listOf(
            Canned(401, error("authentication_error", "invalid x-api-key")) to OfflineReason.INVALID_KEY,
            Canned(403, error("permission_error", "no access")) to OfflineReason.NO_ACCESS,
            Canned(404, error("not_found_error", "model not found")) to OfflineReason.NO_ACCESS,
            Canned(429, error("rate_limit_error", "slow down")) to OfflineReason.RATE_LIMITED,
            Canned(500, error("api_error", "boom")) to OfflineReason.UNAVAILABLE,
            Canned(529, error("overloaded_error", "overloaded")) to OfflineReason.UNAVAILABLE,
            Canned(400, error("invalid_request_error", "bad")) to OfflineReason.FAILED,
        )
        for ((canned, expected) in cases) {
            next = canned
            val reply = coach().reply("sk-ant-test-key", ClaudeModel.OPUS_5_5, emptyList(), "How far did I run this week?", snapshot())
            assertEquals(expected, assertIs<CoachReply.Offline>(reply).reason, "HTTP ${canned.status}")
        }
    }

    @Test
    fun unreachableServerMeansNoConnection() = runBlocking {
        val port = server.address.port
        server.stop(0)
        val c = ClaudeCoach(baseUrl = "http://127.0.0.1:$port", timeout = Duration.ofSeconds(3), maxRetries = 0)
        val reply = c.reply("sk-ant-test-key", ClaudeModel.OPUS_5_5, emptyList(), "hi", snapshot())
        assertEquals(OfflineReason.NO_CONNECTION, assertIs<CoachReply.Offline>(reply).reason)
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0).also { it.start() }
    }

    @Test
    fun connectionTestUsesModelsApi() = runBlocking {
        next = Canned(200, """{"type":"model","id":"claude-opus-5-5","display_name":"Claude Opus 5.5","created_at":"2026-09-01T00:00:00Z"}""")
        val ok = coach().testConnection("sk-ant-test-key", ClaudeModel.OPUS_5_5)
        assertEquals("Connected. Claude Opus 5.5 is ready to coach you.", assertIs<ConnectionResult.Ok>(ok).message)
        assertEquals("GET", requests.last().method)
        assertEquals("/v1/models/claude-opus-5-5", requests.last().path)

        next = Canned(401, error("authentication_error", "invalid x-api-key"))
        val failed = assertIs<ConnectionResult.Failed>(coach().testConnection("sk-ant-bad", ClaudeModel.OPUS_5_5))
        assertEquals(OfflineReason.INVALID_KEY, failed.reason)
    }

    @Test
    fun conversationAlternatesAndStartsWithUser() {
        val turns = ClaudeCoach.conversation(
            listOf(
                ChatTurn(false, "Welcome!"),
                ChatTurn(true, "first"),
                ChatTurn(true, "second"),
                ChatTurn(false, "answer"),
                ChatTurn(false, "  "),
            ),
            "third",
        )
        assertEquals(listOf(true, false, true), turns.map { it.fromUser })
        assertEquals("first\n\nsecond", turns[0].text)
        assertEquals("third", turns.last().text)

        val long = (1..60).map { ChatTurn(it % 2 == 1, "m$it") }
        val trimmed = ClaudeCoach.conversation(long, "latest")
        assertTrue(trimmed.size <= ClaudeCoach.MAX_HISTORY_TURNS + 1)
        assertTrue(trimmed.first().fromUser)
        assertEquals("latest", trimmed.last().text)
    }
}
