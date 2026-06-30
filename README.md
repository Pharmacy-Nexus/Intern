# Nexus Clinical Pharmacist — v5.0 Work Shelf

This build adds **Work Shelf**, a local workspace feature for collecting key clinical points from the chat and turning them into practical outputs.

## What changed in v5.0

- Added a **Work Shelf** section in the sidebar.
- Added a **Shelf** button under every message.
- Shelf button saves selected text if the user highlights part of a message, otherwise it saves the full message.
- Work Shelf auto-classifies saved items as case, risk, lab/risk, recommendation, counseling, or note.
- Added quick generators:
  - Pharmacist intervention note
  - Patient counseling script
  - Prescriber message
  - Monitoring plan
- Work Shelf is stored locally in `localStorage` for the current no-auth build.
- No backend/database migration required.

## Files changed in patch

```txt
index.html
style.css
script.js
README.md
```

## Manual test checklist

1. Open the app and ask any case question.
2. Highlight a recommendation from the answer and click **Shelf**.
3. Add 2–3 more items from different messages.
4. Check that Work Shelf count updates in the sidebar.
5. Click **Intervention**, **Counsel**, **Prescriber**, or **Monitor**.
6. Confirm Nexus sends a structured generation prompt in Case Analysis mode.
7. Double-click a shelf item to insert it into the composer.
8. Use **Clear** to empty the shelf.

## Notes

- Work Shelf items are user-provided working notes, not verified evidence by themselves.
- The generated prompt tells Nexus not to invent missing patient details and to keep safety wording pharmacist-appropriate.
- This is an MVP; later it can connect with Quick Access, Patient Context Panel, and Shadow Check.
