# 🔐 Terminal Password Manager

A command-line password manager written in Python. Everything is stored in a
single encrypted file protected by a master password.

```
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
└──────────────────────────────────┘
```

## Quick start

```bash
cd password-manager
python -m pip install -r requirements.txt   # just `cryptography`
python password_manager.py
```

The first run asks you to choose a master password and creates the vault at
`~/.password_manager/vault.json`. Every later run asks for the master password
to unlock it.

Options:

```
python password_manager.py --vault path/to/vault.json   # custom location
python password_manager.py --lock-timeout 300           # auto-lock after 5 min (0 = never)
PASSWORD_MANAGER_VAULT=/secure/vault.json python password_manager.py
```

Run the tests with:

```bash
python -m unittest -v
```

## Features

| Requirement | How it is met |
|---|---|
| Add / view / search / delete / exit | Menu options 1–5 |
| Website, username, password per account | `Account` dataclass |
| Local file storage | Single JSON vault file, written atomically with `0600` permissions |
| Hidden password typing | `getpass` for every password and master-password prompt |
| Passwords hidden in listings | Shown as `••••••••`; revealing (option 7) needs confirmation |
| Invalid menu input | Any unknown choice prints a hint and re-shows the menu |
| Missing vault file | First run walks you through creating one |
| No duplicate website + username | Rejected case-insensitively, with whitespace trimmed |

### Bonus features

* **Strong password generator** (option 8, or `g` when adding an account) using
  `secrets`; configurable length, symbols, and look-alike character filtering.
* **Encryption** – the whole vault (sites, usernames *and* passwords) is
  encrypted with AES-256-GCM. The key is derived from the master password with
  PBKDF2-HMAC-SHA256 (600,000 iterations, random 16-byte salt). The file header
  is authenticated as associated data, so tampering with the KDF parameters or
  ciphertext is detected.
* **Master password** – required to unlock; 3 attempts, then the program exits.
  Can be changed from the menu (the vault is re-encrypted with a fresh salt).
* **Clipboard copy** (option 6) via `pbcopy`, `wl-copy`, `xclip`, `xsel` or
  `clip`; the clipboard is cleared automatically after 30 seconds unless you
  have copied something else in the meantime.
* **Password-strength check** on every password you type or generate: entropy
  estimate plus penalties for common passwords, repeated characters and
  keyboard/alphabet sequences, with concrete suggestions.
* **Auto-lock** after 2 minutes of inactivity (configurable). Decrypted data and
  the key are wiped from memory; the master password is required to continue.

## Security notes

* The master password is never stored. If you forget it the vault cannot be
  recovered — that is the point.
* Secrets only exist in memory while the vault is unlocked. Python cannot
  guarantee memory is zeroed, so the auto-lock keeps that window short.
* Revealing a password on screen is opt-in and asks for confirmation.
* Vault writes go to a temporary file first and are then renamed into place, so
  a crash mid-write cannot corrupt the existing vault.

## Project layout

```
password-manager/
├── password_manager.py       # the program
├── test_password_manager.py  # unit tests (python -m unittest)
├── requirements.txt
└── README.md
```
