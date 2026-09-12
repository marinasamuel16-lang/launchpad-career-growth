# Career foundation, Memory, and Daily Check-In

## Scope
Extend the existing app without changing Today, the bottom navigation, the purple brand, or the current XP/level display.

## What will change
1. Add the four requested private tables in one additive migration, with ownership policies, grants, constraints, and indexes. Copy existing goals and journey history without moving or deleting originals. Keep active goals and the existing profile goal synchronized in both directions.
2. Add **My Career** at `/career`, reachable from Profile only. Include combined server-side search and category filters, monthly grouping, manual add/edit/delete, confirmations, and distinct loading, error, empty, and no-match states.
3. Open the new **Daily Check-In** from the existing Profile check-in control. Save or update today's mood and optional note, then attempt grounded extraction of up to three memories. Show only truthful save/extraction confirmations and a My Career link.
4. Harden existing XP server functions: verify ownership and actual completion, prevent repeated or concurrent awards, validate reversals, and preserve the event audit trail. Update Profile callers while retaining the existing visible XP experience.

## Technical details
- All new user-data operations use authenticated server functions, Zod, and user-scoped queries. Database policies enforce isolation independently of UI.
- User IDs remain ownership columns; no new foreign keys into the managed auth schema. Nullable links to public tables are validated for ownership where applicable.
- Check-in saving precedes best-effort extraction. Repeat saves must not duplicate extracted memories; concurrent edits must not apply extraction from an outdated note. No-note saves remain valid.
- Use the existing configured Gemini gateway model and log `checkin_extract` calls server-side. Do not gate check-in behind subscription changes.
- Gateway failures do not roll back the saved check-in. Terminal gateway failures stop extraction; do not automatically retry them.
- Keep existing journey readers and onboarding behavior untouched. Preserve manual edits to extracted memories when reprocessing notes.

## Verification
Verify ownership, goal synchronization, idempotent backfills and XP awards; exercise manual memory CRUD, combined filters, check-in prefill/update, mood-only saves, extraction, and failure fallback. Check desktop and 375px layout and accessible controls. Run available lint and targeted tests; the platform performs build/type validation automatically.
