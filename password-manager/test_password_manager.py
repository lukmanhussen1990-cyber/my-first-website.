"""Unit tests for password_manager.py  (run with:  python -m unittest -v)"""

import json
import os
import stat
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

import password_manager as pm


class VaultTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "sub" / "vault.json"
        self.vault = pm.Vault(self.path)
        self.vault.create("correct horse battery staple")

    def tearDown(self):
        self.tmp.cleanup()

    def test_create_writes_file_with_restricted_permissions(self):
        self.assertTrue(self.path.is_file())
        if os.name == "posix":
            mode = stat.S_IMODE(self.path.stat().st_mode)
            self.assertEqual(mode, 0o600)

    def test_missing_file_is_reported_not_crashed(self):
        fresh = pm.Vault(Path(self.tmp.name) / "nope.json")
        self.assertFalse(fresh.exists())
        with self.assertRaises(pm.VaultError):
            fresh.unlock("anything")

    def test_round_trip_through_disk(self):
        self.vault.add(pm.Account("github.com", "alice", "s3cret!"))
        self.vault.add(pm.Account("Mail", "bob@example.com", "hunter22"))

        reopened = pm.Vault(self.path)
        reopened.unlock("correct horse battery staple")
        self.assertEqual(
            [(a.site, a.username, a.password) for a in reopened.accounts],
            [("github.com", "alice", "s3cret!"), ("Mail", "bob@example.com", "hunter22")],
        )

    def test_file_contains_no_plaintext(self):
        self.vault.add(pm.Account("github.com", "alice", "s3cret!"))
        raw = self.path.read_text()
        for secret in ("github.com", "alice", "s3cret!"):
            self.assertNotIn(secret, raw)
        self.assertEqual(json.loads(raw)["kdf"]["iterations"], pm.PBKDF2_ITERATIONS)

    def test_wrong_master_password_is_rejected(self):
        other = pm.Vault(self.path)
        with self.assertRaises(pm.WrongMasterPassword):
            other.unlock("wrong")
        self.assertFalse(other.is_unlocked)

    def test_duplicates_are_rejected_case_insensitively(self):
        self.vault.add(pm.Account("GitHub.com", "Alice", "x"))
        with self.assertRaises(pm.DuplicateAccount):
            self.vault.add(pm.Account("github.com ", " alice", "y"))
        # Same site, different user is fine.
        self.vault.add(pm.Account("github.com", "alice2", "y"))
        self.assertEqual(len(self.vault.accounts), 2)

    def test_empty_site_or_username_rejected(self):
        with self.assertRaises(pm.VaultError):
            self.vault.add(pm.Account("", "alice", "x"))
        with self.assertRaises(pm.VaultError):
            self.vault.add(pm.Account("site", "   ", "x"))

    def test_search_is_case_insensitive_substring(self):
        self.vault.add(pm.Account("github.com", "alice", "x"))
        self.vault.add(pm.Account("gitlab.com", "bob", "x"))
        self.vault.add(pm.Account("bank", "alice.smith", "x"))
        self.assertEqual([a.site for a in self.vault.search("GIT")], ["github.com", "gitlab.com"])
        self.assertEqual([a.site for a in self.vault.search("alice")], ["bank", "github.com"])
        self.assertEqual(self.vault.search("zzz"), [])
        self.assertEqual(len(self.vault.search("")), 3)

    def test_delete(self):
        acct = pm.Account("github.com", "alice", "x")
        self.vault.add(acct)
        self.vault.delete(acct)
        self.assertEqual(self.vault.accounts, [])
        with self.assertRaises(pm.AccountNotFound):
            self.vault.delete(acct)

    def test_lock_forgets_everything(self):
        self.vault.add(pm.Account("github.com", "alice", "x"))
        self.vault.lock()
        self.assertFalse(self.vault.is_unlocked)
        with self.assertRaises(pm.VaultError):
            _ = self.vault.accounts
        with self.assertRaises(pm.VaultError):
            self.vault.add(pm.Account("a", "b", "c"))

    def test_change_master_password(self):
        self.vault.add(pm.Account("github.com", "alice", "x"))
        self.vault.change_master_password("new master password")
        with self.assertRaises(pm.WrongMasterPassword):
            pm.Vault(self.path).unlock("correct horse battery staple")
        reopened = pm.Vault(self.path)
        reopened.unlock("new master password")
        self.assertEqual(reopened.accounts[0].password, "x")

    def test_tampered_header_is_detected(self):
        data = json.loads(self.path.read_text())
        data["kdf"]["iterations"] = 1  # try to weaken the KDF
        self.path.write_text(json.dumps(data))
        with self.assertRaises(pm.WrongMasterPassword):
            pm.Vault(self.path).unlock("correct horse battery staple")

    def test_tampered_ciphertext_is_detected(self):
        data = json.loads(self.path.read_text())
        ct = bytearray(pm._b64d(data["ciphertext"]))
        ct[0] ^= 0xFF
        data["ciphertext"] = pm._b64e(bytes(ct))
        self.path.write_text(json.dumps(data))
        with self.assertRaises(pm.WrongMasterPassword):
            pm.Vault(self.path).unlock("correct horse battery staple")

    def test_corrupt_files_raise_corrupt_vault(self):
        for content in ("not json", "{}", '{"version": 99}', '{"version":1,"kdf":{}}'):
            self.path.write_text(content)
            with self.assertRaises(pm.CorruptVault):
                pm.Vault(self.path).unlock("x")

    def test_create_refuses_to_overwrite(self):
        with self.assertRaises(pm.VaultError):
            pm.Vault(self.path).create("another")


