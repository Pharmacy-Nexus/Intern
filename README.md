# Nexus Clinical Pharmacist — v4.9.0 Quick Access

This is the hard no-auth build. It opens the chat workspace directly and stores chats + Quick Access notes in `localStorage` for local/demo use.

## What changed in v4.9.0

Added **My Quick Access MVP**:

- Sidebar panel: `My Quick Access` with search, note count, insert/edit/delete.
- Save any message or selected text using the new `Quick` action under messages.
- Save note title + tags + content.
- Relevant saved notes can appear under assistant answers as `From My Quick Access`.
- Relevant notes are also sent to the API as **user-saved context**, clearly marked as unverified and not allowed to override Evidence Brief/safety rules.
- Local-only storage for now: `localStorage` key is user-scoped.

## Previous patches included

### v4.8.5 Complex Case Patch

- Complex-case suggested next questions prioritize hyperkalemia/AKI/INR/metformin together.
- Safer prescriber-directed wording in case-analysis prompt.
- Hyperkalemia + AKI/oliguria/dehydration gets stronger urgency handling.
- `Sources used` + `Confidence` are emphasized for complex cases.

### v4.8.4 Audit Fix

- API body-size limit: `NEXUS_MAX_BODY_BYTES` defaults to 1 MB.
- CORS allowlist support: `NEXUS_ALLOWED_ORIGINS`.
- API errors are generic to the client; provider details are logged server-side only.
- Stronger prompt-injection wording.
- Limited model conversation context: `NEXUS_MAX_CONTEXT_MESSAGES` defaults to 12.
- Sidebar close works on desktop and mobile.
- Vague human/person questions ask for clarification instead of returning out-of-scope.
- File upload is limited to readable text formats only: `.txt`, `.md`, `.csv`, `.json`.

## Deploy checklist

Upload the whole folder, including:

```txt
index.html
style.css
script.js
api/chat.js
lib/
data/
vercel.json
```

Vercel environment variables:

```env
NVIDIA_API_KEY=your_key_here
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=moonshotai/kimi-k2.6
NVIDIA_MAX_TOKENS=850
NEXUS_COMPOSER_TIMEOUT_MS=25000
NEXUS_MAX_CONTEXT_MESSAGES=12
NEXUS_MAX_BODY_BYTES=1048576
```

Recommended security variable:

```env
NEXUS_ALLOWED_ORIGINS=https://your-site.vercel.app
```

You can also set this if your app has a custom public URL:

```env
NEXUS_PUBLIC_APP_URL=https://your-domain.com
```

## If the page still shows old behavior

Open:

```txt
https://your-site.vercel.app/?reset=1
```

Then hard refresh / clear site data. This build cache-busts `style.css` and `script.js` with `?v=4.9.0`.

## Manual test checklist

- Save an assistant answer with the `Quick` button.
- Select only a few lines from an answer, then press `Quick`; only the selected text should be saved.
- Add tags like `renal, hyperkalemia` and search with `renal` or `#renal`.
- Press `Insert` on a Quick Access note; it should paste into the composer.
- Ask about a topic related to a saved note; a `From My Quick Access` box should appear under the answer.
- `Hi` should reply locally with no AI call.
- `warfarin with amiodarone?` should auto-switch to Drug Interaction.
- `Patient 65 years old, eGFR 28, taking metformin. Is it safe?` should auto-switch to Case Analysis.
