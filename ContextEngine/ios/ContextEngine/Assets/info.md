# iOS Assets Architecture

iOS target asset storage.

## Contents

- `models`: native/model assets used by the iOS target when bundled.

## Policy

Large model artifacts should generally be downloaded at runtime or documented before bundling. If a model is bundled, record source, license, checksum, and expected size.
