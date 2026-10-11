package com.imran.jarvis.ai

/**
 * Everything that can go wrong when asking an AI provider, in plain categories.
 * The UI turns each one into a friendly message (see Phrases).
 */
sealed class AiException(message: String, cause: Throwable? = null) : Exception(message, cause) {

    /** The user has not saved an API key for the chosen provider yet. */
    class NoApiKey : AiException("No API key saved")

    /** The phone cannot reach the internet (or the provider's servers). */
    class NoInternet(cause: Throwable? = null) : AiException("No internet connection", cause)

    class Timeout(cause: Throwable? = null) : AiException("The request took too long", cause)

    /** The key is missing, wrong, revoked or malformed. */
    class InvalidApiKey(val detail: String = "") : AiException("Invalid API key: $detail")

    /** The key is fine but is not allowed to do this (region, account or project restrictions). */
    class PermissionDenied(val detail: String = "") : AiException("Permission denied: $detail")

    /** The model name does not exist or is not available for this key. */
    class ModelNotFound(val model: String, val detail: String = "") : AiException("Model not found: $model")

    /** Too many requests, or a free-tier limit was reached. Trying again later helps. */
    class RateLimited(val detail: String = "") : AiException("Rate limited: $detail")

    /** The account is out of credit, or billing is not set up. */
    class QuotaOrBilling(val detail: String = "") : AiException("Quota or billing problem: $detail")

    /** The provider had a problem or is overloaded (HTTP 5xx / 529). */
    class ServerError(val code: Int, val detail: String = "") : AiException("Server error $code: $detail")

    /** The provider refused to answer this request (safety filters). */
    class Blocked(val detail: String = "") : AiException("Blocked: $detail")

    /** The provider answered with HTTP 200 but there was no text in it. */
    class EmptyReply : AiException("The AI returned an empty reply")

    /** Any other rejected request (HTTP 400 and friends). [detail] is the provider's own explanation. */
    class BadRequest(val code: Int, val detail: String = "") : AiException("Bad request $code: $detail")
}
