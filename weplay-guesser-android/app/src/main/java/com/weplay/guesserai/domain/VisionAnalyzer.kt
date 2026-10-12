package com.weplay.guesserai.domain

/** Port to whatever vision model reads the game screen. */
interface VisionAnalyzer {
    /**
     * Streams the model's answer. [onPartial] is called (on a background thread) every time
     * another complete guess has arrived, so the overlay can update before the reply finishes.
     *
     * @param images full screenshot, or hint-bar + canvas close-ups
     */
    suspend fun analyze(
        images: FrameImages,
        hints: PromptHints,
        settings: AppSettings,
        onPartial: (PartialAnalysis) -> Unit = {},
    ): FrameAnalysis

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
    /** A setting that cannot work (no model ID, an address that is not a URL); nothing was sent. */
    class BadConfig(detail: String) : VisionException(detail)
}
