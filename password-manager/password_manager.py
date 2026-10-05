#!/usr/bin/env python3
"""
Terminal-based password manager.

Features
--------
* Add / view / search / delete accounts (website, username, password)
* Whole vault encrypted with AES-256-GCM, key derived from a master password
  via PBKDF2-HMAC-SHA256 (600,000 iterations, random salt)
* Passwords never echoed while typing, masked (••••••••) when listing
* Strong random password generator and password-strength checker
* Copy a password to the clipboard (auto-cleared after 30 seconds)
* Automatic lock after a period of inactivity
* Atomic, permission-restricted (0600) writes to the vault file

Dependencies: Python 3.8+ and the ``cryptography`` package
(``pip install cryptography``).
"""

from __future__ import annotations

import argparse
import base64
import getpass
import json
import math
import os
import re
import secrets
import shutil
import string
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Dict, List, Optional

try:
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
except ImportError:  # pragma: no cover - exercised only on a bare interpreter
    sys.stderr.write(
        "This program needs the 'cryptography' package.\n"
        "Install it with:  python -m pip install cryptography\n"
    )
    sys.exit(1)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_VAULT_PATH = Path.home() / ".password_manager" / "vault.json"
VAULT_FORMAT_VERSION = 1
PBKDF2_ITERATIONS = 600_000
KEY_LENGTH_BYTES = 32  # AES-256
SALT_LENGTH_BYTES = 16
NONCE_LENGTH_BYTES = 12  # recommended for AES-GCM
MASK = "•" * 8  # ••••••••
DEFAULT_LOCK_TIMEOUT_SECONDS = 120
CLIPBOARD_CLEAR_SECONDS = 30
MAX_UNLOCK_ATTEMPTS = 3
MIN_MASTER_PASSWORD_LENGTH = 8

# A tiny sample of the most common leaked passwords. Anything on (or
# containing only) one of these is treated as weak regardless of length.
COMMON_PASSWORDS = frozenset(
    {
        "password", "123456", "12345678", "qwerty", "abc123", "monkey",
        "letmein", "dragon", "111111", "baseball", "iloveyou", "trustno1",
        "sunshine", "master", "welcome", "shadow", "ashley", "football",
        "jesus", "michael", "ninja", "mustang", "password1", "admin",
        "passw0rd", "p@ssword", "qwerty123", "1q2w3e4r", "000000", "zaq12wsx",
    }
)


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class VaultError(Exception):
    """Base class for vault related problems."""


class WrongMasterPassword(VaultError):
    """Raised when the master password does not decrypt the vault."""


class CorruptVault(VaultError):
    """Raised when the vault file cannot be parsed."""


class DuplicateAccount(VaultError):
    """Raised when adding an account that already exists."""


class AccountNotFound(VaultError):
    """Raised when an account lookup fails."""


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass
class Account:
    site: str
    username: str
    password: str

    @property
    def key(self) -> str:
        """Case-insensitive identity used for duplicate detection."""
        return account_key(self.site, self.username)


def account_key(site: str, username: str) -> str:
    return f"{site.strip().casefold()}\x00{username.strip().casefold()}"


# ---------------------------------------------------------------------------
# Cryptography helpers
# ---------------------------------------------------------------------------


def derive_key(master_password: str, salt: bytes, iterations: int) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_LENGTH_BYTES,
        salt=salt,
        iterations=iterations,
    )
    return kdf.derive(master_password.encode("utf-8"))


def encrypt(key: bytes, plaintext: bytes, associated_data: bytes) -> Dict[str, str]:
    nonce = secrets.token_bytes(NONCE_LENGTH_BYTES)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, associated_data)
    return {"nonce": _b64e(nonce), "ciphertext": _b64e(ciphertext)}


def decrypt(key: bytes, nonce_b64: str, ciphertext_b64: str, associated_data: bytes) -> bytes:
    return AESGCM(key).decrypt(_b64d(nonce_b64), _b64d(ciphertext_b64), associated_data)


