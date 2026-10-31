# Mezastar Helper — Design

Date: 2026-10-31
Status: Revised after mechanics research; pending written review

## Goal

Help one player of **Pokémon Mezastar: Stardust Version 3 (Asia English machines)** catch as many Superstar Pokémon as possible by advising them before and during each play, and by learning from their own results.

The app cannot connect to or see the arcade machine. The player tells the app what is on screen with a few taps; the app advises from that input plus researched game data.

## How a battle works (research summary)

Trust levels: **confirmed** = official Mezastar Asia site; **community** = player blogs/videos; **open** = not found yet, to be checked by the player at the machine.

| Mechanic | Trust | Source |
|---|---|---|
| Choose an Area; each Area has different Bosses. | confirmed | [battle](https://world.pokemonmezastar.com/sg/howto/battle.php) |
| 3 wild opponents: the Boss in the middle and its "cronies" on each side. The Boss is not always a Star Pokémon. | confirmed | [battle](https://world.pokemonmezastar.com/sg/howto/battle.php) |
| Each turn, the player slides one Meza Tag forward to choose which Pokémon attacks. | confirmed | [battle](https://world.pokemonmezastar.com/sg/howto/battle.php) |
| Damage depends heavily on the attacker's **move type** vs the defender's **type**. Sliding a tag forward previews "It's effective!" / "Hit" / "It's not so effective...". | confirmed | [choose](https://world.pokemonmezastar.com/sg/howto/choose.php) |
| The Pokémon with the highest Speed (SPD) attacks first. A blue divider means you go first, red means the opponent does. A "First Attack Chance" button-mash can flip it. | confirmed | [choose](https://world.pokemonmezastar.com/sg/howto/choose.php) |
| **Tiredness:** a Pokémon that attacked last turn has lower Speed and cannot use the Attack Roulette. Rotate attackers. | confirmed | [choose](https://world.pokemonmezastar.com/sg/howto/choose.php) |
| Attack power comes from the Attack Roulette or "Hit the Buttons" (rainbow = max). | confirmed | [battle](https://world.pokemonmezastar.com/sg/howto/battle.php) |
| **Support Pokémon:** defeated opponents that are not the Boss become your Support Pokémon from the next turn. After each Attack Roulette, a Support Roulette gives +10 attack or a Support Attack (the supporter attacks too). | confirmed | [support](https://world.pokemonmezastar.com/in/howto/support.php) |
| A Support Pokémon Ticket (max 1 per battle) gives a supporter from the start; scan it before placing any tags. | confirmed | [tickets](https://world.pokemonmezastar.com/sg/howto/about_tickets.php) |
| Special moves trigger on a Pokémon's **first attack**: Mega Evolution (1 chance per play), Dynamax (1 per battle), Z-Move (1 per play), Double Move, Chain Attack (up to 3 Pokémon in a row), TAG Move (two Pokémon on one tag). | confirmed | [dynamax](https://world.pokemonmezastar.com/sg/howto/dynamax.php), [chain](https://world.pokemonmezastar.com/sg/howto/chain_attack.php), [set list](https://kitakuji.id/blog/daftar-mezatag-pokemon-mezastar-stardust-version-3/) |
| "Everyone Attack!" sometimes happens on the last turn: slide all tags forward; your Support Pokémon join in. | confirmed | [battle](https://world.pokemonmezastar.com/sg/howto/battle.php) |
| Catch Time comes after 3 turns or after you beat the Boss; you get one of the 3 opponents. Damage fills the Catch Gauge; a Ball Roulette picks Poké / Great / Ultra / Master Ball. Bonus Catch Time (tall grass) can follow. | confirmed | [after](https://world.pokemonmezastar.com/sg/howto/after.php), [battle](https://world.pokemonmezastar.com/sg/howto/battle.php) |
| Tags show grade 2★–6★ (5★ Star, 6★ Superstar), type, Pokénergy, HP, Attack, Defense, Speed, move and move type. | confirmed | [tags](https://world.pokemonmezastar.com/sg/howto/about_tag.php) |
| Stardust V3 Superstars: Lugia, Ho-Oh, Solgaleo, Lunala, Greninja, Zeraora, Eternatus, Keldeo, Grimmsnarl, Zygarde (codes 1-3-001 to 1-3-010). 70 numbered tags (1-3-001 to 1-3-070) plus 3 Regular Tags (R-1-1 to R-1-3). Stars are 1-3-011 to 1-3-025. | confirmed | [official Stardust V3 page](https://world.pokemonmezastar.com/sg/tag/33112/) |
| Opponents shown are tags physically stocked in that machine, so Superstar chances depend on the machine. | community | Japanese player blogs |
| Superstars appear more often in Special Tag Battles (two machines side by side). | community | Japanese player blogs |
| Defeating the two weaker cronies quickly, then attacking the Superstar boss, improves the catch. | community | Japanese player blogs |
| "Catch now!" mode rarely gives Superstars (one blogger: 0 of 25). | community | Japanese player blog |
| Catching a Pokémon adds a bonus 4th/5th turn. | community (Japan only) | Bulbapedia |
| Can the player choose **which** opponent to attack, or is it automatic? | open | — |
| How many tags (lanes) can be placed per battle? Assumed 3. | open | — |
| Exact damage formula, Catch Gauge size, Ball Roulette odds. | open | — |

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
   - Player enters the battle as shown on screen: the **Boss** and the **2 cronies** (searchable lists), and marks which one they want to catch (defaults to the Boss).
   - App shows the top 3 teams from the player's collection, each with a one-line reason, and a **turn-by-turn battle plan** (see Battle plan).
   - Ends with a quick log entry (about 10 seconds), see Play log.
2. **Plan** (at home)
   - Player picks a target (e.g. a Superstar) and optionally its likely cronies; app shows the best team they own, the reason, and the battle plan.
3. **Collection**
   - Every tag in the set, searchable by name or number, marked owned or missing. Tap to toggle.
   - Owned count out of total.
   - Tap a tag to view its data and correct any field (see Data corrections).
4. **Guide**
   - Plain-language explanations of the mechanics in the research summary above, each with its trust level and source link.
   - A list of **open questions** the player can answer from what they see at the machine; answers are saved as notes.
5. **Stats**
   - Built only from the player's play log: plays, wins, catches, catch rate (overall, by win/loss, by target grade), Superstars seen, catch rate when cronies were defeated first vs not, Superstars seen per machine/location.
   - Backup and restore buttons.

## Code structure

Each folder has one job and can be tested without the others.

```
src/
  data/      researched game data as JSON + TypeScript types
  engine/    pure logic: type effectiveness, team scoring, battle plan, stats
  storage/   IndexedDB access: collection, corrections, notes, play log, backup/restore
  ui/        the five screens and shared components
```

- `ui/` depends on `engine/` and `storage/`.
- `engine/` depends only on `data/` types; no browser APIs, so it is fully unit-testable.
- `storage/` depends only on `data/` types.

## Game data

### Sources
- Tag list (codes and names) for Stardust Version 3 (Asia): the [official Stardust V3 page](https://world.pokemonmezastar.com/sg/tag/33112/). Gimmicks (Dynamax: Keldeo, Grimmsnarl, Nidoqueen; Z-Move: Greninja, Zeraora, Chandelure; TAG Meza Tags) from the same page.
- Per-tag details from community sources; anything not found is `null` and the player fills it in from the tag (the back of every tag prints HP, Attack, Defense, Speed, move and move type).
- Standard Pokémon type chart (18 types).

Unknown fields are stored as `null` and shown as "unknown". The app never fills gaps with guesses.

### Tag record (shape)
```ts
type Gimmick = 'mega' | 'dynamax' | 'zmove' | 'tagMove' | 'doubleMove' | 'chainAttack';

type Tag = {
  id: string;              // as printed, e.g. "1-3-002"
  name: string;
  grade: 2 | 3 | 4 | 5 | 6 | null;   // 5 = Star, 6 = Superstar
  types: PokemonType[];    // 1 or 2
  pokenergy: number | null;
  stats: { hp: number | null; attack: number | null; defense: number | null; speed: number | null };
  move: { name: string; type: PokemonType } | null;
  gimmick: { kind: Gimmick; moveName: string | null; moveType: PokemonType | null } | null;
  legendary: boolean;
  mythical: boolean;
  sources: string[];
};
```

### Mechanics record (shape)
```ts
type Mechanic = {
  id: string;
  title: string;
  explanation: string;
  trust: 'confirmed' | 'community' | 'open';
  sources: string[];
};
```

### Data corrections
When the machine or tag shows something different from the app, the player edits that field in the Collection screen. The correction is stored on the phone and overrides the shipped value everywhere. Corrections are included in backups.

## Recommendation logic (engine)

### Team scoring
For a battle (Boss + 2 cronies + chosen target), score every combination of 3 owned tags:

1. **Attack coverage**: for each opponent, the best damage any team tag can deal = type effectiveness of the tag's move type vs the opponent's types × the tag's Attack. Weighted: target opponent highest, cronies lower (they become supporters once defeated, so beating them fast still matters).
2. **Speed**: bonus when a tag is faster than the opponent it is best against (it attacks first). Unknown opponent Speed counts as neutral.
3. **Rotation**: because of Tiredness, a team needs at least 2 good attackers so no tag has to attack two turns in a row. Penalty if only one tag is effective.
4. **Defense**: how well tags resist the opponents' move types (HP and Defense).
5. **Gimmick**: small bonus for a tag with a first-attack special move (Mega, Dynamax, Z-Move, Double Move, Chain Attack, TAG Move).

Total = weighted sum. Weights are fixed constants in `engine/` for version 1. Missing stats count as neutral (average), and the reason line says so.

Output: top 3 teams, each with a one-line reason (e.g. "Ho-Oh hits both Grass cronies hard; Keldeo handles the Dark-type Boss").

### Battle plan (searched, not fixed)
No single plan is always best. "Defeat a crony first for a supporter" can lose to "hit the Boss now" when the crony can't be defeated in one hit, when a supporter arrives too late to matter, when a strong tag can beat the Boss early, or when a first-attack special move would be wasted on a crony.

So the engine searches every legal 3-turn sequence for the chosen team and picks the best:

- **Search space**: each turn = (attacking tag, opponent aimed at). No tag attacks in two consecutive turns (Tiredness). At most 3 × 3 options per turn, so at most 729 sequences per team; it runs for the top 3 teams only.
- **Estimated battle model** (`engine/battleModel.ts`), deterministic expected values:
  - Damage = Attack × type effectiveness × gimmick multiplier (first attack only) ÷ a defense factor from the defender's Defense. Constants are placeholders until calibrated.
  - Turn order from Speed (Tired tags count as slower).
  - Opponent HP from its tag's printed HP; a defeated non-Boss opponent becomes a supporter from the next turn, adding an expected bonus per turn (+10 attack on the roulette, or a Support Attack).
  - Expected damage taken from each opponent, so plans that lose a key tag early score lower.
  - Beating the Boss ends the battle early (Catch Time).
- **Objective**: maximize expected damage dealt to the target (proxy for the Catch Gauge), with a bonus for defeating the target if that is what triggers Catch Time, and a penalty for losing tags.
- **Output**: the best plan as turn cards (who attacks, aim for whom, why), plus a one-line comparison against the default "crony first" plan, e.g. "Hitting the Boss on turn 1 is better here: no crony can be defeated in one hit."
- **Fallback**: if key stats are missing, the engine uses the default rule-of-thumb plan (turn 1 defeat a crony, turn 2 different tag, turn 3 strongest hit on target) and labels it "rule of thumb".
- Reminders on every plan: scan a Support Ticket first if you have one; slide a tag forward to preview effectiveness; slide all tags forward if "Everyone Attack!" appears.

Each step shows the trust level of the rule it relies on. Because "can I choose which opponent to attack?" is still open, the model has a switch: if the target is chosen automatically, the search only varies the attacking tag. The Guide asks the player to confirm.

**Calibration**: the play log records per-turn results when the player wants (attacker, aimed-at, defeated or not). Stats shows how often the model's "defeats in one hit" predictions were right, so the placeholder constants can be adjusted later (adjusting is out of scope for version 1; measuring is in scope).

### Performance
Owned tags are expected in the low hundreds at most. The engine first ranks each tag individually against the 3 opponents, keeps the top 15, and scores combinations of those (455 combinations).

## Play log

Each entry (saved in IndexedDB):
```ts
type PlayLogEntry = {
  id: string;
  date: string;                 // ISO timestamp
  location?: string;            // arcade / machine label the player chooses
  mode: 'battle' | 'catchNow' | 'specialTagBattle';
  boss: string;                 // tag id
  cronies: string[];            // tag ids
  superstarAppeared: boolean;
  teamUsed: string[];           // tag ids placed
  turns: { attacker: string; defeated?: string }[];  // optional detail
  cronyDefeatedCount: 0 | 1 | 2;
  bossDefeated: boolean;
  ballType?: 'poke' | 'great' | 'ultra' | 'master';
  caught: string | null;        // tag id caught, or null
  note?: string;
};
```
Logging is designed to take about 10 seconds: values prefilled from the Play screen, big buttons, turn detail optional.

## Backup and error handling

- **Backup**: exports collection, corrections, notes, and play log as one JSON file (with a format version) that the player can save to Files / iCloud Drive.
- **Restore**: validates the file format and version before replacing data; shows a clear error and changes nothing if invalid.
- If IndexedDB is unavailable or a write fails, show a message telling the player their latest change was not saved.
- Missing data fields display "unknown"; the engine treats them as neutral.

## Testing

- Unit tests (Vitest) for `engine/`: type effectiveness, team scoring against 3 opponents, top-15 pruning, battle model (damage, turn order, supporter bonus), plan search (never uses a tag twice in a row; picks "Boss first" in a scenario built so that it wins; picks "crony first" in a scenario built so that it wins; falls back to the rule of thumb when stats are missing), stats calculations including prediction accuracy.
- Data validation tests: unique ids, grades 2–6, 1–2 valid types, valid trust levels, every mechanic has a source unless `open`.
- Storage tests for backup/restore round-trip and invalid-file rejection (using a fake IndexedDB).
- Manual check on iPhone Safari: add to home screen, works offline, data persists after closing.

## Build order

Each step delivers something usable.

1. Turn the research into `data/`: Stardust V3 tag list, type chart, mechanics with trust levels.
2. Project setup, Collection screen, on-phone storage, backup and restore.
3. Engine: team scoring and battle plan, with tests.
4. Play and Plan screens.
5. Play log and Stats screen.
6. Guide screen with open questions.
7. Publish to GitHub Pages (needs the player's free GitHub account; ask before publishing) and install on iPhone.

## Out of scope for version 1

- Photo or NFC recognition of tags.
- Reading the arcade screen or real-time button timing.
- Accounts, cloud sync, or sharing between players.
- Tuning scoring weights from play-log data (revisit once enough plays are logged).
- Other sets than Stardust Version 3 (the data format allows adding them later).
