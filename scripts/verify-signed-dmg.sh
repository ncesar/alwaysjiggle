#!/bin/bash
# Assert that the app inside a built DMG carries the stable, certificate-based
# designated requirement — not an ad-hoc cdhash one.
#
# This is the ship-blocking check. electron-builder silently falls back to an
# ad-hoc signature whenever it cannot resolve a signing identity, and an ad-hoc
# requirement is cdhash-based, so it changes every build and drops every user's
# Accessibility grant. That failure is invisible in the DMG itself; the only way
# to catch it is to look at what actually shipped.
set -euo pipefail

DMG="${1:?usage: verify-signed-dmg.sh <path-to-.dmg>}"
DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ID="$(node -p "require('$DIR/../package.json').build.appId")"
EXPECTED_SHA1="$(tr 'A-Z' 'a-z' < "$DIR/signing-cert-sha1.txt" | tr -d '[:space:]')"

MOUNT="$(mktemp -d)"
hdiutil attach "$DMG" -mountpoint "$MOUNT" -nobrowse -quiet
trap 'hdiutil detach "$MOUNT" -quiet -force 2>/dev/null || true' EXIT

APP="$(find "$MOUNT" -maxdepth 1 -name '*.app' | head -1)"
[[ -n "$APP" ]] || { echo "FATAL: no .app inside $DMG" >&2; exit 1; }
HELPER="$APP/Contents/Resources/helpers/jiggle-helper"
[[ -f "$HELPER" ]] || { echo "FATAL: jiggle-helper missing from shipped app" >&2; exit 1; }

EXPECTED_RE="^identifier \"$APP_ID\" and certificate (root|leaf) = H\"$EXPECTED_SHA1\"$"
FAILED=0
for TARGET in "$APP" "$HELPER"; do
  ACTUAL="$(codesign -d -r- "$TARGET" 2>&1 | sed -n 's/^ *designated => //p')"
  if [[ "$ACTUAL" =~ $EXPECTED_RE ]]; then
    echo "[verify] OK $(basename "$TARGET")"
  else
    echo "FATAL: $(basename "$TARGET") has the wrong designated requirement" >&2
    echo "  expected to match: $EXPECTED_RE" >&2
    echo "  actual:            $ACTUAL" >&2
    FAILED=1
  fi
done
[[ $FAILED -eq 0 ]] || exit 1
echo "[verify] shipped DMG carries the stable requirement"
