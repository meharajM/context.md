# `src/features/readiness` Architecture

`DeviceReadinessNotice.tsx` shows a compact first-run summary of RAM, current available memory, free storage, OS version, and selected model requirements. When the selected model is missing, it offers an optional Download action and Continue without assistant. Below the model's total-RAM recommendation, it warns that inference may be slow or fail; captures remain in Inbox either way. Temporary resource gates can defer work. It does not claim that synthesis is scheduled by iOS or Android while the app is suspended.
