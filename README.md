# Nexus Clinical Pharmacist — v4.8 Tool Layer + Evidence Brief

This build focuses on engineering cleanup and separating the clinical brain from `api/chat.js`.

## What changed in v4.8

### 1) Cleanup build
- Rebuilt `style.css` with one `:root`, one dark theme block, and one mode-color block.
- Removed old PDF/share CSS leftovers such as `#shareTopBtn` and `#exportTopBtn`.
- Removed the v4.7 override section that relied on `!important`.
- Fixed `hideDisclaimer` so General/greeting messages do not get the clinical disclaimer during final rendering.
- Improved JSON fallback typewriter performance: renders in batches instead of parsing/sanitizing Markdown per character.
- Attachments now clearly mark PDF/images as metadata-only until extraction is implemented.

### 2) Backend Tool Layer
`api/chat.js` is now an orchestrator. Clinical logic moved into `/lib`:

```txt
/api
  chat.js

/lib
  data.js
  detector.js
  normalizer.js
  parser.js
  engines.js
  evidenceBrief.js
  composer.js

/data
  drug_aliases.json
  drug_monographs.json
  interactions.json
  clinical_rules.json
  risk_keywords.json
```

### 3) Evidence Brief
The AI composer now receives a structured Evidence Brief instead of raw scattered data. The local tools handle:

- mode detection
- drug name normalization
- local parsing
- interaction matching
- clinical rule triggering
- risk triage
- safety validation
- evidence/source packaging

The AI model’s role is mainly to compose a readable answer from the brief.

## Required Vercel environment variables

```env
NVIDIA_API_KEY=your_key_here
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=moonshotai/kimi-k2.6
NVIDIA_MAX_TOKENS=850
NEXUS_COMPOSER_TIMEOUT_MS=25000
```

Optional debugging:

```env
NEXUS_DEBUG_PIPELINE=true
```

When enabled, non-stream JSON responses can include the Evidence Brief for debugging.

## Supabase

The app still runs without Supabase in local demo mode. To enable persistence across devices, set these public frontend values in `index.html` or inject them before `script.js`:

```js
window.NEXUS_SUPABASE_URL = "your_supabase_url";
window.NEXUS_SUPABASE_ANON_KEY = "your_supabase_anon_key";
```

## Attachment support note

Current support:

- `.txt`, `.md`, `.csv`, `.json`: content is extracted and sent to the API.
- PDF/images: metadata only. The UI/API now explicitly notes that content was not extracted.

Proper PDF/image analysis should be implemented later with PDF text extraction, OCR, or a vision-capable route.

## Test prompts

```txt
Hi
```
Expected: local greeting, no AI call, no suggestions, no disclaimer.

```txt
ايه الفرق بين active ingredient و excipient؟
```
Expected: General Chat, light answer.

```txt
warfarin with amiodarone?
```
Expected: auto-switch to Drug Interaction.

```txt
Patient 65 years old, eGFR 28, taking metformin. Is it safe?
```
Expected: auto-switch to Case Analysis.


## v4.8.2 No-Auth Build

This build removes the login gate completely. The app opens directly into a local workspace and uses localStorage for chat history. Supabase Auth and Supabase database are not required for testing the model/API.

Keep only these Vercel environment variables for the AI endpoint:

```env
NVIDIA_API_KEY=your_key_here
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=moonshotai/kimi-k2.6
NVIDIA_MAX_TOKENS=850
NEXUS_FAST_LOCAL_FIRST=true
NEXUS_COMPOSER_TIMEOUT_MS=25000
```

The old auth UI is hidden and the workspace starts immediately.
