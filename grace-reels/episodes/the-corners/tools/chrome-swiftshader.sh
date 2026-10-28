#!/bin/sh
# Chromium no longer falls back to software WebGL on its own; opt in for GPU-less render machines.
exec /opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell "$@" --enable-unsafe-swiftshader
