#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE=${CONTEXTENGINE_RELEASE_ENV_FILE:-"$ROOT_DIR/.env.release.local"}

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE; copy .env.release.example and fill the Apple values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${CONTEXTENGINE_APPLE_DISTRIBUTION_P12:?Set CONTEXTENGINE_APPLE_DISTRIBUTION_P12}"
: "${CONTEXTENGINE_APPLE_DISTRIBUTION_P12_PASSWORD:?Set CONTEXTENGINE_APPLE_DISTRIBUTION_P12_PASSWORD}"
: "${CONTEXTENGINE_APPLE_PROVISIONING_PROFILE:?Set CONTEXTENGINE_APPLE_PROVISIONING_PROFILE}"

if [ ! -f "$CONTEXTENGINE_APPLE_DISTRIBUTION_P12" ]; then
  echo "Apple Distribution P12 not found: $CONTEXTENGINE_APPLE_DISTRIBUTION_P12" >&2
  exit 1
fi
if [ ! -f "$CONTEXTENGINE_APPLE_PROVISIONING_PROFILE" ]; then
  echo "App Store provisioning profile not found: $CONTEXTENGINE_APPLE_PROVISIONING_PROFILE" >&2
  exit 1
fi

LOGIN_KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
security import "$CONTEXTENGINE_APPLE_DISTRIBUTION_P12" \
  -k "$LOGIN_KEYCHAIN" \
  -P "$CONTEXTENGINE_APPLE_DISTRIBUTION_P12_PASSWORD" \
  -T /usr/bin/codesign \
  -T /usr/bin/security

PROFILE_UUID=$(security cms -D -i "$CONTEXTENGINE_APPLE_PROVISIONING_PROFILE" | \
  plutil -extract UUID raw -o - -)
PROFILE_DIR="$HOME/Library/Developer/Xcode/UserData/Provisioning Profiles"
mkdir -p "$PROFILE_DIR"
cp "$CONTEXTENGINE_APPLE_PROVISIONING_PROFILE" "$PROFILE_DIR/$PROFILE_UUID.mobileprovision"

security find-identity -v -p codesigning | grep 'Apple Distribution:'
echo "Installed Apple Distribution identity and provisioning profile $PROFILE_UUID."
