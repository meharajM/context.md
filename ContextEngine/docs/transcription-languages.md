# Voice transcription languages

English remains the default transcription language. Android downloads the English-only tiny.en model automatically; iOS uses its bundled tiny.en model. Settings offers an optional Hindi / Hinglish model on both platforms. After download, choose **Hindi / Hinglish** to use Whisper language auto-detection and preserve English words in code-switched speech.

## Optional Hindi / Hinglish model

| Property | Value |
|---|---|
| File | `ggml-tiny-q5_1.bin` |
| Source | [ggerganov/whisper.cpp on Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-tiny-q5_1.bin) |
| License | MIT |
| Size | 32,152,673 bytes (31 MiB) |
| SHA-256 | `818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7` |

The model stays in app-private storage. Settings downloads it over HTTPS using verified 16 MiB ranges; the transfer resumes from completed ranges after retry. Keep the app open until it finishes. Transcription runs locally and does not send recordings to the model host. Hindi and English code-switching is configured for automatic language detection; recognition quality still depends on audio and device conditions.

Changing the selected language releases the current Whisper context and loads the selected model. The language cannot be changed while recording. Selecting English does not remove the optional Hindi model.
