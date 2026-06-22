# Nexus Clinical Brain v4.1 — Speed Fix

This version keeps the v4 UI and clinical-data MVP, but improves performance and output formatting.

## What changed in v4.1

- Fast local path: clear drug-interaction questions skip the AI parser.
- One AI call for obvious interactions instead of parser + composer.
- Default composer max tokens reduced to 850.
- Composer timeout fallback: after 25 seconds, Nexus returns a safe local summary instead of hanging.
- Stronger prompt: no ASCII diagrams, no code blocks in clinical explanations, shorter default answers.
- Real callout boxes for `[!WARNING]`, `[!IMPORTANT]`, and `[!INFO]`.
- Safer CSS for `pre/code` so accidental code blocks do not break mobile layout.
- Default model changed to `deepseek-ai/deepseek-v4-flash` if no environment variable is set.

## Recommended Vercel Environment Variables

```env
NVIDIA_API_KEY=your_key_here
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_MODEL=deepseek-ai/deepseek-v4-flash

# Optional tuning
NVIDIA_MAX_TOKENS=850
NVIDIA_TEMPERATURE=0.2
NVIDIA_TOP_P=0.9
NEXUS_FAST_LOCAL_FIRST=true
NEXUS_COMPOSER_TIMEOUT_MS=25000
```

If DeepSeek Flash is slow or unstable on your endpoint, switch back temporarily:

```env
NVIDIA_MODEL=moonshotai/kimi-k2.6
```

## Folder structure

```txt
index.html
style.css
script.js
vercel.json
api/chat.js
data/drug_aliases.json
data/drug_monographs.json
data/interactions.json
data/clinical_rules.json
data/risk_keywords.json
```

## Test questions

```txt
مريض 60 سنة بياخد ramipril و potassium supplement، مفيش K ولا creatinine حديث. ينفع؟
```

Expected: fast local parser, high risk, missing K/creatinine/eGFR, no reassurance.

```txt
Patient takes ramipril + diclofenac + furosemide. What is the risk?
```

Expected: triple whammy / AKI risk.

```txt
warfarin with amiodarone?
```

Expected: bleeding risk + INR monitoring.
