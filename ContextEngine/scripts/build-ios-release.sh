#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ARCHIVE_PATH=${CONTEXTENGINE_ARCHIVE_PATH:-"$ROOT_DIR/build/ContextEngine.xcarchive"}

xcodebuild \
  -workspace "$ROOT_DIR/ios/ContextEngine.xcworkspace" \
  -scheme ContextEngine \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  -allowProvisioningUpdates \
  archive

echo "Created iOS archive at $ARCHIVE_PATH"
