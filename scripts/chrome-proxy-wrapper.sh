#!/usr/bin/env bash
# Only needed in sandboxes where all internet access must go through $HTTPS_PROXY.
# Remotion launches Chrome with --no-proxy-server, which blocks Google Fonts there.
# This wrapper removes those flags and routes Chrome through the proxy instead.
# Enabled by setting RENDER_VIA_PROXY=1 (see remotion.config.ts / scripts/stills.mjs).
HERE="$(cd "$(dirname "$0")" && pwd)"
REAL="${REMOTION_REAL_CHROME:-$HERE/../node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell}"
args=()
for a in "$@"; do
  case "$a" in
    --no-proxy-server|--proxy-server=*|--proxy-bypass-list=*) ;;
    *) args+=("$a") ;;
  esac
done
exec "$REAL" "${args[@]}" "--proxy-server=${HTTPS_PROXY:-$https_proxy}" "--proxy-bypass-list=localhost;127.0.0.1"
