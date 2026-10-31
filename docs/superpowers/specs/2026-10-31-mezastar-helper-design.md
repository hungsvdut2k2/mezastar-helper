# Mezastar Helper — Design

Date: 2026-10-31
Status: Approved in brainstorming, pending written review

## Goal

Help one player of **Pokémon Mezastar: Stardust Version 3 (Asia English machines)** catch as many Superstar Pokémon as possible by advising them before and during each play, and by learning from their own results.

The app cannot connect to or see the arcade machine. The player tells the app what is on screen with a few taps; the app advises from that input plus researched game data.

## Platform and hosting

- Installable web app (PWA): React + TypeScript, built with Vite.
- Hosted free on GitHub Pages. The player opens the URL once in Safari on iPhone and uses **Share → Add to Home Screen**.
- Works fully offline after the first load (service worker caches the app and the game data).
- No server, no database, no paid services. All player data stays on the phone in IndexedDB.
- Updates arrive automatically the next time the app is opened with internet.
- Out of scope: native iOS app, NFC/camera tag reading, reading the arcade screen with the camera.

## Screens

Bottom tab bar, designed for one-handed phone use.

1. **Play** (live helper at the machine)
   - Player selects the wild Pokémon offered on screen from a searchable list.
   - App shows the top 3 teams of 3 tags from the player's collection, each with a one-line reason.
   - Each team shows an **attack plan**: suggested order to use the tags and when to use special attacks (e.g. Allies' Attack). Advice is given before the battle, not live.
   - Ends with a quick log entry (about 10 seconds), see Play log.
2. **Plan** (at home)
   - Player picks a target (e.g. a Superstar in the set); app shows the best team they own, the reason, and the attack plan.
3. **Collection**
   - Every tag in the set, searchable by name or number, marked owned or missing. Tap to toggle.
   - Owned count out of total.
   - Tap a tag to view its data and correct any field (see Data corrections).
4. **Guide**
   - Plain-language explanations of mechanics: grades, Superstars, battle turn order, special attacks, catching, type chart.
   - Every fact shows a trust level and source link.
5. **Stats**
   - Built only from the player's play log: plays, wins, catches, catch rate (overall, by win/loss, by target grade), Superstars seen, win rate by attack order used.
   - Backup and restore buttons.

## Code structure

Each folder has one job and can be tested without the others.

```
src/
  data/      researched game data as JSON + TypeScript types
  engine/    pure logic: type effectiveness, team scoring, attack plan, stats
  storage/   IndexedDB access: collection, corrections, play log, backup/restore
  ui/        the five screens and shared components
```

- `ui/` depends on `engine/` and `storage/`.
- `engine/` depends only on `data/` types; no browser APIs, so it is fully unit-testable.
- `storage/` depends only on `data/` types.

## Game data

### Sources and research
- Tag list for Stardust Version 3 (Asia English) from the official Mezastar Asia site.
- Per-tag details (types, grade, stats, energy, moves) and mechanics from fan wikis and community guides.
- Standard Pokémon type chart (18 types) for effectiveness.

### Trust levels
Every mechanic in the Guide and every rule used by the attack plan has:
- `trust`: `confirmed` (official source), `community` (reported by several independent players), or `unverified` (single source or unclear).
- `sources`: list of URLs.

Unknown fields are stored as `null` and shown as "unknown". The app never fills gaps with guesses.

### Tag record (shape)
```ts
type Tag = {
  id: string;            // set + number, e.g. "SD3-012"
  name: string;
  number: string;        // as printed on the tag
  types: PokemonType[];  // 1 or 2
  grade: number | null;  // star grade; Superstar flagged separately
  superstar: boolean;
  stats: { hp: number | null; attack: number | null; defense: number | null; spAttack: number | null; spDefense: number | null; speed: number | null };
  energy: number | null;
  move: { name: string; type: PokemonType } | null;
  specialMove: { name: string; kind: string } | null;
  sources: string[];
};
```

### Data corrections
When the machine shows something different from the app, the player edits that field in the Collection screen. The correction is stored on the phone and overrides the shipped value everywhere. Corrections are included in backups.

## Recommendation logic (engine)

### Team scoring
For a chosen target, score every combination of 3 owned tags:

1. **Attack**: for each tag, type effectiveness of its move type against the target's types (from the type chart: 0, 0.25, 0.5, 1, 2, 4) × its attack stat (normalized).
2. **Defense**: how well each tag resists the target's move type, so the team is less likely to be knocked out.
3. **Strength**: small bonus for higher grade / overall stats.
4. **Variety**: small penalty if all 3 tags share a type weakness.

Total = weighted sum. Weights are fixed constants in `engine/` for version 1. Missing stats count as neutral (average), and the reason line says so.

Output: top 3 teams, each with a one-line human-readable reason (e.g. "2 tags hit its Fire weakness for double damage").

### Attack plan
For a recommended team, produce an ordered list:
- Which tag to use first, second, third (initially: strongest super-effective attack first, adjusted by speed if turn order depends on it).
- When to use special attacks such as Allies' Attack.

Rules come from the researched battle mechanics. Each step shows the trust level of the rule it relies on. If the battle rules are not confirmed, the plan is labelled unverified.

### Performance
Owned tags are expected in the low hundreds at most. C(200, 3) ≈ 1.3 million combinations is too slow to score naively on every tap, so the engine first ranks each tag individually against the target, keeps the top 15, and scores combinations of those (455 combinations).

## Play log

Each entry (saved in IndexedDB):
```ts
type PlayLogEntry = {
  id: string;
  date: string;               // ISO timestamp
  offered: string[];          // tag ids of the wild Pokémon shown
  chosen: string;             // tag id fought
  superstarAppeared: boolean;
  teamUsed: string[];         // tag ids scanned
  attackOrderUsed: string[];  // tag ids in the order used, optional
  won: boolean;
  caught: boolean;
  note?: string;
};
```
Logging is designed to take about 10 seconds: defaults prefilled from the Play screen, big Yes/No buttons.

## Backup and error handling

- **Backup**: exports collection, corrections, and play log as one JSON file (with a format version) that the player can save to Files / iCloud Drive.
- **Restore**: validates the file format and version before replacing data; shows a clear error and changes nothing if invalid.
- If IndexedDB is unavailable or a write fails, show a message telling the player their latest change was not saved.
- Missing data fields display "unknown"; the engine treats them as neutral.

## Testing

- Unit tests (Vitest) for `engine/`: type effectiveness, team scoring, top-15 pruning, attack plan ordering, stats calculations.
- Data validation tests: every tag has 1–2 valid types, unique ids, valid trust levels, sources present for non-null facts.
- Storage tests for backup/restore round-trip and invalid-file rejection (using a fake IndexedDB).
- Manual check on iPhone Safari: add to home screen, works offline, data persists after closing.

## Build order

Each step delivers something usable.

1. Research Stardust V3 (Asia English) data and battle/catch/Superstar mechanics into `data/`.
2. Project setup, Collection screen, on-phone storage, backup and restore.
3. Engine: team scoring and attack plan, with tests.
4. Play and Plan screens.
5. Play log and Stats screen.
6. Guide screen.
7. Publish to GitHub Pages (needs the player's free GitHub account; ask before publishing) and install on iPhone.

## Out of scope for version 1

- Photo or NFC recognition of tags.
- Reading the arcade screen or real-time button timing.
- Accounts, cloud sync, or sharing between players.
- Tuning scoring weights from play-log data (revisit once enough plays are logged).
