# Arcade theme and tag photos — design addendum

Date: 2026-11-01. Extends `2026-10-31-mezastar-helper-design.md`.

## Goal
The player found the v1 UI too plain. Make it feel like the arcade machine ("Arcade bold") and show real card pictures, using **photos the player takes of their own tags**.

## Hard rule: no official artwork
- Do not add, download, hotlink or trace any official Pokémon / MEZASTAR images, sprites, logos or card art.
- Do not draw Pokémon characters or the Poké Ball design. The logo is an original star badge.
- Type icons are original simple glyphs (or the type name in a coloured pill). Names, types and grades as text are fine.
- Player photos never leave the device except inside the player's own backup file. They are not committed to the repo.

## Visual design ("Arcade bold")
- Dark background (deep navy/near-black) with a dark red top bar: an original star-badge logo, "MEZASTAR HELPER", a "★ V3" chip.
- Bright per-type colours (18 types) used for card frames, pills and gradients. Text contrast at least WCAG AA.
- **TagCard** component, the single way a tag is shown:
  - Picture area: the player's photo (`object-fit: cover`) if one exists, otherwise a type-coloured gradient with the type glyph(s) and the tag's name initial.
  - Name, id, type pills, grade stars, stats (HP/ATK/DEF/SPA/SPD/SPE when known, "?" otherwise), move and gimmick badge.
  - 6★ (Superstar) cards get a gold frame with a subtle animated shine; respect `prefers-reduced-motion`.
  - Sizes: `large` (Boss / target), `medium` (cronies, team), `small` (lists, picker results, chips).
- Play: a big Boss card, two crony cards side by side, then the team and plan. Plan steps look like a turn timeline ("Turn 1 ▶ Attacker → Target") with the trust badge.
- Collection: a grid of small cards; the owned toggle stays a 44px button with the same accessible name.
- Tab bar: bold icons + labels, the active tab highlighted in red/gold.
- Keep everything that exists: 44px tap targets, safe areas, `[hidden]`, focus rings, the banner, live regions, accessible names used by tests.

## Tag photos
- Collection → tag editor: "Add photo" / "Change photo" / "Remove photo". Uses `<input type="file" accept="image/*">` (iOS offers camera or library).
- Before storing, downscale on a canvas to max 600px on the long side, encode JPEG quality ~0.8. Reject non-images and decode failures with a clear message.
- Storage: new IndexedDB object store `photos` keyed by tag id, value `Blob`. DB version 2, upgrade guarded by `oldVersion < 2`; existing data untouched.
- UI: `useAppData` exposes `photos: Map<tagId, objectURL>`, `setPhoto(id, blob)`, `removePhoto(id)`. Object URLs are revoked when replaced/removed/unmounted.
- Backup: optional `photos: { [tagId]: dataURL }` field. Validation: known tag id, `data:image/(jpeg|png|webp);base64,` prefix, at most ~2 MB per photo. Old backups without `photos` still restore. Restore replaces photos together with everything else (all-or-nothing).
- Stats screen notes that backups include photos and may be larger.
