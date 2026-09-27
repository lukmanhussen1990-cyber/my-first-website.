// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.runner.lifecycle;

public enum Stage { PRE_ON_CREATE, CREATED, STARTED, RESUMED, PAUSED, STOPPED, RESTARTED, DESTROYED }
