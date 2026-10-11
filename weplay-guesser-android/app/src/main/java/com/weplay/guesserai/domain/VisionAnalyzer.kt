package com.weplay.guesserai.domain

/** Port to whatever vision model reads the game screen. */
interface VisionAnalyzer {
    /**
     * @param jpeg screenshot of the game, already scaled down
     * @param knownAnswers answers confirmed in past rounds that fit the last seen hint
     */
    suspend fun analyze(jpeg: ByteArray, knownAnswers: List<String>, settings: AppSettings): FrameAnalysis

    /** Cheap request that only proves the key, endpoint and model work. */
    suspend fun testConnection(settings: AppSettings): Result<String>
}

/** Errors the overlay knows how to explain to the user. */
sealed class VisionException(message: String, cause: Throwable? = null) : Exception(message, cause) {
    class InvalidKey(cause: Throwable? = null) : VisionException("Invalid API key", cause)
    class ModelNotFound(model: String, cause: Throwable? = null) : VisionException("Model not found: $model", cause)
    class RateLimited(cause: Throwable? = null) : VisionException("Rate limited — slowing down", cause)
    class Refused(detail: String) : VisionException("AI declined this frame ($detail)")
    class Network(cause: Throwable? = null) : VisionException("Network error", cause)
    class BadResponse(detail: String, cause: Throwable? = null) : VisionException(detail, cause)
    class Server(code: Int, detail: String, cause: Throwable? = null) : VisionException("API error $code: $detail", cause)
}
