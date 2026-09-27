// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.platform.ui;

public class InjectEventSecurityException extends Exception {
    public InjectEventSecurityException(String message) { super(message); }
    public InjectEventSecurityException(Throwable cause) { super(cause); }
}