class GeneratorTests(unittest.TestCase):
    def test_default_contains_every_class(self):
        for _ in range(50):
            pw = pm.generate_password()
            self.assertEqual(len(pw), 20)
            self.assertTrue(any(c.islower() for c in pw))
            self.assertTrue(any(c.isupper() for c in pw))
            self.assertTrue(any(c.isdigit() for c in pw))
            self.assertTrue(any(c in pm.SYMBOLS for c in pw))

    def test_options(self):
        pw = pm.generate_password(32, use_symbols=False, avoid_ambiguous=True)
        self.assertEqual(len(pw), 32)
        self.assertFalse(any(c in pm.SYMBOLS for c in pw))
        self.assertFalse(any(c in pm.AMBIGUOUS_CHARACTERS for c in pw))

    def test_invalid_options(self):
        with self.assertRaises(ValueError):
            pm.generate_password(2)
        with self.assertRaises(ValueError):
            pm.generate_password(10, use_upper=False, use_lower=False, use_digits=False, use_symbols=False)

    def test_passwords_are_unique(self):
        self.assertEqual(len({pm.generate_password() for _ in range(100)}), 100)


class StrengthTests(unittest.TestCase):
    def test_common_passwords_are_very_weak(self):
        for pw in ("password", "Password123!", "qwerty", "123456"):
            report = pm.check_strength(pw)
            self.assertEqual(report.score, 0, pw)
            self.assertIn("avoid common passwords", report.suggestions)

    def test_sequences_and_repeats_are_penalised(self):
        self.assertIn("avoid sequences like 'abcd' or '1234'", pm.check_strength("abcdefgh").suggestions)
        self.assertIn("avoid repeated characters", pm.check_strength("aaaBBB111").suggestions)

    def test_strength_increases_with_complexity(self):
        scores = [
            pm.check_strength("cat").score,
            pm.check_strength("kittenkitten").score,
            pm.check_strength("Kitten-Mitten-7").score,
            pm.check_strength(pm.generate_password(24)).score,
        ]
        self.assertEqual(scores, sorted(scores))
        self.assertEqual(scores[-1], 4)
        self.assertFalse(pm.check_strength("cat").is_acceptable)
        self.assertTrue(pm.check_strength("Kitten-Mitten-7").is_acceptable)

    def test_empty(self):
        self.assertEqual(pm.check_strength("").score, 0)


class InactivityMonitorTests(unittest.TestCase):
    def test_fires_after_timeout_and_resets_on_touch(self):
        fired = threading.Event()
        monitor = pm.InactivityMonitor(0.3, fired.set)
        monitor._stop = threading.Event()
        # Use a faster poll for the test by driving the check manually.
        monitor.touch()
        time.sleep(0.1)
        self.assertLess(monitor.idle_for(), 0.3)
        time.sleep(0.3)
        self.assertGreaterEqual(monitor.idle_for(), 0.3)
        monitor.touch()
        self.assertLess(monitor.idle_for(), 0.3)

    def test_disabled_when_timeout_zero(self):
        monitor = pm.InactivityMonitor(0, lambda: None)
        monitor.start()
        self.assertIsNone(monitor._thread)


class CliArgumentTests(unittest.TestCase):
    def test_defaults_and_overrides(self):
        args = pm.parse_args([])
        self.assertEqual(args.lock_timeout, pm.DEFAULT_LOCK_TIMEOUT_SECONDS)
        args = pm.parse_args(["--vault", "/tmp/x.json", "--lock-timeout", "5"])
        self.assertEqual(str(args.vault), "/tmp/x.json")
        self.assertEqual(args.lock_timeout, 5)

    def test_negative_timeout_rejected(self):
        self.assertEqual(pm.main(["--lock-timeout", "-1"]), 2)


if __name__ == "__main__":
    unittest.main()