def _b64e(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def _b64d(text: str) -> bytes:
    try:
        return base64.b64decode(text, validate=True)
    except (ValueError, TypeError) as exc:
        raise CorruptVault("Vault contains invalid base64 data") from exc


# ---------------------------------------------------------------------------
# Vault: encrypted storage of accounts
# ---------------------------------------------------------------------------


class Vault:
    """
    An encrypted collection of accounts stored in a single JSON file.

    File layout (everything but the header is ciphertext)::

        {
          "version": 1,
          "kdf": {"name": "pbkdf2-sha256", "iterations": 600000, "salt": "..."},
          "nonce": "...",
          "ciphertext": "..."
        }

    The ciphertext is the JSON-encoded list of accounts, so websites and
    usernames are protected as well as passwords. The header is bound to the
    ciphertext as AES-GCM associated data, so tampering with the KDF
    parameters is detected.
    """

    def __init__(self, path: Path):
        self.path = Path(path)
        self._key: Optional[bytes] = None
        self._salt: Optional[bytes] = None
        self._iterations = PBKDF2_ITERATIONS
        self._accounts: List[Account] = []

    # -- state -----------------------------------------------------------

    def exists(self) -> bool:
        return self.path.is_file()

    @property
    def is_unlocked(self) -> bool:
        return self._key is not None

    @property
    def accounts(self) -> List[Account]:
        self._require_unlocked()
        return list(self._accounts)

    def lock(self) -> None:
        """Forget the key and the decrypted accounts."""
        self._key = None
        self._accounts = []

    # -- creation / unlocking -------------------------------------------

    def create(self, master_password: str) -> None:
        if self.exists():
            raise VaultError(f"A vault already exists at {self.path}")
        self._salt = secrets.token_bytes(SALT_LENGTH_BYTES)
        self._iterations = PBKDF2_ITERATIONS
        self._key = derive_key(master_password, self._salt, self._iterations)
        self._accounts = []
        self.save()

    def unlock(self, master_password: str) -> None:
        header, nonce, ciphertext = self._read_file()
        salt = _b64d(header["kdf"]["salt"])
        iterations = header["kdf"]["iterations"]
        key = derive_key(master_password, salt, iterations)
        try:
            plaintext = decrypt(key, nonce, ciphertext, self._associated_data(header))
        except InvalidTag as exc:
            raise WrongMasterPassword("Incorrect master password") from exc
        try:
            raw = json.loads(plaintext.decode("utf-8"))
            accounts = [Account(**item) for item in raw]
        except (ValueError, TypeError, UnicodeDecodeError) as exc:
            raise CorruptVault("Decrypted vault content is malformed") from exc
        self._key, self._salt, self._iterations = key, salt, iterations
        self._accounts = accounts

    def change_master_password(self, new_master_password: str) -> None:
        self._require_unlocked()
        self._salt = secrets.token_bytes(SALT_LENGTH_BYTES)
        self._iterations = PBKDF2_ITERATIONS
        self._key = derive_key(new_master_password, self._salt, self._iterations)
        self.save()

    # -- account operations ---------------------------------------------

    def add(self, account: Account) -> None:
        self._require_unlocked()
        if not account.site.strip() or not account.username.strip():
            raise VaultError("Website and username cannot be empty")
        if any(existing.key == account.key for existing in self._accounts):
            raise DuplicateAccount(
                f"An account for '{account.site}' with username "
                f"'{account.username}' already exists"
            )
        self._accounts.append(
            Account(account.site.strip(), account.username.strip(), account.password)
        )
        self._accounts.sort(key=lambda a: (a.site.casefold(), a.username.casefold()))
        self.save()

    def search(self, query: str) -> List[Account]:
        self._require_unlocked()
        needle = query.strip().casefold()
        if not needle:
            return list(self._accounts)
        return [
            a for a in self._accounts
            if needle in a.site.casefold() or needle in a.username.casefold()
        ]

    def delete(self, account: Account) -> None:
        self._require_unlocked()
        for index, existing in enumerate(self._accounts):
            if existing.key == account.key:
                del self._accounts[index]
                self.save()
                return
        raise AccountNotFound(f"No account for '{account.site}' / '{account.username}'")

    # -- persistence -----------------------------------------------------

    def save(self) -> None:
        self._require_unlocked()
        assert self._key is not None and self._salt is not None
        header = {
            "version": VAULT_FORMAT_VERSION,
            "kdf": {
                "name": "pbkdf2-sha256",
                "iterations": self._iterations,
                "salt": _b64e(self._salt),
            },
        }
        plaintext = json.dumps([asdict(a) for a in self._accounts]).encode("utf-8")
        payload = {**header, **encrypt(self._key, plaintext, self._associated_data(header))}
        self._atomic_write(json.dumps(payload, indent=2).encode("utf-8"))

    def _atomic_write(self, data: bytes) -> None:
        """Write to a temp file in the same directory, then rename over the vault."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(self.path.parent, 0o700)
        except OSError:
            pass  # best effort; not supported on every filesystem
        fd, tmp_name = tempfile.mkstemp(dir=str(self.path.parent), prefix=".vault-", suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.chmod(tmp_name, 0o600)
            os.replace(tmp_name, self.path)
        except Exception:
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
            raise

    def _read_file(self):
        try:
            text = self.path.read_text(encoding="utf-8")
        except FileNotFoundError as exc:
            raise VaultError(f"No vault found at {self.path}") from exc
        try:
            data = json.loads(text)
        except ValueError as exc:
            raise CorruptVault("Vault file is not valid JSON") from exc
        try:
            if data["version"] != VAULT_FORMAT_VERSION:
                raise CorruptVault(f"Unsupported vault version {data['version']!r}")
            header = {"version": data["version"], "kdf": dict(data["kdf"])}
            if not isinstance(header["kdf"]["iterations"], int) or header["kdf"]["iterations"] < 1:
                raise CorruptVault("Invalid KDF iteration count")
            header["kdf"]["salt"]  # noqa: B018 - presence check
            return header, data["nonce"], data["ciphertext"]
        except (KeyError, TypeError) as exc:
            raise CorruptVault("Vault file is missing required fields") from exc

    @staticmethod
    def _associated_data(header: dict) -> bytes:
        return json.dumps(header, sort_keys=True, separators=(",", ":")).encode("utf-8")

    def _require_unlocked(self) -> None:
        if not self.is_unlocked:
            raise VaultError("Vault is locked")


# ---------------------------------------------------------------------------
# Password generation and strength checking
# ---------------------------------------------------------------------------

AMBIGUOUS_CHARACTERS = set("Il1O0o|`'\"")
SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?/~"


def generate_password(
    length: int = 20,
    *,
    use_upper: bool = True,
    use_lower: bool = True,
    use_digits: bool = True,
    use_symbols: bool = True,
    avoid_ambiguous: bool = False,
) -> str:
    """Return a random password that contains at least one of every enabled class."""
    pools = []
    if use_lower:
        pools.append(string.ascii_lowercase)
    if use_upper:
        pools.append(string.ascii_uppercase)
    if use_digits:
        pools.append(string.digits)
    if use_symbols:
        pools.append(SYMBOLS)
    if not pools:
        raise ValueError("At least one character class must be enabled")
    if avoid_ambiguous:
        pools = ["".join(c for c in pool if c not in AMBIGUOUS_CHARACTERS) for pool in pools]
    if length < len(pools):
        raise ValueError(f"Length must be at least {len(pools)} for the selected classes")

    alphabet = "".join(pools)
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(length))
        if all(any(c in pool for c in candidate) for pool in pools):
            return candidate


@dataclass
class StrengthReport:
    score: int  # 0 (very weak) .. 4 (very strong)
    label: str
    entropy_bits: float
    suggestions: List[str]

    @property
    def is_acceptable(self) -> bool:
        return self.score >= 2


def check_strength(password: str) -> StrengthReport:
    """
    Heuristic strength estimate: estimated entropy, penalised for common
    passwords, repeated characters and simple keyboard/alphabetic sequences.
    """
    suggestions: List[str] = []
    if not password:
        return StrengthReport(0, "Very weak", 0.0, ["Enter a password"])

    pool = 0
    if re.search(r"[a-z]", password):
        pool += 26
    else:
        suggestions.append("add lowercase letters")
    if re.search(r"[A-Z]", password):
        pool += 26
    else:
        suggestions.append("add uppercase letters")
    if re.search(r"\d", password):
        pool += 10
    else:
        suggestions.append("add digits")
    if re.search(r"[^A-Za-z0-9]", password):
        pool += 33
    else:
        suggestions.append("add symbols")

    entropy = len(password) * math.log2(pool) if pool else 0.0

    lowered = password.casefold()
    stripped = re.sub(r"[^a-z]", "", lowered)
    if lowered in COMMON_PASSWORDS or (stripped and stripped in COMMON_PASSWORDS):
        entropy = min(entropy, 10.0)
        suggestions.insert(0, "avoid common passwords")
    if re.search(r"(.)\1{2,}", password):
        entropy *= 0.75
        suggestions.append("avoid repeated characters")
    if _has_sequence(lowered):
        entropy *= 0.75
        suggestions.append("avoid sequences like 'abcd' or '1234'")
    if len(password) < 12:
        suggestions.append("use at least 12 characters")

    if entropy < 28:
        score, label = 0, "Very weak"
    elif entropy < 40:
        score, label = 1, "Weak"
    elif entropy < 60:
        score, label = 2, "Fair"
    elif entropy < 80:
        score, label = 3, "Strong"
    else:
        score, label = 4, "Very strong"

    return StrengthReport(score, label, round(entropy, 1), suggestions)


def _has_sequence(text: str, run: int = 4) -> bool:
    """True if `text` contains `run` consecutive ascending/descending chars."""
    sequences = (
        string.ascii_lowercase,
        string.digits,
        "qwertyuiop", "asdfghjkl", "zxcvbnm",
    )
    for seq in sequences:
        for base in (seq, seq[::-1]):
            for i in range(len(base) - run + 1):
                if base[i : i + run] in text:
                    return True
    return False


# ---------------------------------------------------------------------------
# Clipboard
# ---------------------------------------------------------------------------


class Clipboard:
    """Copy text to the system clipboard using whatever tool is available."""

    def __init__(self) -> None:
        self._command = self._detect_command()
        self._paste_command = self._detect_paste_command()

    @property
    def available(self) -> bool:
        return self._command is not None

    @staticmethod
    def _detect_command() -> Optional[List[str]]:
        if sys.platform == "darwin" and shutil.which("pbcopy"):
            return ["pbcopy"]
        if sys.platform.startswith("win"):
            return ["clip"]
        if shutil.which("wl-copy") and os.environ.get("WAYLAND_DISPLAY"):
            return ["wl-copy"]
        if shutil.which("xclip") and os.environ.get("DISPLAY"):
            return ["xclip", "-selection", "clipboard"]
        if shutil.which("xsel") and os.environ.get("DISPLAY"):
            return ["xsel", "--clipboard", "--input"]
        if shutil.which("clip.exe"):  # WSL
            return ["clip.exe"]
        return None

    @staticmethod
    def _detect_paste_command() -> Optional[List[str]]:
        if sys.platform == "darwin" and shutil.which("pbpaste"):
            return ["pbpaste"]
        if shutil.which("wl-paste") and os.environ.get("WAYLAND_DISPLAY"):
            return ["wl-paste", "--no-newline"]
        if shutil.which("xclip") and os.environ.get("DISPLAY"):
            return ["xclip", "-selection", "clipboard", "-o"]
        if shutil.which("xsel") and os.environ.get("DISPLAY"):
            return ["xsel", "--clipboard", "--output"]
        return None

    def copy(self, text: str) -> None:
        if self._command is None:
            raise RuntimeError("No clipboard tool found (install xclip, xsel or wl-clipboard)")
        subprocess.run(self._command, input=text.encode("utf-8"), check=True, timeout=5)

    def clear_later(self, expected: str, delay: int) -> None:
        """Clear the clipboard after `delay` seconds (best effort, background)."""
        timer = threading.Timer(delay, self._clear_if_unchanged, args=(expected,))
        timer.daemon = True
        timer.start()

    def _clear_if_unchanged(self, expected: str) -> None:
        """Clear the clipboard unless the user has since copied something else."""
        try:
            if self._paste_command is not None:
                current = subprocess.run(
                    self._paste_command, capture_output=True, check=True, timeout=5
                ).stdout.decode("utf-8", "replace")
                if current != expected:
                    return
            self.copy("")
        except Exception:
            pass  # clearing is best effort; never crash the program for it


# ---------------------------------------------------------------------------
# Inactivity lock
# ---------------------------------------------------------------------------


class InactivityMonitor:
    """
    Calls `on_timeout` from a background thread once no activity has been
    registered for `timeout` seconds. Call `touch()` on every user action.
    """

    def __init__(self, timeout: float, on_timeout: Callable[[], None]):
        self.timeout = timeout
        self._on_timeout = on_timeout
        self._last_activity = time.monotonic()
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self.timeout <= 0 or self._thread is not None:
            return
        self._thread = threading.Thread(target=self._run, name="inactivity-monitor", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def touch(self) -> None:
        with self._lock:
            self._last_activity = time.monotonic()

    def idle_for(self) -> float:
        with self._lock:
            return time.monotonic() - self._last_activity

    def _run(self) -> None:
        while not self._stop.wait(1.0):
            if self.idle_for() >= self.timeout:
                self._on_timeout()
                self.touch()  # avoid firing again until the next idle period


# ---------------------------------------------------------------------------
# Command line interface
# ---------------------------------------------------------------------------


class ExitRequested(Exception):
    """Raised to leave the main loop cleanly."""


class PasswordManagerCLI:
    MENU = """
┌──────────────────────────────────┐
│       🔐  Password Manager       │
├──────────────────────────────────┤
│  1 → Add a password              │
│  2 → View saved accounts         │
│  3 → Search for an account       │
│  4 → Delete an account           │
│  5 → Exit                        │
├──────────────────────────────────┤
│  6 → Copy a password             │
│  7 → Reveal a password           │
│  8 → Generate a strong password  │
│  9 → Change master password      │
│  0 → Lock now                    │
└──────────────────────────────────┘"""

    def __init__(self, vault: Vault, lock_timeout: int = DEFAULT_LOCK_TIMEOUT_SECONDS):
        self.vault = vault
        self.clipboard = Clipboard()
        self._locked_by_timeout = threading.Event()
        self.monitor = InactivityMonitor(lock_timeout, self._on_inactivity)
        self.actions: Dict[str, Callable[[], None]] = {
            "1": self.add_account,
            "2": self.view_accounts,
            "3": self.search_accounts,
            "4": self.delete_account,
            "5": self.exit,
            "6": self.copy_password,
            "7": self.reveal_password,
            "8": self.generate_password_interactive,
            "9": self.change_master_password,
            "0": self.lock_now,
        }

    # -- main loop -------------------------------------------------------

    def run(self) -> int:
        try:
            if not self.vault.exists():
                self._first_run_setup()
            else:
                self._unlock_interactive()
            self.monitor.start()
            while True:
                self._ensure_unlocked()
                print(self.MENU)
                choice = self._input("Choose an option: ").strip()
                if self._locked_by_timeout.is_set():
                    # The keystroke only dismissed the lock notice; don't treat it as a choice.
                    self._ensure_unlocked()
                    continue
                if not choice:
                    continue
                action = self.actions.get(choice)
                if action is None:
                    print(f"⚠️  '{choice}' is not a valid option. Please enter a number from the menu.")
                    continue
                try:
                    action()
                except VaultError as exc:
                    print(f"⚠️  {exc}")
                except OSError as exc:
                    print(f"⚠️  File error: {exc}")
        except ExitRequested:
            pass
        except (KeyboardInterrupt, EOFError):
            print()
        finally:
            self.monitor.stop()
            self.vault.lock()
            print("👋 Vault locked. Goodbye!")
        return 0

    # -- unlocking ---------------------------------------------------------

    def _first_run_setup(self) -> None:
        print(f"No vault found at {self.vault.path}")
        print("Let's create one. Choose a master password - it protects everything else,")
        print("so make it long and unique. It is never stored anywhere.\n")
        master = self._prompt_new_master_password()
        print("Creating vault (this takes a moment)...")
        self.vault.create(master)
        print(f"✅ Vault created at {self.vault.path}")

    def _unlock_interactive(self) -> None:
        for attempt in range(1, MAX_UNLOCK_ATTEMPTS + 1):
            master = self._getpass("Master password: ")
            try:
                self.vault.unlock(master)
            except WrongMasterPassword:
                remaining = MAX_UNLOCK_ATTEMPTS - attempt
                if remaining:
                    print(f"❌ Incorrect master password. {remaining} attempt(s) left.")
                continue
            finally:
                del master
            count = len(self.vault.accounts)
            print(f"🔓 Vault unlocked — {count} account(s) stored.")
            return
        print("Too many failed attempts.")
        raise ExitRequested

    def _prompt_new_master_password(self) -> str:
        while True:
            master = self._getpass("New master password: ")
            if len(master) < MIN_MASTER_PASSWORD_LENGTH:
                print(f"⚠️  Use at least {MIN_MASTER_PASSWORD_LENGTH} characters.")
                continue
            report = check_strength(master)
            print(f"   Strength: {self._strength_bar(report)}")
            if not report.is_acceptable:
                print("   Suggestions: " + ", ".join(report.suggestions))
                if not self._confirm("Use this weak master password anyway?"):
                    continue
            if self._getpass("Confirm master password: ") != master:
                print("⚠️  Passwords do not match. Try again.")
                continue
            return master

    def _on_inactivity(self) -> None:
        """Runs on the monitor thread: wipe secrets and flag the main loop."""
        if self.vault.is_unlocked:
            self.vault.lock()
            self._locked_by_timeout.set()
            print(f"\n\n🔒 Locked after {self.monitor.timeout:.0f}s of inactivity. Press Enter to continue.")

    def _ensure_unlocked(self) -> None:
        if self._locked_by_timeout.is_set() or not self.vault.is_unlocked:
            self._locked_by_timeout.clear()
            print("\n🔒 The vault is locked. Enter your master password to continue.")
            self._unlock_interactive()
            self.monitor.touch()

    def lock_now(self) -> None:
        self.vault.lock()
        print("🔒 Vault locked.")

    def exit(self) -> None:
        raise ExitRequested

    # -- menu actions --------------------------------------------------------

    def add_account(self) -> None:
        print("\n➕ Add a password  (leave website empty to cancel)")
        site = self._input("Website/app: ").strip()
        if not site:
            print("Cancelled.")
            return
        username = self._input("Username: ").strip()
        if not username:
            print("⚠️  Username cannot be empty.")
            return
        if any(a.key == account_key(site, username) for a in self.vault.accounts):
            print(f"⚠️  An account for '{site}' with username '{username}' already exists.")
            return
        password = self._prompt_account_password()
        if password is None:
            print("Cancelled.")
            return
        self.vault.add(Account(site, username, password))
        print(f"✅ Saved {site} / {username}")

    def view_accounts(self) -> None:
        accounts = self.vault.accounts
        print()
        if not accounts:
            print("No accounts saved yet. Choose 1 to add one.")
            return
        self._print_table(accounts)

    def search_accounts(self) -> None:
        query = self._input("\n🔍 Search (website or username): ").strip()
        results = self.vault.search(query)
        print()
        if not results:
            print(f"No accounts match '{query}'.")
            return
        print(f"{len(results)} match(es):")
        self._print_table(results)

    def delete_account(self) -> None:
        account = self._pick_account("\n🗑  Delete an account")
        if account is None:
            return
        if not self._confirm(f"Really delete {account.site} / {account.username}?"):
            print("Cancelled.")
            return
        self.vault.delete(account)
        print("✅ Deleted.")

    def copy_password(self) -> None:
        if not self.clipboard.available:
            print("⚠️  No clipboard tool found. On Linux install xclip, xsel or wl-clipboard.")
            return
        account = self._pick_account("\n📋 Copy a password")
        if account is None:
            return
        try:
            self.clipboard.copy(account.password)
        except Exception as exc:  # subprocess failures, timeouts, ...
            print(f"⚠️  Could not copy to clipboard: {exc}")
            return
        self.clipboard.clear_later(account.password, CLIPBOARD_CLEAR_SECONDS)
        print(f"✅ Password for {account.site} copied. Clipboard clears in {CLIPBOARD_CLEAR_SECONDS}s.")

    def reveal_password(self) -> None:
        account = self._pick_account("\n👁  Reveal a password")
        if account is None:
            return
        if not self._confirm("Show the password on screen?"):
            return
        print(f"\n  {account.site} / {account.username}\n  Password: {account.password}\n")
        self._input("Press Enter to hide it...")
        # Push the password off-screen for anyone glancing at the terminal.
        print("\n" * 3)

    def generate_password_interactive(self) -> None:
        password = self._generate_dialog()
        if password is None:
            return
        print(f"\n  Generated: {password}")
        print(f"  Strength:  {self._strength_bar(check_strength(password))}")
        if self.clipboard.available and self._confirm("Copy it to the clipboard?"):
            try:
                self.clipboard.copy(password)
                self.clipboard.clear_later(password, CLIPBOARD_CLEAR_SECONDS)
                print(f"✅ Copied. Clipboard clears in {CLIPBOARD_CLEAR_SECONDS}s.")
            except Exception as exc:
                print(f"⚠️  Could not copy to clipboard: {exc}")

    def change_master_password(self) -> None:
        print("\n🔑 Change master password")
        current = self._getpass("Current master password: ")
        probe = Vault(self.vault.path)
        try:
            probe.unlock(current)
        except WrongMasterPassword:
            print("❌ Incorrect master password.")
            return
        finally:
            probe.lock()
            del current
        new_master = self._prompt_new_master_password()
        self.vault.change_master_password(new_master)
        print("✅ Master password changed. The vault has been re-encrypted.")

    # -- helpers -------------------------------------------------------------

    def _prompt_account_password(self) -> Optional[str]:
        while True:
            print("Password:  [Enter] type it   [g] generate one   [c] cancel")
            choice = self._input("> ").strip().lower()
            if choice == "c":
                return None
            if choice == "g":
                generated = self._generate_dialog()
                if generated is None:
                    continue
                print(f"  Generated: {generated}")
                print(f"  Strength:  {self._strength_bar(check_strength(generated))}")
                if self._confirm("Use this password?"):
                    return generated
                continue
            if choice != "":
                print("⚠️  Please press Enter, 'g' or 'c'.")
                continue
            password = self._getpass("Password (hidden): ")
            if not password:
                print("⚠️  Password cannot be empty.")
                continue
            report = check_strength(password)
            print(f"  Strength: {self._strength_bar(report)}")
            if not report.is_acceptable:
                print("  Suggestions: " + ", ".join(report.suggestions))
                if not self._confirm("Save this weak password anyway?"):
                    continue
            if self._getpass("Confirm password: ") != password:
                print("⚠️  Passwords do not match.")
                continue
            return password

    def _generate_dialog(self) -> Optional[str]:
        length = self._ask_int("Length", default=20, minimum=4, maximum=128)
        if length is None:
            return None
        symbols = self._confirm("Include symbols?", default=True)
        ambiguous = self._confirm("Avoid look-alike characters (l/1/I/O/0)?", default=False)
        return generate_password(length, use_symbols=symbols, avoid_ambiguous=ambiguous)

    def _pick_account(self, title: str) -> Optional[Account]:
        """Let the user choose one account by filtering and then by number."""
        accounts = self.vault.accounts
        if not accounts:
            print("\nNo accounts saved yet.")
            return None
        print(title)
        query = self._input("Filter by website/username (Enter for all): ")
        results = self.vault.search(query)
        if not results:
            print(f"No accounts match '{query.strip()}'.")
            return None
        self._print_table(results)
        index = self._ask_int("Account number (0 to cancel)", default=0, minimum=0, maximum=len(results))
        if not index:
            return None
        return results[index - 1]

    def _print_table(self, accounts: List[Account]) -> None:
        site_width = max(len("Website"), *(len(a.site) for a in accounts))
        user_width = max(len("Username"), *(len(a.username) for a in accounts))
        header = f"  {'#':>3}  {'Website':<{site_width}}  {'Username':<{user_width}}  Password"
        print(header)
        print("  " + "-" * (len(header) - 2))
        for number, account in enumerate(accounts, start=1):
            print(f"  {number:>3}  {account.site:<{site_width}}  {account.username:<{user_width}}  {MASK}")

    @staticmethod
    def _strength_bar(report: StrengthReport) -> str:
        filled = "█" * (report.score + 1)
        empty = "░" * (4 - report.score)
        return f"{filled}{empty} {report.label} (~{report.entropy_bits:.0f} bits)"

    def _input(self, prompt: str) -> str:
        """input() that also counts as activity for the inactivity monitor."""
        value = input(prompt)
        self.monitor.touch()
        return value

    def _getpass(self, prompt: str) -> str:
        """getpass() that also counts as activity for the inactivity monitor."""
        value = getpass.getpass(prompt)
        self.monitor.touch()
        return value

    def _confirm(self, question: str, default: bool = False) -> bool:
        hint = "Y/n" if default else "y/N"
        while True:
            answer = self._input(f"{question} [{hint}] ").strip().lower()
            if answer == "":
                return default
            if answer in ("y", "yes"):
                return True
            if answer in ("n", "no"):
                return False
            print("Please answer 'y' or 'n'.")

    def _ask_int(self, label: str, *, default: int, minimum: int, maximum: int) -> Optional[int]:
        while True:
            raw = self._input(f"{label} [{default}]: ").strip()
            if raw == "":
                return default
            try:
                value = int(raw)
            except ValueError:
                print(f"⚠️  '{raw}' is not a number.")
                continue
            if minimum <= value <= maximum:
                return value
            print(f"⚠️  Enter a number between {minimum} and {maximum}.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Encrypted terminal password manager.")
    parser.add_argument(
        "--vault",
        type=Path,
        default=Path(os.environ.get("PASSWORD_MANAGER_VAULT", DEFAULT_VAULT_PATH)),
        help=f"path to the vault file (default: {DEFAULT_VAULT_PATH}, "
        "or $PASSWORD_MANAGER_VAULT)",
    )
    parser.add_argument(
        "--lock-timeout",
        type=int,
        default=DEFAULT_LOCK_TIMEOUT_SECONDS,
        metavar="SECONDS",
        help=f"lock automatically after this many idle seconds, 0 to disable "
        f"(default: {DEFAULT_LOCK_TIMEOUT_SECONDS})",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)
    if args.lock_timeout < 0:
        print("--lock-timeout must be 0 or greater", file=sys.stderr)
        return 2
    try:
        cli = PasswordManagerCLI(Vault(args.vault), lock_timeout=args.lock_timeout)
        return cli.run()
    except CorruptVault as exc:
        print(f"❌ {exc}\n   The file {args.vault} is damaged or not a vault made by this program.", file=sys.stderr)
        return 1
    except VaultError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        return 1
    except OSError as exc:
        print(f"❌ File error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
