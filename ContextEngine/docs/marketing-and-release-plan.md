# Thought Notes: post-release quality and discoverability plan

**Updated:** 2026-11-09
**Scope:** Android 1.0.8 Meeting-mode listing and release submission.
**Spend status:** listing creative prepared and submitted; no paid advertising campaign was purchased or launched. The earlier ₹10,000 figure remains a proposal only.

The sections below began as a 1.0.7 marketing plan and include historical advice that predates Meeting mode. Android 1.0.8/code 9 published November 9. A follow-up full-description opening and screenshot order were submitted for Google review; the listing plan records both live and pending states. Until that review completes, the public listing keeps its prior description opening and screenshot order.

## Current release state

- Android 1.0.8 / version code 9 is live on Google Play, updated November 9, 2026.
- [Open Thought Notes on Google Play](https://play.google.com/store/apps/details?id=com.meharaj.contextengine).
- The submitted listing describes in-person English meeting capture, live timestamped transcription, automatic suggested actions, on-device AI summaries when the optional writing model is installed and resources allow, modular sharing, and saving meeting text as a note.
- The copy says no account, login, subscription, meeting link, or meeting-data cloud upload is needed. It also discloses first-use model-file downloads; selected shared text is sent only to the app the user chooses.
- The public gallery shows the Meeting ready and recording screenshots in positions 3 and 4; the follow-up moves them to positions 1 and 2. Its two changes are in review; the app remains installable meanwhile.
- The release includes the Android 14+ user-started model download path through JobScheduler UIDT, with WorkManager dataSync for automatic downloads and older Android. Downloads verify and resume completed byte ranges.
- The release tracker still has open phase-11 QA. This is a post-release quality risk, not a pending Play review.

## How the current app flow behaves

| User action | Current flow | User-facing limit |
|---|---|---|
| Tap Record in the Android widget | A microphone foreground service starts after the user's tap. The widget and notification expose Stop. Stop finalizes a WAV and schedules an expedited foreground handoff to save/recover the capture, run local Whisper transcription, then request topic synthesis. | If Android reports low memory or serious thermal pressure, Whisper startup is deferred and retried. The raw capture remains recoverable, but transcription may be late. Redmi 3S testing saw one transcript after about 10 minutes and two older recordings still without transcripts. |
| Submit text from the Android widget | Text is written to a durable outbox, imported to Inbox, then queued for local organization. | Inbox recovery protects the text if background work is stopped. Topic filing waits for the local model and resources. |
| Start a model download from Home or Settings | API 34+ explicit downloads use a visible UIDT job. Automatic downloads and explicit downloads on API 33 or lower use WorkManager with a visible dataSync notification. | Android controls scheduling and may stop/defer work. Verified ranges enable resumption; they do not guarantee uninterrupted or prompt completion. |
| Use the Balanced assistant | The app uses the same local synthesis path for topic routing, short summaries/refinement, tags, and clarification. Balanced raises configured output allowance from 1,024 to 2,048 tokens. | The model is about 2.59 GB and has a 6 GB total-RAM recommendation. Its full download and inference were not completed on the Redmi (about 2.7 GiB RAM); higher-memory physical-device behavior is unverified. |
| Process queued notes on iOS | The app requests opportunistic BGProcessingTask work and also retries on launch/foreground. | iOS may defer or expire background time. Physical-device execution and iOS publication are tracked separately. |

Balanced can offer stronger local topic matching and richer summaries for devices with enough memory. It does not add a new app action or a separate chat feature; it runs the existing synthesis tasks with a larger model and output budget. Market it as an optional model choice, not as a feature that every phone can run.

## What to say in marketing

**Recommended positioning:** Thought Notes captures voice notes and in-person meetings, transcribes English on-device, and uses optional on-device AI to organize related ideas and summarize meetings. No account, subscription, meeting link, or upload of meeting data to cloud services is needed; model files may download before first use.

Good first audiences to learn from are English-speaking Android users who collect work, study, personal-planning, or research ideas and want to find connections later. Start with a small group that can describe what they captured and whether they found the note again.

Keep claims specific:

- Say “English transcription on-device,” “meeting notes without an account or subscription,” and “topic organization when the local model is ready.”
- Disclose model-file downloads and resource-dependent summary availability; do not imply zero downloads or guaranteed AI output on every device.
- Describe background processing as best-effort and OS-scheduled. Do not promise an immediate transcript or completion while the app is closed.
- Do not claim multilingual speech transcription, always-listening, audio-file import, encrypted storage, universal model support, or guaranteed offline first use. Meeting mode is for in-person room audio through the phone or connected microphone; it does not record calls or audio inside other apps.
- The app uses local models and has no publisher analytics according to the current listing. Do not add analytics just to run this small campaign without updating the privacy and store disclosures first.

## Current listing and proposed experiment

The submitted listing leads with “On-device AI meeting notes. No account or subscription.” Its six screenshots cover topic organization, widget capture, Meeting ready/recording, background recording, and privacy. The feature graphic explains on-device meeting notes, no account/subscription, no cloud upload of meeting data, and model-file downloads when needed. See the agent plan for exact order and copy.

The current short description is:

> Capture the spark by voice. On-device AI finds its topic.

If the listing gets enough traffic for a meaningful Play experiment, test one short-description variant against it:

> Private English voice notes, transcribed on-device and organized by topic.

The candidate is 74 characters, within Play's 80-character short-description limit. It names English transcription and the main result without promising timing. Run only one text or asset test at a time and keep the current listing if Play reports a draw or needs more data.

Before changing the live listing, inspect the current acquisition report in Play Console. As of June/July 2026, the primary Store listing performance metrics focus on unique install/open/pre-registration clicks and CTR; break these down by traffic source, country, language, and UTM campaign where available. Do not optimize from the public 1+ badge or the old September/October report alone. [Play Console: understand app-user and listing performance](https://support.google.com/googleplay/android-developer/answer/9859173?hl=en), [Play Console: run listing experiments](https://support.google.com/googleplay/android-developer/answer/12053285?hl=en).

## 30-day plan

### Days 1–4: close the highest-impact Android gaps

Use a supported Android 14+ phone with at least 6 GB total RAM, stable Wi-Fi, and adequate free storage. Keep the current build and user data intact.

1. Run five widget voice captures while the app is minimized. Check that each Stop creates a durable note, the visible processing state is clear, and an intelligible transcript arrives without reopening the app. Save sample text and elapsed times.
2. Run five widget text captures while minimized and confirm they remain intact in Inbox and are eventually filed or clearly left waiting.
3. Exercise one explicit UIDT model download through minimization, screen-off, and a short network interruption; confirm the notification, byte progress, resume, final checksum, and installed state.
4. Download Balanced completely on that device, then test two representative typed notes and two voice transcripts through topic filing and summary. Confirm sensible clarification when the route is ambiguous and no irrelevant Health routing.
5. Increase Android font/display size and check that Stop, Save, Settings, model progress, and retry guidance remain usable.
6. Check crash/ANR state after those runs. Re-test the Redmi only if it is available; do not use its 2.7 GiB RAM result to judge Balanced performance on supported higher-memory devices.

These are proposed launch gates, not results already achieved. If a capture is lost, transcripts remain empty, routing is wrong, or download recovery fails on a supported device, pause paid promotion and make a focused fix before inviting a larger cohort. Keep the production build live while investigating unless a reproducible defect justifies a new release.

### Days 5–10: small organic cohort

Invite 10–20 people who already use Android voice notes, notes, or personal knowledge tools. Share the Play link and a short honest demo of widget capture → transcript → topic filing. Use synthetic demo content. Ask each person to try:

1. Write a short note.
2. Capture a short English voice note and wait for transcription.
3. Find or edit the resulting note.
4. If they want, install the local model and see whether topic organization is useful.

Collect voluntary, direct feedback on first-use clarity, transcript accuracy/timing, model download friction, and whether topic organization helps. Do not ask for a positive rating, offer incentives for installs/reviews, or treat a download as success if the first capture fails.

### Days 11–17: listing baseline, then one experiment

Review Play Store visitors, unique install clicks, CTR, traffic source, language, and country. Add UTM campaign values to links shared outside Google Play so external referrals can be compared. If volume is too small for a credible experiment, leave the listing alone and keep gathering organic feedback. If it is sufficient, test only the proposed short-description variant or one screenshot change; do not change both simultaneously.

### Days 18–22: first paid pilot, only after the QA gate

If the device checks and cohort show no blocking capture or model issue, use one Google App campaign for installs, limited to India and the English audience where the campaign controls permit. Start with current listing assets and the honest capture/organization message. Optimize for installs only; there is no verified in-app conversion event for an action-optimized campaign.

For install-volume App campaigns, Google recommends an average daily budget of at least 50 times the target CPI. A ₹500 average daily budget therefore corresponds to a target CPI of ₹10 or less. If Google Ads recommends a higher CPI, do not raise the budget automatically; defer the test or accept that the campaign will be too underfunded to learn. Google Ads can spend up to 2 times the average daily budget on a given day for most campaigns, so a five-calendar-day pilot at ₹500/day has up to ₹1,000/day exposure and a ₹5,000 upper exposure across those five days. Confirm the campaign's actual spending controls in the account before launch, monitor cost daily, and stop the pilot at the tranche limit.

Google Ads budget and bidding guidance: [App campaign setup and budget guidance](https://support.google.com/google-ads/answer/6167156?hl=en-EN), [spending limits and overdelivery](https://support.google.com/google-ads/answer/10486637?hl=en).

### Days 23–30: decide whether to use the reserve

Compare ad-reported installs/CPI with Play's listing visitors/clicks and the organic cohort's first-capture results. The two services can count different events. Do not infer retention or usefulness from impressions, clicks, or installs alone.

Release the reserved tranche only if:

- The high-memory device completed the capture, transcript, organization, and retrieval journey reliably.
- Feedback shows users understand when the model is ready and what background work may wait.
- Cost per install is acceptable for an app without an evidenced paid-conversion funnel.
- At least one tested audience or message has a clear reason to continue.

Otherwise keep the remaining budget unspent and fix the activation path or narrow the audience.

## Proposed ₹10,000 allocation

| Stage | Amount | Use |
|---|---:|---|
| Device QA and organic cohort | ₹0 media spend | Use existing devices and voluntary feedback; do not buy traffic before the core flow is credible. |
| First App campaign pilot | Up to ₹5,000 | One five-day India/English pilot, subject to the spending controls above and a passing QA gate. |
| Reserve | ₹5,000 | Keep unspent until the first pilot and feedback support a specific next test. |

This is a ceiling and decision framework, not a commitment to spend all of it. At the proposed ₹500/day budget, the nominal five-day budget is ₹2,500; Google Ads overdelivery means planning for exposure up to ₹5,000. If the account cannot enforce or monitor that limit, do not launch from this plan.

## Measurement without changing the app

- **Play listing:** visitors, unique install clicks, CTR, country, language, source, and UTM campaign.
- **Paid campaign:** total spend, reported installs, CPI, and link from ad creative to the actual listing.
- **Product activation:** direct, voluntary feedback from the 10–20 person cohort on whether they completed capture → transcript → find/edit. Keep only manually summarized feedback; do not collect note content.
- **Quality:** capture loss, empty or wrong transcripts, wrong topic routing, crashes/ANRs, and model download/resume failure.
- **Decision:** stop increasing spend if first capture or transcript completion is unreliable, even when CPI looks good.

Never buy reviews or incentivize installs or ratings. Google Play prohibits manipulating ratings, reviews, or install counts. [Google Play: ratings, reviews, and installs policy](https://support.google.com/googleplay/android-developer/answer/9898684?hl=en).

## Release decision

Android 1.0.8/code 9 and the refreshed listing were submitted to Google Play for review. The feature is not public until Google approves and rolls it out. Meeting QA exercised a real Redmi handset, including background capture, transcript persistence, sharing previews, and note saving; speech accuracy and reliable summary generation for long meetings remain open. See [implementation/status.json](../implementation/status.json) for current evidence. No paid campaign was launched.
