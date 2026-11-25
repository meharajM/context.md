# Multilingual language support (source change)

This change targets the United States and the four European listing locales previously selected for Thought Notes: English, Spanish, French, German, and Italian. The visible app interface remains English; Settings presents the language names in their native form.

## Model findings

- Google describes Gemma 3, Gemma 3n, and Gemma 4 as trained on multilingual data covering over 140 languages. The public cards do not provide a full per-language list or accuracy guarantee for the app's exact LiteRT artifacts. English, Spanish, French, German, and Italian are the product's selected target languages, not a claim that every converted model has been validated in each one.
- Gemma 3 1B is not documented as English-only. Google's Gemma 3 model card includes it in multilingual benchmarks, but its reported multilingual scores are materially below the larger 4B+ variants. The catalog therefore keeps it as the compact low-resource option and Settings recommends a larger model for stronger multilingual output.
- Gemma 3n E2B remains the English speech-and-writing route on eligible physical devices. Although Gemma 4 E2B/E4B model documentation includes audio input, this app's current LiteRT catalog only enables Gemma 3n for its audio route. For Spanish, French, German, and Italian, the app routes speech to Whisper with an explicit language code so it does not depend on an unpublished per-language Gemma audio list.
- Gemma 3n E2B and Gemma 4 E2B/E4B are recommended for stronger multilingual text output. The app prompts synthesis in the selected language, but generated-language quality on these specific LiteRT conversions still needs device validation.
- LiteRT-LM remains pinned at 0.14.0. The project already has compatible Gemma 3n and Gemma 4 LiteRT model entries, so this change does not add a model-runtime upgrade or a new large LiteRT artifact.

## Whisper artifacts

The English path retains the current English-only tiny Q5_1 artifact. Spanish, French, German, and Italian use the multilingual tiny Q5_1 artifact from the `ggerganov/whisper.cpp` model repository.

| Artifact | Size | SHA-256 | License | Languages used here |
| --- | ---: | --- | --- | --- |
| `ggml-tiny.en-q5_1.bin` | 32,166,155 bytes | `c77c5766f1cef09b6b7d47f21b546cbddd4157886b3b5d6d4f709e91e66c7c2b` | MIT | English |
| `ggml-tiny-q5_1.bin` | 32,152,673 bytes | `818710568da3ca15689e31a743197b520007872ff9576237bda97bd1b469c3d7` | MIT | Spanish, French, German, Italian |

The multilingual model is pinned to Hugging Face revision `fb5ed9369c26eaf08392504d8446da431e0fffb9`. The app verifies the exact byte length and SHA-256 before installation. Model weights are downloaded to app-private storage and are not committed to Git.

## Sources

- [Google Gemma 3 model card](https://gemma.ai/models/gemma-3/)
- [Google Gemma 3n overview](https://ai.google.dev/gemma/docs/gemma-3n)
- [Google Gemma 4 model card](https://github.com/google-gemma/docs/blob/main/docs/models/gemma-4/model-card.md)
- [Whisper.cpp model repository](https://huggingface.co/ggerganov/whisper.cpp/tree/fb5ed9369c26eaf08392504d8446da431e0fffb9)

## Behavior and limits

- Users choose a primary spoken language in Settings. The preference is stored in the version 6 settings record and any valid saved choice remains authoritative. A fresh install or legacy record without a language uses the device's regional locale: supported non-English language tags win, otherwise US/GB/IE map to English, ES to Spanish, FR to French, DE/AT to German, and IT to Italian; English is the fallback. The OS does not expose Google Play's install country reliably, so configured device locale/region is the proxy.
- Automatic physical-device writing-model selection uses total RAM and free storage: Gemma 3n E2B for eligible English devices at its 8 GiB threshold, Gemma 4 E4B for multilingual output at 8 GiB, Gemma 4 E2B at 6 GiB, and Gemma3-1B below those thresholds. Simulators keep Gemma3-1B. Automatic downloads also require available-memory/thermal readiness and storage headroom; manual model selections remain available.
- Startup downloads the Whisper artifact matching the inferred or saved language only when that artifact is missing, current resources are available, and the device has space for the model plus one 16 MiB transfer range. The German and other non-English locales share the verified multilingual tiny model.
- Voice transcription and local AI prompts use the selected language. AI summaries and newly proposed topic labels are requested in that language; stored original captures are preserved.
- Meeting transcription uses the selected Whisper language when the selected Gemma audio route is not English.
- This source change covers voice capture and AI note organization. The rest of the interface and deterministic reminder phrase/date parsing are not localized here; the published app and Play listing also remain unchanged until a validated release.
- This is a source implementation. Physical speech quality, transcription latency, and generated-language quality have not been validated for Spanish, French, German, or Italian. Model training coverage is not a quality guarantee.
- The language picker localizes language names only. Full app UI translation and localized Play listings are outside this change.
