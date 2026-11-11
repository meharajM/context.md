# Voice transcription languages

English remains the default transcription language. Android downloads the English-only tiny.en model automatically; iOS uses its bundled tiny.en model. Settings offers an optional Hindi / Hinglish model on both platforms. After download, choose **Hindi / Hinglish** to use Whisper language auto-detection and preserve English words in code-switched speech. If Whisper identifies speech as English or the automatic transcript has no recognized Hindi/Hinglish evidence, the app retries it with Hindi as the primary language and accepts it when it contains Devanagari or common Romanized Hindi words.

## Optional Hindi / Hinglish model

| Property | Value |
|---|---|
| File | `ggml-base-q5_1.bin` |
| Source | [ggerganov/whisper.cpp on Hugging Face](https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base-q5_1.bin) |
| License | MIT |
| Size | 59,707,625 bytes (57 MiB) |
| SHA-256 | `422f1ae452ade6f30a004d7e5c6a43195e4433bc370bf23fac9cc591f01a8898` |

The upstream `whisper.cpp` memory table lists about 388 MB of runtime memory for the unquantized base model; it does not publish a peak-RAM figure for this Q5_1 build. Peak use on the Redmi must be measured during transcription.

The model stays in app-private storage. Settings downloads it over HTTPS using verified 16 MiB ranges; the transfer resumes from completed ranges after retry. Keep the app open until it finishes. Transcription runs locally and does not send recordings to the model host. Hindi and English code-switching starts with automatic detection; when Whisper reports English or returns text without recognized Hindi/Hinglish evidence, a Hindi-primary retry runs. The retry is selected when it contains Devanagari or common Romanized Hindi words. Because Whisper RN exposes no confidence score, uncommon Romanized Hindi may not qualify and some English-only retries may still sound Hindi-like; this heuristic can add noticeable time on slower devices. Recognition quality still depends on audio and device conditions.

Changing the selected language releases the current Whisper context and loads the selected model. The language cannot be changed while recording. Selecting English does not remove the optional Hindi model.
