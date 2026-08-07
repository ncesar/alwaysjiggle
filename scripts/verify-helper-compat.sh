#!/bin/bash
# Assert the shipped Swift helper can actually load on every macOS the app claims
# to support.
#
# WHY THIS EXISTS: helpers/jiggle-helper is committed to git and CI copies it
# verbatim, so whatever a maintainer compiled locally is exactly what ships. Bare
# `swiftc` defaults the deployment target to the build machine's OS; compiled on
# macOS 26 the helper links /usr/lib/swift/libswift_DarwinFoundation2.dylib, which
# does not exist before macOS 26.0. dyld then fails with "Library not loaded" and
# the helper dies before main on every older system — while the app itself
# (minos 12.0) launches normally, so all three modes silently no-op.
#
# That shipped as v1.1.4. It is invisible from a macOS 26 machine, where the bad
# binary works fine, and neither signing guard catches it because the signature is
# perfectly valid. Hence a separate ship-blocking check.
#
# Fix when this fails:
#   swiftc -target arm64-apple-macos12.0 helpers/jiggle-helper.swift -o helpers/jiggle-helper
set -euo pipefail

APP="${1:?usage: verify-helper-compat.sh <path-to-.app>}"
HELPER="$APP/Contents/Resources/helpers/jiggle-helper"
PLIST="$APP/Contents/Info.plist"

[[ -d "$APP" ]]    || { echo "FATAL: app not found at $APP" >&2; exit 1; }
[[ -f "$HELPER" ]] || { echo "FATAL: jiggle-helper missing from $APP — extraResources broken" >&2; exit 1; }

# Read the floor from the BUILT app, not package.json: LSMinimumSystemVersion is
# inherited from Electron's own Info.plist and is never declared in our config.
APP_MIN="$(/usr/libexec/PlistBuddy -c 'Print :LSMinimumSystemVersion' "$PLIST" 2>/dev/null || true)"
HELPER_MIN="$(otool -l "$HELPER" | awk '/LC_BUILD_VERSION/{f=1} f && /^ *minos/{print $2; exit}')"

[[ -n "$APP_MIN" ]]    || { echo "FATAL: could not read LSMinimumSystemVersion from $PLIST" >&2; exit 1; }
[[ -n "$HELPER_MIN" ]] || { echo "FATAL: could not read LC_BUILD_VERSION minos from the helper" >&2; exit 1; }

echo "[compat] app supports macOS $APP_MIN and later"
echo "[compat] helper built for macOS $HELPER_MIN and later"

FIX="  Rebuild with: swiftc -target arm64-apple-macos${APP_MIN} helpers/jiggle-helper.swift -o helpers/jiggle-helper"

# 1. The helper's deployment target must not exceed what the app claims to support.
LOWEST="$(printf '%s\n%s\n' "$APP_MIN" "$HELPER_MIN" | sort -V | head -1)"
if [[ "$LOWEST" != "$HELPER_MIN" ]]; then
  echo "FATAL: helper requires macOS $HELPER_MIN but the app ships as macOS $APP_MIN+." >&2
  echo "  It would fail to load for every user below macOS $HELPER_MIN." >&2
  echo "$FIX" >&2
  exit 1
fi

# 2. Reject the split Swift overlay dylibs. The ABI-stable overlays present since
# 10.14.4 have no underscore (libswiftCore, libswiftDarwin, libswiftFoundation...);
# the newer split ones do (libswift_DarwinFoundation2, libswift_stdio,
# libswift_errno, libswift_time...) and exist only on recent systems. A non-weak
# one is fatal at load time, so treat any of them as a wrong-target build.
BAD="$(otool -L "$HELPER" | awk '{print $1}' | grep -E '^/usr/lib/swift/libswift_' || true)"
if [[ -n "$BAD" ]]; then
  echo "FATAL: helper links Swift overlay libraries absent on older macOS:" >&2
  echo "$BAD" | sed 's/^/    /' >&2
  echo "  These are added when the deployment target is too new; dyld will fail with" >&2
  echo "  \"Library not loaded\" and the helper will die before main." >&2
  echo "$FIX" >&2
  exit 1
fi

echo "[compat] no too-new Swift overlay dylibs"
echo "[compat] helper can load on macOS $APP_MIN and later"
