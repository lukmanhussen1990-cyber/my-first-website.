#!/usr/bin/env bash
# Full-resolution render of the film, detached from the terminal; resumable (see render/render.mjs).
cd "$(dirname "$0")/.."
exec node render/render.mjs --w 1080 --h 1920 --workers 3 --crf 14 --seg 90 --out out/video/film_raw.mp4
