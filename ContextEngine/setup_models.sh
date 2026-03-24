#!/bin/bash

# Setup script for Context Engine model files

ASSETS_DIR="ios/ContextEngine/Assets"
mkdir -p $ASSETS_DIR

echo "📥 Downloading Whisper Tiny model..."
curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin -o "$ASSETS_DIR/whisper-tiny.en.bin"

echo "📥 Downloading Sherpa-ONNX Keyword Spotting model placeholder..."
# This is a placeholder URL - user may need to provide their own specific Sherpa models
# curl -L ... -o "$ASSETS_DIR/kws_model.onnx"

echo "✅ Models setup complete. Remember to add these files to your Xcode project manually if not automatically detected."
