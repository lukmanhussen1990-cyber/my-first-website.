#!/usr/bin/env bash
# Restore the two official Duolingo files used by the film into the git-ignored
# assets/brand/ folder and verify them. They are never committed: this repo is public.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/brand

fetch() {  # url, destination, sha256
  curl -sS -L --compressed --fail --max-time 60 -o "$2.tmp" "$1"
  echo "$3  $2.tmp" | sha256sum --check --status || { echo "checksum mismatch for $1 (file changed upstream)"; rm -f "$2.tmp"; exit 1; }
  mv "$2.tmp" "$2"
  echo "ok  $2"
}

# Official wordmark: the press room's Duo-mark + "duolingo" lock-up (the film uses shape #1, the wordmark, untouched)
fetch "https://press.duolingo.com/2b2efbe1b1a37089bad6.svg" \
      assets/brand/duolingo_press_lockup.svg \
      256a0c38fe5fbbf6ff79a7915f30a388383e116b779e6c4cd4ce999c176a3213

# Official Duo, front-facing standing pose (Duolingo web app path character)
fetch "https://d35aaqx5ub95lt.cloudfront.net/images/pathCharacters/active/a506d9752e476f9e29b898c8350e21c6.svg" \
      assets/brand/duo_standing_front.svg \
      5bd589a6273ecb65ca7f6f7bbb2e5f1339b63f8855ef9b66458b6a6375f8cda5
