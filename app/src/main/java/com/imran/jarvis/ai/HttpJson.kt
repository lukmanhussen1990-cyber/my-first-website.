package com.imran.jarvis.ai

import java.io.IOException
import java.io.InterruptedIOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response

/** The raw answer of a web request: HTTP status code and body text. */
data class HttpReply(val code: Int, val body: String)

/** Sends JSON over HTTPS with coroutine-friendly cancellation. All three AI clients use this. */
class HttpJson(private val client: OkHttpClient = defaultClient()) {

    /**
     * POSTs [body] as JSON. Network problems are converted to [AiException.NoInternet] or
     * [AiException.Timeout]; HTTP error codes are NOT thrown here - the caller inspects [HttpReply.code].
     */
    suspend fun post(url: String, headers: Map<String, String>, body: String): HttpReply =
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url(url)
                .apply { headers.forEach { (name, value) -> header(name, value) } }
                .post(body.toRequestBody(JSON))
                .build()
            try {
                client.newCall(request).await()
            } catch (e: InterruptedIOException) {
                // SocketTimeoutException and OkHttp's own call timeout both end up here.
                throw AiException.Timeout(e)
            } catch (e: IOException) {
                throw AiException.NoInternet(e)
            }
        }

    private suspend fun Call.await(): HttpReply = suspendCancellableCoroutine { continuation ->
        continuation.invokeOnCancellation { cancel() }
        enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (continuation.isActive) continuation.resumeWithException(e)
            }

            override fun onResponse(call: Call, response: Response) {
                // Read the body here, on OkHttp's own thread, never on the main thread.
                val reply = try {
                    response.use { HttpReply(it.code, it.body.string()) }
                } catch (e: IOException) {
                    if (continuation.isActive) continuation.resumeWithException(e)
                    return
                }
                if (continuation.isActive) continuation.resume(reply)
            }
        })
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .callTimeout(60, TimeUnit.SECONDS)
            .build()
    }
}
