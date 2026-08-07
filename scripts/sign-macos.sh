#!/bin/bash
# Re-sign the packaged app with the project's self-signed certificate.
#
# WHY THIS EXISTS: electron-builder resolves signing identities via
# `security find-identity -v`, which lists only *trusted* certificates. A
# self-signed cert is CSSMERR_TP_NOT_TRUSTED, so electron-builder silently
# falls back to an ad-hoc signature. Ad-hoc signatures have a cdhash-based
# designated requirement that changes on every build, which is what makes
# macOS drop the Accessibility grant on every update. Signing by certificate
# SHA-1 with codesign directly bypasses the trust lookup and yields a stable,
# identity-based requirement that survives updates.
#
# The helper is signed with the APP's identifier on purpose — see README in
# CLAUDE.md; it lets a single Accessibility grant cover both binaries.
set -euo pipefail

APP="${1:?usage: sign-macos.sh <path-to-.app>}"
P12="${SIGN_P12:-$HOME/.alwaysjiggle-signing/AlwaysJiggle-signing.p12}"
P12_PASSWORD="${SIGN_P12_PASSWORD:-$(cat "$HOME/.alwaysjiggle-signing/p12-password.txt" 2>/dev/null || true)}"
APP_ID="$(node -p "require('$(dirname "$0")/../package.json').build.appId")"
HELPER="$APP/Contents/Resources/helpers/jiggle-helper"

[[ -f "$P12" ]] || { echo "FATAL: signing cert not found at $P12" >&2; exit 1; }
[[ -n "$P12_PASSWORD" ]] || { echo "FATAL: SIGN_P12_PASSWORD is empty" >&2; exit 1; }
[[ -d "$APP" ]] || { echo "FATAL: app not found at $APP" >&2; exit 1; }
[[ -f "$HELPER" ]] || { echo "FATAL: jiggle-helper missing from $APP — extraResources broken" >&2; exit 1; }

KEYCHAIN="$(mktemp -d)/signing.keychain"
KEYCHAIN_PASSWORD="$(openssl rand -base64 16)"
ORIGINAL_KEYCHAINS="$(security list-keychains -d user | sed 's/^ *//;s/"//g')"

cleanup() {
  security list-keychains -d user -s $ORIGINAL_KEYCHAINS 2>/dev/null || true
  security delete-keychain "$KEYCHAIN" 2>/dev/null || true
}
trap cleanup EXIT

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security import "$P12" -k "$KEYCHAIN" -P "$P12_PASSWORD" -T /usr/bin/codesign -A >/dev/null
# Without this, codesign triggers a GUI keychain-access prompt and hangs CI.
security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN" >/dev/null 2>&1
security list-keychains -d user -s $ORIGINAL_KEYCHAINS "$KEYCHAIN"

# Sign by SHA-1, not by name: name lookup goes through the trust check that
# rejects this certificate.
SHA1="$(security find-identity -p codesigning "$KEYCHAIN" | grep -oE '[0-9A-F]{40}' | head -1)"
[[ -n "$SHA1" ]] || { echo "FATAL: no signing identity found in imported keychain" >&2; exit 1; }
echo "[sign] identity $SHA1"

# --deep first (signs the Electron frameworks and helper apps), then override
# the jiggle-helper identifier, then re-seal the outer bundle. Re-signing the
# outer bundle last is required: touching a file under Contents/Resources
# invalidates the CodeResources seal.
codesign -f -s "$SHA1" --deep "$APP"
codesign -f -s "$SHA1" -i "$APP_ID" "$HELPER"
codesign -f -s "$SHA1" "$APP"

# Loud verification. A silent fallback to ad-hoc here is the exact failure this
# script exists to prevent, so assert the requirement rather than trusting it.
CERT_SHA1_LOWER="$(echo "$SHA1" | tr 'A-Z' 'a-z')"
# A self-signed certificate is both root and leaf of its chain, and codesign
# names it either way depending on how the chain resolves. Both forms are
# identity-based and stable across rebuilds; only a cdhash-based requirement
# is the failure we are guarding against.
EXPECTED_RE="^identifier \"$APP_ID\" and certificate (root|leaf) = H\"$CERT_SHA1_LOWER\"$"
for TARGET in "$APP" "$HELPER"; do
  ACTUAL="$(codesign -d -r- "$TARGET" 2>&1 | sed -n 's/^ *designated => //p')"
  if ! [[ "$ACTUAL" =~ $EXPECTED_RE ]]; then
    echo "FATAL: wrong designated requirement for $TARGET" >&2
    echo "  expected to match: $EXPECTED_RE" >&2
    echo "  actual:            $ACTUAL" >&2
    exit 1
  fi
  echo "[sign] OK $(basename "$TARGET"): $ACTUAL"
done

codesign -v --deep --strict "$APP" || { echo "FATAL: signature verification failed" >&2; exit 1; }
echo "[sign] signature valid"
