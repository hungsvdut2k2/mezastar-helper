# Mezastar Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline-capable phone web app (PWA) that helps one player of Pokémon Mezastar Stardust Version 3 (Asia English) pick teams and battle plans, track their collection, log plays, and learn the mechanics, so they catch more Superstar Pokémon.

**Architecture:** One React + TypeScript single-page app built with Vite. Four layers, each in its own folder: `src/data` (researched game data and types), `src/engine` (pure logic, no browser APIs), `src/storage` (IndexedDB on the phone, backup/restore), and `src/ui` (5 screens plus shared components). The UI depends on engine and storage; engine and storage depend only on data types.

**Tech Stack:** Vite, React 19, TypeScript (strict), `idb` (IndexedDB wrapper), `vite-plugin-pwa` (service worker + manifest), Vitest + jsdom + Testing Library + `fake-indexeddb` for tests, GitHub Pages + GitHub Actions for free hosting.

**Spec:** `docs/superpowers/specs/2026-10-31-mezastar-helper-design.md`

**Deviations from the spec (all small, all needed):**
1. `PlayLogEntry` gains `target: string` (needed for "catch rate by target grade") and each turn gains `aimedAt?: string` and `predictedDefeat?: boolean` (the spec asks the log to record aimed-at and to measure the model's one-hit predictions).
2. Game data lives in typed `.ts` modules instead of `.json` files, so the compiler checks every record.
3. Pokémon types are filled in from main-series Pokédex species types (a well-known fact, not a guess). Stats, Pokénergy and most move names stay `null` until the player enters them from the tag.

**Conventions for every task:**
- Run commands from the repository root `/Users/viethungnguyen/pokemon-app`.
- Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run a single test file with `npx vitest run <path>`. Run everything with `npm test`.

---

## File map

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
scripts/make-icons.mjs                 generates PWA icons (no image libraries needed)
public/icon-192.png, icon-512.png, apple-touch-icon.png   (generated)
.github/workflows/deploy.yml           GitHub Pages deploy (Task 23 only)

src/main.tsx                           React entry
src/test/setup.ts                      Vitest setup (fake IndexedDB, jest-dom)
src/test/factories.ts                  makeTag / makeLogEntry for tests
src/test/freshDb.ts                    fresh fake IndexedDB per test

src/data/types.ts                      all shared types and constant lists
src/data/typeChart.ts                  18-type effectiveness chart
src/data/tags.ts                       Stardust V3 tag list (73 tags)
src/data/mechanics.ts                  mechanics with trust levels + open questions

src/engine/typeEffectiveness.ts        effectiveness(), effectText()
src/engine/corrections.ts              applyCorrections()
src/engine/battleModel.ts              MODEL constants, damage(), simulate()
src/engine/planSearch.ts               bestPlan(): searched plan + rule-of-thumb fallback
src/engine/teamScoring.ts              hitPower(), rankTags(), scoreTeam(), topTeams()
src/engine/recommend.ts                recommend(), unknownOpponent()
src/engine/stats.ts                    computeStats()

src/storage/db.ts                      IndexedDB access
src/storage/backup.ts                  makeBackup(), parseBackup(), restoreFromText()

src/ui/App.tsx                         tab bar + screen switch
src/ui/styles.css                      phone-first styles
src/ui/useAppData.ts                   loads/saves everything, exposes a store
src/ui/format.ts                       labels and tag search
src/ui/testHarness.tsx                 <WithStore> for screen tests
src/ui/components/TagPicker.tsx        search-and-tap tag picker
src/ui/components/Recommendations.tsx  reminders + team cards with battle plans
src/ui/screens/CollectionScreen.tsx
src/ui/screens/TagEditor.tsx
src/ui/screens/LogForm.tsx
src/ui/screens/PlayScreen.tsx
src/ui/screens/PlanScreen.tsx
src/ui/screens/StatsScreen.tsx
src/ui/screens/GuideScreen.tsx
```

Tests sit next to the file they test as `*.test.ts` / `*.test.tsx`.

---

## Phase 1 — Project setup and game data

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `scripts/make-icons.mjs`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/styles.css`, `src/test/setup.ts`
- Test: `src/ui/App.test.tsx`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "mezastar-helper",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "icons": "node scripts/make-icons.mjs"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react react-dom idb
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node vitest jsdom fake-indexeddb @testing-library/react @testing-library/user-event @testing-library/jest-dom vite-plugin-pwa
```
Expected: both finish without `ERR!` lines; `package.json` now has `dependencies` and `devDependencies`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vitest/globals", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

`BASE_PATH` lets GitHub Pages serve the app from `/<repo-name>/` later (Task 23). Locally it is `/`.

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Mezastar Helper',
        short_name: 'Mezastar',
        description: 'Catch more Superstar Pokémon in Mezastar Stardust Version 3',
        theme_color: '#1d3557',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1d3557" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Mezastar" />
    <link rel="apple-touch-icon" href="apple-touch-icon.png" />
    <title>Mezastar Helper</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
dist
dev-dist
*.local
```

- [ ] **Step 7: Create `scripts/make-icons.mjs`**

Writes plain PNGs (navy square, yellow circle) with only Node built-ins.

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const rowBytes = size * 3 + 1;
  const raw = Buffer.alloc(size * rowBytes);
  const r = size * 0.3;
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const inside = (x - c) ** 2 + (y - c) ** 2 < r * r;
      const [red, green, blue] = inside ? [255, 209, 102] : [29, 53, 87];
      const o = y * rowBytes + 1 + x * 3;
      raw[o] = red;
      raw[o + 1] = green;
      raw[o + 2] = blue;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public', { recursive: true });
writeFileSync('public/icon-192.png', png(192));
writeFileSync('public/icon-512.png', png(512));
writeFileSync('public/apple-touch-icon.png', png(180));
console.log('Icons written to public/');
```

Run: `npm run icons`
Expected: `Icons written to public/` and three PNG files in `public/`.

- [ ] **Step 8: Create `src/test/setup.ts`**

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

- [ ] **Step 9: Write the failing smoke test `src/ui/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Mezastar Helper' })).toBeInTheDocument();
});
```

Run: `npx vitest run src/ui/App.test.tsx`
Expected: FAIL — `Failed to resolve import "./App"`.

- [ ] **Step 10: Create `src/ui/App.tsx`, `src/ui/styles.css`, `src/main.tsx`**

`src/ui/App.tsx` (temporary; Task 21 replaces it):
```tsx
export function App() {
  return <h1>Mezastar Helper</h1>;
}
```

`src/ui/styles.css` (temporary; Task 21 replaces it):
```css
body {
  font-family: -apple-system, system-ui, sans-serif;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 11: Run tests and build**

Run: `npm test`
Expected: PASS, 1 test.

Run: `npm run build`
Expected: finishes with `dist/` created and lines mentioning `sw.js` and `manifest.webmanifest`.

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore scripts public src
git commit -m "Set up Vite + React + TypeScript PWA with Vitest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared types, type chart, effectiveness, test factories

**Files:**
- Create: `src/data/types.ts`, `src/data/typeChart.ts`, `src/engine/typeEffectiveness.ts`, `src/test/factories.ts`
- Test: `src/engine/typeEffectiveness.test.ts`

- [ ] **Step 1: Create `src/data/types.ts`**

```ts
export const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];

export type Grade = 2 | 3 | 4 | 5 | 6; // 5 = Star, 6 = Superstar

export const GIMMICKS = ['mega', 'dynamax', 'zmove', 'tagMove', 'doubleMove', 'chainAttack'] as const;
export type Gimmick = (typeof GIMMICKS)[number];

export const GIMMICK_NAME: Record<Gimmick, string> = {
  mega: 'Mega Evolution',
  dynamax: 'Dynamax',
  zmove: 'Z-Move',
  tagMove: 'TAG Move',
  doubleMove: 'Double Move',
  chainAttack: 'Chain Attack',
};

export const TRUST_LEVELS = ['confirmed', 'community', 'player', 'open'] as const;
export type Trust = (typeof TRUST_LEVELS)[number];

export type TagStats = {
  hp: number | null;
  attack: number | null;
  defense: number | null;
  speed: number | null;
};

export type Tag = {
  id: string; // as printed, e.g. "1-3-002"
  name: string;
  grade: Grade | null;
  types: PokemonType[]; // 1 or 2
  pokenergy: number | null;
  stats: TagStats;
  move: { name: string; type: PokemonType } | null;
  gimmick: { kind: Gimmick; moveName: string | null; moveType: PokemonType | null } | null;
  legendary: boolean;
  mythical: boolean;
  sources: string[];
};

export type Mechanic = {
  id: string;
  title: string;
  explanation: string;
  trust: Trust;
  sources: string[];
};

export type OpenQuestion = { id: string; question: string; why: string };

/** A player's fix to a shipped tag record. Missing keys keep the shipped value. */
export type TagCorrection = {
  grade?: Grade | null;
  types?: PokemonType[];
  pokenergy?: number | null;
  stats?: Partial<TagStats>;
  move?: Tag['move'];
};

export type PlayMode = 'battle' | 'catchNow' | 'specialTagBattle';
export type BallType = 'poke' | 'great' | 'ultra' | 'master';

export type PlayTurn = {
  attacker: string; // tag id
  aimedAt?: string; // opponent tag id
  defeated?: string; // opponent tag id defeated this turn
  predictedDefeat?: boolean; // what the battle model expected
};

export type PlayLogEntry = {
  id: string;
  date: string; // ISO timestamp
  location?: string;
  mode: PlayMode;
  boss: string;
  cronies: string[];
  target: string; // the opponent the player wanted to catch
  superstarAppeared: boolean;
  teamUsed: string[];
  turns: PlayTurn[];
  cronyDefeatedCount: 0 | 1 | 2;
  bossDefeated: boolean;
  ballType?: BallType;
  caught: string | null;
  note?: string;
};
```

- [ ] **Step 2: Create `src/data/typeChart.ts`**

Standard 18-type chart. Only non-1× entries are listed; anything missing is 1×.

```ts
import type { PokemonType } from './types';

type Row = Partial<Record<PokemonType, number>>;

/** TYPE_CHART[moveType][defenderType] = multiplier */
export const TYPE_CHART: Record<PokemonType, Row> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};
```

- [ ] **Step 3: Create `src/test/factories.ts`**

```ts
import type { PlayLogEntry, Tag } from '../data/types';

export type TagOverrides = Partial<Omit<Tag, 'stats'>> & { stats?: Partial<Tag['stats']> };

/** A Normal-type test tag with known stats: HP 1000, Attack 100, Defense 0, Speed 100. */
export function makeTag(id: string, overrides: TagOverrides = {}): Tag {
  const { stats, ...rest } = overrides;
  return {
    id,
    name: id,
    grade: 4,
    types: ['normal'],
    pokenergy: null,
    stats: { hp: 1000, attack: 100, defense: 0, speed: 100, ...stats },
    move: { name: 'Tackle', type: 'normal' },
    gimmick: null,
    legendary: false,
    mythical: false,
    sources: ['test'],
    ...rest,
  };
}

export function makeLogEntry(overrides: Partial<PlayLogEntry> = {}): PlayLogEntry {
  return {
    id: 'entry-1',
    date: '2026-10-31T10:00:00.000Z',
    mode: 'battle',
    boss: '1-3-001',
    cronies: ['1-3-017', '1-3-041'],
    target: '1-3-001',
    superstarAppeared: true,
    teamUsed: ['1-3-002', '1-3-008', '1-3-012'],
    turns: [],
    cronyDefeatedCount: 0,
    bossDefeated: false,
    caught: null,
    ...overrides,
  };
}
```

- [ ] **Step 4: Write the failing test `src/engine/typeEffectiveness.test.ts`**

```ts
import { TYPE_CHART } from '../data/typeChart';
import { POKEMON_TYPES } from '../data/types';
import { effectiveness, effectText } from './typeEffectiveness';

describe('type chart', () => {
  it('has a row for all 18 types with only 0, 0.5 or 2 entries', () => {
    expect(Object.keys(TYPE_CHART).sort()).toEqual([...POKEMON_TYPES].sort());
    for (const row of Object.values(TYPE_CHART)) {
      for (const m of Object.values(row)) expect([0, 0.5, 2]).toContain(m);
    }
  });
});

describe('effectiveness', () => {
  it('is 2 for Fire on Grass', () => expect(effectiveness('fire', ['grass'])).toBe(2));
  it('multiplies dual types (Water on Fire/Ground = 4)', () => expect(effectiveness('water', ['fire', 'ground'])).toBe(4));
  it('is 0.25 for Grass on Fire/Flying', () => expect(effectiveness('grass', ['fire', 'flying'])).toBe(0.25));
  it('is 0 for Electric on Ground', () => expect(effectiveness('electric', ['ground'])).toBe(0));
  it('is 1 when nothing applies', () => expect(effectiveness('normal', ['normal'])).toBe(1));
});

describe('effectText', () => {
  it('uses the words the machine shows', () => {
    expect(effectText(2)).toBe("It's effective!");
    expect(effectText(1)).toBe('Hit');
    expect(effectText(0.5)).toBe("It's not so effective...");
    expect(effectText(0)).toBe('No effect');
  });
});
```

Run: `npx vitest run src/engine/typeEffectiveness.test.ts`
Expected: FAIL — `Failed to resolve import "./typeEffectiveness"`.

- [ ] **Step 5: Create `src/engine/typeEffectiveness.ts`**

```ts
import { TYPE_CHART } from '../data/typeChart';
import type { PokemonType } from '../data/types';

export function effectiveness(moveType: PokemonType, defenderTypes: PokemonType[]): number {
  return defenderTypes.reduce((m, t) => m * (TYPE_CHART[moveType][t] ?? 1), 1);
}

/** The preview words the machine shows when a tag is slid forward. */
export function effectText(multiplier: number): string {
  if (multiplier >= 2) return "It's effective!";
  if (multiplier === 0) return 'No effect';
  if (multiplier < 1) return "It's not so effective...";
  return 'Hit';
}
```

- [ ] **Step 6: Run the test**

Run: `npx vitest run src/engine/typeEffectiveness.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add src/data src/engine src/test/factories.ts
git commit -m "Add shared types, type chart and effectiveness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Stardust V3 tag list

Source: official page https://world.pokemonmezastar.com/sg/tag/33112/ (codes, names, Superstar/Star grouping, special moves). Types are main-series species types. Every stat is `null` because the page does not print them.

**Files:**
- Create: `src/data/tags.ts`
- Test: `src/data/tags.test.ts`

- [ ] **Step 1: Write the failing test `src/data/tags.test.ts`**

```ts
import { TAGS } from './tags';
import { GIMMICKS, POKEMON_TYPES } from './types';

describe('Stardust V3 tags', () => {
  it('has 70 numbered tags and 3 Regular Tags', () => {
    expect(TAGS).toHaveLength(73);
    expect(TAGS.filter((t) => t.id.startsWith('R-'))).toHaveLength(3);
  });

  it('has unique ids', () => {
    expect(new Set(TAGS.map((t) => t.id)).size).toBe(TAGS.length);
  });

  it('lists the 10 official Superstars in code order', () => {
    const superstars = TAGS.filter((t) => t.grade === 6);
    expect(superstars.map((t) => t.name)).toEqual([
      'Lugia', 'Ho-Oh', 'Solgaleo', 'Lunala', 'Greninja', 'Zeraora', 'Eternatus', 'Keldeo', 'Grimmsnarl', 'Zygarde',
    ]);
    expect(superstars.map((t) => t.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `1-3-${String(i + 1).padStart(3, '0')}`),
    );
  });

  it('has 15 Stars (1-3-011 to 1-3-025)', () => {
    const stars = TAGS.filter((t) => t.grade === 5);
    expect(stars).toHaveLength(15);
    expect(stars[0].id).toBe('1-3-011');
    expect(stars[14].id).toBe('1-3-025');
  });

  it('only uses valid grades, 1–2 distinct valid types and valid gimmicks', () => {
    for (const t of TAGS) {
      expect([null, 2, 3, 4, 5, 6]).toContain(t.grade);
      expect(t.types.length).toBeGreaterThanOrEqual(1);
      expect(t.types.length).toBeLessThanOrEqual(2);
      expect(new Set(t.types).size).toBe(t.types.length);
      for (const type of t.types) expect(POKEMON_TYPES).toContain(type);
      if (t.gimmick) expect(GIMMICKS).toContain(t.gimmick.kind);
      expect(t.sources.length).toBeGreaterThan(0);
    }
  });

  it('never invents stats', () => {
    for (const t of TAGS) {
      expect(Object.values(t.stats).every((v) => v === null)).toBe(true);
      expect(t.pokenergy).toBeNull();
    }
  });
});
```

Run: `npx vitest run src/data/tags.test.ts`
Expected: FAIL — `Failed to resolve import "./tags"`.

- [ ] **Step 2: Create `src/data/tags.ts`**

```ts
import type { Grade, PokemonType, Tag } from './types';

const OFFICIAL = 'https://world.pokemonmezastar.com/sg/tag/33112/';
const POKEDEX = 'Types: main-series Pokédex species types';

type Extra = Partial<Pick<Tag, 'move' | 'gimmick' | 'legendary' | 'mythical'>>;

function tag(id: string, name: string, grade: Grade | null, types: PokemonType[], extra: Extra = {}): Tag {
  return {
    id,
    name,
    grade,
    types,
    pokenergy: null,
    stats: { hp: null, attack: null, defense: null, speed: null },
    move: extra.move ?? null,
    gimmick: extra.gimmick ?? null,
    legendary: extra.legendary ?? false,
    mythical: extra.mythical ?? false,
    sources: [OFFICIAL, POKEDEX],
  };
}

const L = { legendary: true };
const M = { mythical: true };

export const TAGS: Tag[] = [
  // Superstars (6★)
  tag('1-3-001', 'Lugia', 6, ['psychic', 'flying'], { ...L, move: { name: 'Aeroblast', type: 'flying' } }),
  tag('1-3-002', 'Ho-Oh', 6, ['fire', 'flying'], { ...L, move: { name: 'Sacred Fire', type: 'fire' } }),
  tag('1-3-003', 'Solgaleo', 6, ['psychic', 'steel'], L),
  tag('1-3-004', 'Lunala', 6, ['psychic', 'ghost'], L),
  tag('1-3-005', 'Greninja', 6, ['water', 'dark'], { gimmick: { kind: 'zmove', moveName: 'Black Hole Eclipse', moveType: 'dark' } }),
  tag('1-3-006', 'Zeraora', 6, ['electric'], { ...M, gimmick: { kind: 'zmove', moveName: 'Gigavolt Havoc', moveType: 'electric' } }),
  tag('1-3-007', 'Eternatus', 6, ['poison', 'dragon'], L),
  tag('1-3-008', 'Keldeo', 6, ['water', 'fighting'], { ...M, gimmick: { kind: 'dynamax', moveName: 'Max Knuckle', moveType: 'fighting' } }),
  tag('1-3-009', 'Grimmsnarl', 6, ['dark', 'fairy'], { gimmick: { kind: 'dynamax', moveName: 'Max Starfall', moveType: 'fairy' } }),
  tag('1-3-010', 'Zygarde', 6, ['dragon', 'ground'], L),

  // Stars (5★)
  tag('1-3-011', 'Sceptile', 5, ['grass'], { gimmick: { kind: 'mega', moveName: 'Leaf Storm', moveType: 'grass' } }),
  tag('1-3-012', 'Blaziken', 5, ['fire', 'fighting'], { gimmick: { kind: 'mega', moveName: 'Focus Blast', moveType: 'fighting' } }),
  tag('1-3-013', 'Swampert', 5, ['water', 'ground'], { gimmick: { kind: 'mega', moveName: 'Earthquake', moveType: 'ground' } }),
  tag('1-3-014', 'Chandelure', 5, ['ghost', 'fire'], { gimmick: { kind: 'zmove', moveName: 'Never-Ending Nightmare', moveType: 'ghost' } }),
  tag('1-3-015', 'Grimmsnarl', 5, ['dark', 'fairy']),
  tag('1-3-016', 'Nidoqueen', 5, ['poison', 'ground'], { gimmick: { kind: 'dynamax', moveName: 'Max Quake', moveType: 'ground' } }),
  tag('1-3-017', 'Pidgeot', 5, ['normal', 'flying']),
  tag('1-3-018', 'Coalossal', 5, ['rock', 'fire']),
  tag('1-3-019', 'Pikachu', 5, ['electric'], {
    move: { name: 'Thunderbolt', type: 'electric' },
    gimmick: { kind: 'tagMove', moveName: 'Fusion Bolt (Zekrom)', moveType: 'electric' },
  }),
  tag('1-3-020', 'Alakazam', 5, ['psychic']),
  tag('1-3-021', 'Regirock', 5, ['rock'], L),
  tag('1-3-022', 'Regice', 5, ['ice'], L),
  tag('1-3-023', 'Registeel', 5, ['steel'], L),
  tag('1-3-024', 'Great Tusk', 5, ['ground', 'fighting'], { move: { name: 'Close Combat', type: 'fighting' } }),
  tag('1-3-025', 'Haxorus', 5, ['dragon']),

  // Other numbered tags (grade 2–4 not recorded yet; the player fills it in)
  tag('1-3-026', 'Armarouge', null, ['fire', 'psychic'], { move: { name: 'Psybeam', type: 'psychic' } }),
  tag('1-3-027', 'Arctibax', null, ['dragon', 'ice'], { move: { name: 'Icy Wind', type: 'ice' } }),
  tag('1-3-028', 'Pawmo', null, ['electric', 'fighting'], { move: { name: 'Arm Thrust', type: 'fighting' } }),
  tag('1-3-029', 'Treecko', null, ['grass']),
  tag('1-3-030', 'Grovyle', null, ['grass']),
  tag('1-3-031', 'Sceptile', null, ['grass']),
  tag('1-3-032', 'Torchic', null, ['fire']),
  tag('1-3-033', 'Combusken', null, ['fire', 'fighting']),
  tag('1-3-034', 'Blaziken', null, ['fire', 'fighting']),
  tag('1-3-035', 'Mudkip', null, ['water']),
  tag('1-3-036', 'Marshtomp', null, ['water', 'ground']),
  tag('1-3-037', 'Swampert', null, ['water', 'ground']),
  tag('1-3-038', 'Magby', null, ['fire']),
  tag('1-3-039', 'Magmar', null, ['fire']),
  tag('1-3-040', 'Magmortar', null, ['fire']),
  tag('1-3-041', 'Koffing', null, ['poison']),
  tag('1-3-042', 'Galarian Weezing', null, ['poison', 'fairy']),
  tag('1-3-043', 'Beldum', null, ['steel', 'psychic']),
  tag('1-3-044', 'Metang', null, ['steel', 'psychic']),
  tag('1-3-045', 'Metagross', null, ['steel', 'psychic']),
  tag('1-3-046', 'Shinx', null, ['electric']),
  tag('1-3-047', 'Luxio', null, ['electric']),
  tag('1-3-048', 'Luxray', null, ['electric']),
  tag('1-3-049', 'Blipbug', null, ['bug']),
  tag('1-3-050', 'Dottler', null, ['bug', 'psychic']),
  tag('1-3-051', 'Orbeetle', null, ['bug', 'psychic']),
  tag('1-3-052', 'Silicobra', null, ['ground']),
  tag('1-3-053', 'Sandaconda', null, ['ground']),
  tag('1-3-054', 'Rolycoly', null, ['rock']),
  tag('1-3-055', 'Carkol', null, ['rock', 'fire']),
  tag('1-3-056', 'Coalossal', null, ['rock', 'fire']),
  tag('1-3-057', 'Mudbray', null, ['ground']),
  tag('1-3-058', 'Mudsdale', null, ['ground']),
  tag('1-3-059', 'Impidimp', null, ['dark', 'fairy']),
  tag('1-3-060', 'Morgrem', null, ['dark', 'fairy']),
  tag('1-3-061', 'Grimmsnarl', null, ['dark', 'fairy']),
  tag('1-3-062', 'Turtonator', null, ['fire', 'dragon']),
  tag('1-3-063', 'Nickit', null, ['dark']),
  tag('1-3-064', 'Thievul', null, ['dark']),
  tag('1-3-065', 'Duskull', null, ['ghost']),
  tag('1-3-066', 'Dusclops', null, ['ghost']),
  tag('1-3-067', 'Dusknoir', null, ['ghost']),
  tag('1-3-068', 'Axew', null, ['dragon']),
  tag('1-3-069', 'Fraxure', null, ['dragon']),
  tag('1-3-070', 'Haxorus', null, ['dragon']),

  // Regular Tags (all can Dynamax; Max Move names are not on the page)
  tag('R-1-1', 'Pikachu', null, ['electric'], { gimmick: { kind: 'dynamax', moveName: null, moveType: null } }),
  tag('R-1-2', 'Lucario', null, ['fighting', 'steel'], { gimmick: { kind: 'dynamax', moveName: null, moveType: null } }),
  tag('R-1-3', 'Snorlax', null, ['normal'], { gimmick: { kind: 'dynamax', moveName: null, moveType: null } }),
];
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/data/tags.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 4: Commit**

```bash
git add src/data/tags.ts src/data/tags.test.ts
git commit -m "Add official Stardust V3 tag list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Mechanics and open questions

**Files:**
- Create: `src/data/mechanics.ts`
- Test: `src/data/mechanics.test.ts`

- [ ] **Step 1: Write the failing test `src/data/mechanics.test.ts`**

```ts
import { MECHANICS, OPEN_QUESTIONS } from './mechanics';
import { TRUST_LEVELS } from './types';

describe('mechanics', () => {
  it('has unique ids and valid trust levels', () => {
    expect(new Set(MECHANICS.map((m) => m.id)).size).toBe(MECHANICS.length);
    for (const m of MECHANICS) expect(TRUST_LEVELS).toContain(m.trust);
  });

  it('gives every mechanic a source unless it is open', () => {
    for (const m of MECHANICS.filter((x) => x.trust !== 'open')) expect(m.sources.length).toBeGreaterThan(0);
  });

  it('records that the player chooses which opponent to attack', () => {
    expect(MECHANICS.find((m) => m.id === 'choose-opponent')?.trust).toBe('player');
  });
});

describe('open questions', () => {
  it('has unique ids and starts with the lanes question', () => {
    expect(new Set(OPEN_QUESTIONS.map((q) => q.id)).size).toBe(OPEN_QUESTIONS.length);
    expect(OPEN_QUESTIONS[0].id).toBe('lanes');
  });
});
```

Run: `npx vitest run src/data/mechanics.test.ts`
Expected: FAIL — `Failed to resolve import "./mechanics"`.

- [ ] **Step 2: Create `src/data/mechanics.ts`**

```ts
import type { Mechanic, OpenQuestion } from './types';

const HOWTO = 'https://world.pokemonmezastar.com/sg/howto/';
const BATTLE = `${HOWTO}battle.php`;
const CHOOSE = `${HOWTO}choose.php`;
const SUPPORT = 'https://world.pokemonmezastar.com/in/howto/support.php';
const TICKETS = `${HOWTO}about_tickets.php`;
const DYNAMAX = `${HOWTO}dynamax.php`;
const CHAIN = `${HOWTO}chain_attack.php`;
const AFTER = `${HOWTO}after.php`;
const ABOUT_TAG = `${HOWTO}about_tag.php`;
const SET_PAGE = 'https://world.pokemonmezastar.com/sg/tag/33112/';
const SET_LIST = 'https://kitakuji.id/blog/daftar-mezatag-pokemon-mezastar-stardust-version-3/';
const BLOGS = 'Japanese player blogs';

export const MECHANICS: Mechanic[] = [
  { id: 'areas', title: 'Choosing an Area', trust: 'confirmed', sources: [BATTLE],
    explanation: 'You start by choosing an Area. Each Area has different Boss Pokémon.' },
  { id: 'three-opponents', title: 'Boss and cronies', trust: 'confirmed', sources: [BATTLE],
    explanation: 'You face 3 wild Pokémon: the Boss in the middle and a "crony" on each side. The Boss is not always a Star Pokémon.' },
  { id: 'choose-attacker', title: 'Choosing your attacker', trust: 'confirmed', sources: [BATTLE],
    explanation: 'Each turn you slide one Meza Tag forward. That Pokémon attacks this turn.' },
  { id: 'choose-opponent', title: 'Choosing who to hit', trust: 'player', sources: ['Confirmed by the player at the machine, 2026-10-31'],
    explanation: 'You choose which of the 3 opponents your Pokémon attacks each turn.' },
  { id: 'type-matchup', title: 'Type matchups', trust: 'confirmed', sources: [CHOOSE],
    explanation: 'Damage depends heavily on your move type against the opponent\'s type. When you slide a tag forward the machine previews "It\'s effective!", "Hit" or "It\'s not so effective...".' },
  { id: 'speed-order', title: 'Who attacks first', trust: 'confirmed', sources: [CHOOSE],
    explanation: 'The Pokémon with the higher Speed attacks first. A blue divider means you go first, red means the opponent does. A "First Attack Chance" button-mash can flip it.' },
  { id: 'tiredness', title: 'Tiredness', trust: 'confirmed', sources: [CHOOSE],
    explanation: 'A Pokémon that attacked last turn is tired: its Speed drops and it cannot use the Attack Roulette. Use a different tag each turn.' },
  { id: 'attack-roulette', title: 'Attack Roulette and Hit the Buttons', trust: 'confirmed', sources: [BATTLE],
    explanation: 'Your attack power comes from the Attack Roulette or from hitting the buttons. A rainbow result is the maximum.' },
  { id: 'support-pokemon', title: 'Support Pokémon', trust: 'confirmed', sources: [SUPPORT],
    explanation: 'When you defeat an opponent that is not the Boss, it becomes your Support Pokémon from the next turn. After each Attack Roulette, a Support Roulette gives +10 attack or a Support Attack.' },
  { id: 'support-ticket', title: 'Support Pokémon Ticket', trust: 'confirmed', sources: [TICKETS],
    explanation: 'A Support Pokémon Ticket (max 1 per battle) gives you a supporter from the start. Scan it before placing any tags.' },
  { id: 'first-attack-moves', title: 'Special moves on the first attack', trust: 'confirmed', sources: [DYNAMAX, CHAIN, SET_LIST],
    explanation: 'Special moves trigger on a Pokémon\'s first attack: Mega Evolution (1 chance per play), Dynamax (1 per battle), Z-Move (1 per play), Double Move, Chain Attack (up to 3 Pokémon in a row) and TAG Move (two Pokémon on one tag).' },
  { id: 'everyone-attack', title: 'Everyone Attack!', trust: 'confirmed', sources: [BATTLE],
    explanation: '"Everyone Attack!" sometimes happens on the last turn. Slide all your tags forward; your Support Pokémon join in too.' },
  { id: 'catch-time', title: 'Catch Time', trust: 'confirmed', sources: [AFTER, BATTLE],
    explanation: 'Catch Time comes after 3 turns or as soon as you beat the Boss. You get one of the 3 opponents. Damage you dealt fills the Catch Gauge, then a Ball Roulette picks a Poké, Great, Ultra or Master Ball. A Bonus Catch Time (tall grass) can follow.' },
  { id: 'tag-info', title: 'What a tag tells you', trust: 'confirmed', sources: [ABOUT_TAG],
    explanation: 'Each tag shows its grade (2★ to 6★; 5★ is Star and 6★ is Superstar), type, Pokénergy, HP, Attack, Defense, Speed, move and move type.' },
  { id: 'superstars-v3', title: 'Stardust V3 Superstars', trust: 'confirmed', sources: [SET_PAGE],
    explanation: 'Lugia, Ho-Oh, Solgaleo, Lunala, Greninja, Zeraora, Eternatus, Keldeo, Grimmsnarl and Zygarde (1-3-001 to 1-3-010). Stars are 1-3-011 to 1-3-025.' },
  { id: 'machine-stock', title: 'Opponents come from the machine', trust: 'community', sources: [BLOGS],
    explanation: 'The opponents you see are tags physically stocked in that machine, so your Superstar chances depend on the machine.' },
  { id: 'special-tag-battle', title: 'Special Tag Battles', trust: 'community', sources: [BLOGS],
    explanation: 'Superstars seem to appear more often in Special Tag Battles (two machines side by side).' },
  { id: 'crony-first', title: 'Beat the cronies first', trust: 'community', sources: [BLOGS],
    explanation: 'Players report better catches when they defeat the weaker cronies quickly and then attack the Superstar Boss. The app checks this for each battle instead of always following it.' },
  { id: 'catch-now', title: '"Catch now!" mode', trust: 'community', sources: ['Japanese player blog (0 Superstars in 25 plays)'],
    explanation: '"Catch now!" mode rarely gives Superstars.' },
  { id: 'bonus-turn', title: 'Bonus turn after catching', trust: 'community', sources: ['Bulbapedia (Japan machines)'],
    explanation: 'On Japanese machines, catching a Pokémon adds a bonus 4th or 5th turn. Not yet seen on Asia machines.' },
  { id: 'lanes', title: 'Tags per battle', trust: 'open', sources: [],
    explanation: 'How many tags you can place per battle is not confirmed. The app assumes 3.' },
  { id: 'damage-formula', title: 'Exact numbers', trust: 'open', sources: [],
    explanation: 'The exact damage formula, Catch Gauge size and Ball Roulette odds are not published. The app uses estimates.' },
];

export const OPEN_QUESTIONS: OpenQuestion[] = [
  { id: 'lanes', question: 'How many tags can you place in one battle?', why: 'The app assumes 3 when it builds teams.' },
  { id: 'bonus-turn', question: 'On this machine, does catching a Pokémon give you an extra turn?', why: 'If yes, plans could use a 4th turn.' },
  { id: 'immunity', question: 'Does a "No effect" matchup (e.g. a Normal move on a Ghost) do zero damage, or just a little?', why: 'The app currently treats it as zero.' },
  { id: 'tired-speed', question: 'When a tired Pokémon attacks, does it always go after the opponent?', why: 'This changes how risky a repeat attack is.' },
  { id: 'support-roulette', question: 'How often does the Support Roulette give a Support Attack instead of +10?', why: 'This sets how much a supporter is worth.' },
  { id: 'catch-gauge', question: 'Does more damage clearly give a better ball?', why: 'The app assumes more damage on your target means a better catch.' },
  { id: 'special-battle', question: 'In Special Tag Battles, how often does a Superstar appear?', why: 'Helps decide which mode to play.' },
];
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/data/mechanics.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4: Commit**

```bash
git add src/data/mechanics.ts src/data/mechanics.test.ts
git commit -m "Add mechanics with trust levels and open questions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase 2 — Storage, backup and the Collection screen

### Task 5: Data corrections

**Files:**
- Create: `src/engine/corrections.ts`
- Test: `src/engine/corrections.test.ts`

- [ ] **Step 1: Write the failing test `src/engine/corrections.test.ts`**

```ts
import { TAGS } from '../data/tags';
import { applyCorrections } from './corrections';

describe('applyCorrections', () => {
  it('overrides only the corrected fields and marks the source', () => {
    const [lugia] = applyCorrections(TAGS, { '1-3-001': { stats: { attack: 150 } } });
    expect(lugia.stats).toEqual({ hp: null, attack: 150, defense: null, speed: null });
    expect(lugia.types).toEqual(['psychic', 'flying']);
    expect(lugia.move).toEqual({ name: 'Aeroblast', type: 'flying' });
    expect(lugia.sources).toContain('player correction');
  });

  it('can set a field back to unknown', () => {
    const [lugia] = applyCorrections(TAGS, { '1-3-001': { grade: null, move: null } });
    expect(lugia.grade).toBeNull();
    expect(lugia.move).toBeNull();
  });

  it('leaves uncorrected tags as the same objects', () => {
    const result = applyCorrections(TAGS, { '1-3-001': { pokenergy: 3 } });
    expect(result[1]).toBe(TAGS[1]);
    expect(result).toHaveLength(TAGS.length);
  });
});
```

Run: `npx vitest run src/engine/corrections.test.ts`
Expected: FAIL — `Failed to resolve import "./corrections"`.

- [ ] **Step 2: Create `src/engine/corrections.ts`**

```ts
import type { Tag, TagCorrection } from '../data/types';

export function applyCorrections(tags: Tag[], corrections: Record<string, TagCorrection>): Tag[] {
  return tags.map((t) => {
    const c = corrections[t.id];
    if (!c) return t;
    return {
      ...t,
      grade: c.grade !== undefined ? c.grade : t.grade,
      types: c.types ?? t.types,
      pokenergy: c.pokenergy !== undefined ? c.pokenergy : t.pokenergy,
      move: c.move !== undefined ? c.move : t.move,
      stats: { ...t.stats, ...c.stats },
      sources: [...t.sources, 'player correction'],
    };
  });
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/engine/corrections.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 4: Commit**

```bash
git add src/engine/corrections.ts src/engine/corrections.test.ts
git commit -m "Apply player corrections over shipped tag data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: IndexedDB storage

**Files:**
- Create: `src/storage/db.ts`, `src/test/freshDb.ts`
- Test: `src/storage/db.test.ts`

- [ ] **Step 1: Create `src/test/freshDb.ts`**

```ts
import { IDBFactory } from 'fake-indexeddb';
import { resetDbConnection } from '../storage/db';

/** Give each test an empty IndexedDB. */
export function freshDb() {
  // Cast: fake-indexeddb's IDBFactory type is not identical to the DOM one.
  (globalThis as unknown as { indexedDB: unknown }).indexedDB = new IDBFactory();
  resetDbConnection();
}
```

- [ ] **Step 2: Write the failing test `src/storage/db.test.ts`**

```ts
import { freshDb } from '../test/freshDb';
import { makeLogEntry } from '../test/factories';
import { addLogEntry, deleteLogEntry, loadAll, replaceAll, saveCorrection, saveNote, setOwned } from './db';

beforeEach(freshDb);

describe('storage', () => {
  it('starts empty', async () => {
    expect(await loadAll()).toEqual({ owned: [], corrections: {}, notes: {}, log: [] });
  });

  it('saves and loads every kind of data', async () => {
    await setOwned('1-3-001', true);
    await saveCorrection('1-3-001', { stats: { attack: 150 } });
    await saveNote('lanes', 'Three');
    await addLogEntry(makeLogEntry({ id: 'old', date: '2026-10-01T00:00:00.000Z' }));
    await addLogEntry(makeLogEntry({ id: 'new', date: '2026-10-31T00:00:00.000Z' }));
    const data = await loadAll();
    expect(data.owned).toEqual(['1-3-001']);
    expect(data.corrections).toEqual({ '1-3-001': { stats: { attack: 150 } } });
    expect(data.notes).toEqual({ lanes: 'Three' });
    expect(data.log.map((e) => e.id)).toEqual(['new', 'old']); // newest first
  });

  it('removes owned tags, corrections and log entries', async () => {
    await setOwned('1-3-001', true);
    await setOwned('1-3-001', false);
    await saveCorrection('1-3-001', { grade: 6 });
    await saveCorrection('1-3-001', null);
    await addLogEntry(makeLogEntry({ id: 'a' }));
    await deleteLogEntry('a');
    expect(await loadAll()).toEqual({ owned: [], corrections: {}, notes: {}, log: [] });
  });

  it('replaceAll swaps everything at once', async () => {
    await setOwned('1-3-001', true);
    await saveNote('lanes', 'old');
    const next = { owned: ['1-3-002'], corrections: {}, notes: { immunity: 'zero' }, log: [makeLogEntry({ id: 'x' })] };
    await replaceAll(next);
    expect(await loadAll()).toEqual(next);
  });
});
```

Run: `npx vitest run src/storage/db.test.ts`
Expected: FAIL — `Failed to resolve import "./db"`.

- [ ] **Step 3: Create `src/storage/db.ts`**

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PlayLogEntry, TagCorrection } from '../data/types';

export type AppData = {
  owned: string[];
  corrections: Record<string, TagCorrection>;
  notes: Record<string, string>;
  log: PlayLogEntry[];
};

interface HelperDB extends DBSchema {
  owned: { key: string; value: boolean };
  corrections: { key: string; value: TagCorrection };
  notes: { key: string; value: string };
  log: { key: string; value: PlayLogEntry };
}

const DB_NAME = 'mezastar-helper';
let dbPromise: Promise<IDBPDatabase<HelperDB>> | null = null;

function getDb() {
  dbPromise ??= openDB<HelperDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('owned');
      db.createObjectStore('corrections');
      db.createObjectStore('notes');
      db.createObjectStore('log', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

/** Tests swap in a fresh fake IndexedDB; this forgets the cached connection. */
export function resetDbConnection() {
  dbPromise = null;
}

function zip<V>(keys: string[], values: V[]): Record<string, V> {
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

export async function loadAll(): Promise<AppData> {
  const db = await getDb();
  const [owned, correctionIds, corrections, noteIds, notes, log] = await Promise.all([
    db.getAllKeys('owned'),
    db.getAllKeys('corrections'),
    db.getAll('corrections'),
    db.getAllKeys('notes'),
    db.getAll('notes'),
    db.getAll('log'),
  ]);
  return {
    owned,
    corrections: zip(correctionIds, corrections),
    notes: zip(noteIds, notes),
    log: log.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export async function setOwned(tagId: string, owned: boolean) {
  const db = await getDb();
  if (owned) await db.put('owned', true, tagId);
  else await db.delete('owned', tagId);
}

export async function saveCorrection(tagId: string, correction: TagCorrection | null) {
  const db = await getDb();
  if (correction) await db.put('corrections', correction, tagId);
  else await db.delete('corrections', tagId);
}

export async function saveNote(id: string, text: string) {
  const db = await getDb();
  await db.put('notes', text, id);
}

export async function addLogEntry(entry: PlayLogEntry) {
  const db = await getDb();
  await db.put('log', entry);
}

export async function deleteLogEntry(id: string) {
  const db = await getDb();
  await db.delete('log', id);
}

/** Replace all data in one transaction: either everything is written or nothing changes. */
export async function replaceAll(data: AppData) {
  const db = await getDb();
  const tx = db.transaction(['owned', 'corrections', 'notes', 'log'], 'readwrite');
  const owned = tx.objectStore('owned');
  const corrections = tx.objectStore('corrections');
  const notes = tx.objectStore('notes');
  const log = tx.objectStore('log');
  await Promise.all([owned.clear(), corrections.clear(), notes.clear(), log.clear()]);
  await Promise.all([
    ...data.owned.map((id) => owned.put(true, id)),
    ...Object.entries(data.corrections).map(([id, c]) => corrections.put(c, id)),
    ...Object.entries(data.notes).map(([id, text]) => notes.put(text, id)),
    ...data.log.map((entry) => log.put(entry)),
    tx.done,
  ]);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/storage/db.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/storage/db.ts src/storage/db.test.ts src/test/freshDb.ts
git commit -m "Store collection, corrections, notes and play log in IndexedDB

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Backup and restore

**Files:**
- Create: `src/storage/backup.ts`
- Test: `src/storage/backup.test.ts`

- [ ] **Step 1: Write the failing test `src/storage/backup.test.ts`**

```ts
import { freshDb } from '../test/freshDb';
import { makeLogEntry } from '../test/factories';
import { makeBackup, parseBackup, restoreFromText } from './backup';
import { addLogEntry, loadAll, saveCorrection, saveNote, setOwned } from './db';

beforeEach(freshDb);

describe('backup', () => {
  it('round-trips all data through a JSON file', async () => {
    await setOwned('1-3-001', true);
    await saveCorrection('1-3-001', { stats: { attack: 150 } });
    await saveNote('lanes', 'Three');
    await addLogEntry(makeLogEntry({ id: 'a' }));
    const before = await loadAll();
    const text = JSON.stringify(makeBackup(before, new Date('2026-10-31T00:00:00Z')));

    freshDb();
    const result = await restoreFromText(text);
    expect(result.ok).toBe(true);
    expect(await loadAll()).toEqual(before);
  });

  it('stamps the app name, version and date', () => {
    const backup = makeBackup({ owned: [], corrections: {}, notes: {}, log: [] }, new Date('2026-10-31T00:00:00Z'));
    expect(backup).toMatchObject({ app: 'mezastar-helper', version: 1, exportedAt: '2026-10-31T00:00:00.000Z' });
  });

  it.each([
    ['not json', 'not valid JSON'],
    ['{"app":"other","version":1}', 'not a Mezastar Helper backup'],
    ['{"app":"mezastar-helper","version":2}', 'Unsupported backup version: 2'],
    ['{"app":"mezastar-helper","version":1,"owned":"x","corrections":{},"notes":{},"log":[]}', 'owned tags'],
    ['{"app":"mezastar-helper","version":1,"owned":[],"corrections":{},"notes":{},"log":[{"id":1}]}', 'play log'],
  ])('rejects %s', (text, message) => {
    const result = parseBackup(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it('changes nothing when the file is invalid', async () => {
    await setOwned('1-3-001', true);
    const result = await restoreFromText('{"app":"other"}');
    expect(result.ok).toBe(false);
    expect((await loadAll()).owned).toEqual(['1-3-001']);
  });
});
```

Run: `npx vitest run src/storage/backup.test.ts`
Expected: FAIL — `Failed to resolve import "./backup"`.

- [ ] **Step 2: Create `src/storage/backup.ts`**

```ts
import type { PlayLogEntry, TagCorrection } from '../data/types';
import { replaceAll, type AppData } from './db';

export const BACKUP_VERSION = 1;

export type Backup = AppData & { app: 'mezastar-helper'; version: number; exportedAt: string };
export type ParseResult = { ok: true; data: AppData } | { ok: false; error: string };

export function makeBackup(data: AppData, now = new Date()): Backup {
  return { app: 'mezastar-helper', version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isString = (v: unknown): v is string => typeof v === 'string';

function isLogEntry(v: unknown): v is PlayLogEntry {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.date) &&
    isString(v.boss) &&
    Array.isArray(v.cronies) &&
    Array.isArray(v.turns)
  );
}

const damaged = (part: string): ParseResult => ({ ok: false, error: `The backup's ${part} section is damaged.` });

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not a backup (not valid JSON).' };
  }
  if (!isObject(raw) || raw.app !== 'mezastar-helper') {
    return { ok: false, error: 'This file is not a Mezastar Helper backup.' };
  }
  if (raw.version !== BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version: ${String(raw.version)}.` };
  }
  const { owned, corrections, notes, log } = raw;
  if (!Array.isArray(owned) || !owned.every(isString)) return damaged('owned tags');
  if (!isObject(corrections) || !Object.values(corrections).every(isObject)) return damaged('corrections');
  if (!isObject(notes) || !Object.values(notes).every(isString)) return damaged('notes');
  if (!Array.isArray(log) || !log.every(isLogEntry)) return damaged('play log');
  return {
    ok: true,
    data: {
      owned,
      corrections: corrections as Record<string, TagCorrection>,
      notes: notes as Record<string, string>,
      log,
    },
  };
}

/** Validate first; only a valid file replaces the data on the phone. */
export async function restoreFromText(text: string): Promise<ParseResult> {
  const result = parseBackup(text);
  if (result.ok) await replaceAll(result.data);
  return result;
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/storage/backup.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 4: Commit**

```bash
git add src/storage/backup.ts src/storage/backup.test.ts
git commit -m "Add backup export and validated restore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: App data hook, format helpers, screen test harness

**Files:**
- Create: `src/ui/useAppData.ts`, `src/ui/format.ts`, `src/ui/testHarness.tsx`
- Test: `src/ui/useAppData.test.tsx`

- [ ] **Step 1: Create `src/ui/format.ts`**

```ts
import type { Grade, PokemonType, Tag, Trust } from '../data/types';

export const gradeLabel = (g: Grade | null) => (g === null ? 'grade unknown' : `${g}★`);

export const typeLabel = (t: PokemonType) => t[0].toUpperCase() + t.slice(1);

export const TRUST_LABEL: Record<Trust, string> = {
  confirmed: 'Official',
  player: 'Seen by you',
  community: 'Community tip',
  open: 'Open question',
};

export const percent = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);

export function searchTags(tags: Tag[], query: string): Tag[] {
  const q = query.trim().toLowerCase();
  if (!q) return tags;
  return tags.filter((t) => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
}
```

- [ ] **Step 2: Create `src/ui/testHarness.tsx`**

```tsx
import type { ReactNode } from 'react';
import { useAppData, type AppStore } from './useAppData';

/** Renders a screen with a real store backed by the (fake) IndexedDB. */
export function WithStore({ children }: { children: (store: AppStore) => ReactNode }) {
  const store = useAppData();
  return store.loaded ? <>{children(store)}</> : <p>Loading…</p>;
}
```

- [ ] **Step 3: Write the failing test `src/ui/useAppData.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadAll, setOwned } from '../storage/db';
import { freshDb } from '../test/freshDb';
import { WithStore } from './testHarness';

beforeEach(freshDb);

it('loads saved data and applies corrections to tags', async () => {
  await setOwned('1-3-001', true);
  render(
    <WithStore>
      {(store) => (
        <p>
          {store.data.owned.join(',')} {store.tags.length}
        </p>
      )}
    </WithStore>,
  );
  expect(await screen.findByText('1-3-001 73')).toBeInTheDocument();
});

it('saves a toggle to storage', async () => {
  const user = userEvent.setup();
  render(
    <WithStore>
      {(store) => (
        <button type="button" onClick={() => store.toggleOwned('1-3-002')}>
          owned: {store.data.owned.length}
        </button>
      )}
    </WithStore>,
  );
  await user.click(await screen.findByRole('button', { name: 'owned: 0' }));
  expect(await screen.findByRole('button', { name: 'owned: 1' })).toBeInTheDocument();
  expect((await loadAll()).owned).toEqual(['1-3-002']);
});
```

Run: `npx vitest run src/ui/useAppData.test.tsx`
Expected: FAIL — `Failed to resolve import "./useAppData"`.

- [ ] **Step 4: Create `src/ui/useAppData.ts`**

```ts
import { useEffect, useMemo, useState } from 'react';
import { TAGS } from '../data/tags';
import type { PlayLogEntry, TagCorrection } from '../data/types';
import { applyCorrections } from '../engine/corrections';
import { restoreFromText, type ParseResult } from '../storage/backup';
import * as db from '../storage/db';
import type { AppData } from '../storage/db';

const EMPTY_DATA: AppData = { owned: [], corrections: {}, notes: {}, log: [] };

export function useAppData() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.loadAll()
      .then(setData)
      .catch(() => setError('Could not open storage on this phone. Changes will not be saved.'))
      .finally(() => setLoaded(true));
  }, []);

  const tags = useMemo(() => applyCorrections(TAGS, data.corrections), [data.corrections]);

  /** Update the screen right away, then save; tell the player if saving failed. */
  async function write(update: (d: AppData) => AppData, persist: () => Promise<void>) {
    setData(update);
    try {
      await persist();
    } catch {
      setError('Your latest change was not saved.');
    }
  }

  return {
    data,
    tags,
    loaded,
    error,
    dismissError: () => setError(null),
    toggleOwned(tagId: string) {
      const nowOwned = !data.owned.includes(tagId);
      return write(
        (d) => ({ ...d, owned: nowOwned ? [...d.owned, tagId] : d.owned.filter((id) => id !== tagId) }),
        () => db.setOwned(tagId, nowOwned),
      );
    },
    saveCorrection(tagId: string, correction: TagCorrection | null) {
      return write(
        (d) => {
          const corrections = { ...d.corrections };
          if (correction) corrections[tagId] = correction;
          else delete corrections[tagId];
          return { ...d, corrections };
        },
        () => db.saveCorrection(tagId, correction),
      );
    },
    saveNote(id: string, text: string) {
      return write((d) => ({ ...d, notes: { ...d.notes, [id]: text } }), () => db.saveNote(id, text));
    },
    addLog(entry: PlayLogEntry) {
      return write((d) => ({ ...d, log: [entry, ...d.log] }), () => db.addLogEntry(entry));
    },
    deleteLog(id: string) {
      return write((d) => ({ ...d, log: d.log.filter((e) => e.id !== id) }), () => db.deleteLogEntry(id));
    },
    async restore(text: string): Promise<ParseResult> {
      try {
        const result = await restoreFromText(text);
        if (result.ok) setData(result.data);
        return result;
      } catch {
        return { ok: false, error: 'Saving the restored data failed.' };
      }
    },
  };
}

export type AppStore = ReturnType<typeof useAppData>;
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/ui/useAppData.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add src/ui/useAppData.ts src/ui/useAppData.test.tsx src/ui/format.ts src/ui/testHarness.tsx
git commit -m "Add app data hook with save-failure messages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Collection screen and tag editor

**Files:**
- Create: `src/ui/screens/CollectionScreen.tsx`, `src/ui/screens/TagEditor.tsx`
- Test: `src/ui/screens/CollectionScreen.test.tsx`

- [ ] **Step 1: Write the failing test `src/ui/screens/CollectionScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { CollectionScreen } from './CollectionScreen';

beforeEach(freshDb);

const renderScreen = () => render(<WithStore>{(store) => <CollectionScreen store={store} />}</WithStore>);

it('toggles owned and keeps it after reopening', async () => {
  const user = userEvent.setup();
  const { unmount } = renderScreen();
  await screen.findByText('Owned 0 / 73');
  await user.click(screen.getByRole('button', { name: 'Not owned: Lugia 1-3-001' }));
  expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
  unmount();
  renderScreen();
  expect(await screen.findByText('Owned 1 / 73')).toBeInTheDocument();
});

it('searches by name or number', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.type(await screen.findByPlaceholderText('Search name or number'), '1-3-045');
  expect(screen.getByRole('button', { name: /^Metagross 1-3-045/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Lugia/ })).not.toBeInTheDocument();
});

it('saves a correction from the back of the tag', async () => {
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Attack'), '150');
  await user.click(screen.getByRole('button', { name: 'Save' }));
  await user.click(await screen.findByRole('button', { name: /^Lugia 1-3-001/ }));
  expect(screen.getByLabelText('Attack')).toHaveValue(150);
  expect(screen.getByText(/player correction/)).toBeInTheDocument();
});
```

Run: `npx vitest run src/ui/screens/CollectionScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./CollectionScreen"`.

- [ ] **Step 2: Create `src/ui/screens/TagEditor.tsx`**

```tsx
import { useState } from 'react';
import { GIMMICK_NAME, POKEMON_TYPES, type Grade, type PokemonType, type Tag, type TagCorrection } from '../../data/types';
import { gradeLabel, typeLabel } from '../format';

type Props = {
  tag: Tag;
  hasCorrection: boolean;
  onSave: (correction: TagCorrection) => void;
  onReset: () => void;
  onClose: () => void;
};

const FIELDS = [
  ['pokenergy', 'Pokénergy'],
  ['hp', 'HP'],
  ['attack', 'Attack'],
  ['defense', 'Defense'],
  ['speed', 'Speed'],
] as const;
type Field = (typeof FIELDS)[number][0];

const toText = (v: number | null) => (v === null ? '' : String(v));

export function TagEditor({ tag, hasCorrection, onSave, onReset, onClose }: Props) {
  const [grade, setGrade] = useState(tag.grade === null ? '' : String(tag.grade));
  const [type1, setType1] = useState<PokemonType>(tag.types[0]);
  const [type2, setType2] = useState<string>(tag.types[1] ?? '');
  const [numbers, setNumbers] = useState<Record<Field, string>>({
    pokenergy: toText(tag.pokenergy),
    hp: toText(tag.stats.hp),
    attack: toText(tag.stats.attack),
    defense: toText(tag.stats.defense),
    speed: toText(tag.stats.speed),
  });
  const [moveName, setMoveName] = useState(tag.move?.name ?? '');
  const [moveType, setMoveType] = useState<PokemonType>(tag.move?.type ?? tag.types[0]);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const parsed = {} as Record<Field, number | null>;
    for (const [field, label] of FIELDS) {
      const text = numbers[field].trim();
      if (text === '') {
        parsed[field] = null;
        continue;
      }
      const n = Number(text);
      if (!Number.isFinite(n) || n < 0) {
        setError(`${label} must be a number.`);
        return;
      }
      parsed[field] = n;
    }
    onSave({
      grade: grade === '' ? null : (Number(grade) as Grade),
      types: type2 && type2 !== type1 ? [type1, type2 as PokemonType] : [type1],
      pokenergy: parsed.pokenergy,
      stats: { hp: parsed.hp, attack: parsed.attack, defense: parsed.defense, speed: parsed.speed },
      move: moveName.trim() ? { name: moveName.trim(), type: moveType } : null,
    });
  }

  return (
    <section className="editor">
      <button type="button" className="link" onClick={onClose}>
        ‹ Back
      </button>
      <h1>
        {tag.name} <small>{tag.id}</small>
      </h1>
      <p>
        {gradeLabel(tag.grade)}
        {tag.gimmick && ` · ${GIMMICK_NAME[tag.gimmick.kind]}${tag.gimmick.moveName ? `: ${tag.gimmick.moveName}` : ''}`}
      </p>
      <p className="hint">Copy the numbers from the back of your tag. Leave a box empty if you don't know it.</p>

      <label>
        Grade
        <select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">unknown</option>
          {[2, 3, 4, 5, 6].map((g) => (
            <option key={g} value={g}>
              {g}★
            </option>
          ))}
        </select>
      </label>
      <label>
        Type
        <select value={type1} onChange={(e) => setType1(e.target.value as PokemonType)}>
          {POKEMON_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Second type
        <select value={type2} onChange={(e) => setType2(e.target.value)}>
          <option value="">none</option>
          {POKEMON_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </label>
      {FIELDS.map(([field, label]) => (
        <label key={field}>
          {label}
          <input
            type="number"
            inputMode="numeric"
            value={numbers[field]}
            onChange={(e) => setNumbers({ ...numbers, [field]: e.target.value })}
          />
        </label>
      ))}
      <label>
        Move
        <input value={moveName} onChange={(e) => setMoveName(e.target.value)} placeholder="unknown" />
      </label>
      <label>
        Move type
        <select value={moveType} onChange={(e) => setMoveType(e.target.value as PokemonType)}>
          {POKEMON_TYPES.map((t) => (
            <option key={t} value={t}>
              {typeLabel(t)}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="primary" onClick={save}>
          Save
        </button>
        {hasCorrection && (
          <button type="button" onClick={onReset}>
            Reset to app data
          </button>
        )}
      </div>
      <p className="sources">Sources: {tag.sources.join(' · ')}</p>
    </section>
  );
}
```

- [ ] **Step 3: Create `src/ui/screens/CollectionScreen.tsx`**

```tsx
import { useState } from 'react';
import type { Tag } from '../../data/types';
import { gradeLabel, searchTags, typeLabel } from '../format';
import type { AppStore } from '../useAppData';
import { TagEditor } from './TagEditor';

type Filter = 'all' | 'owned' | 'missing';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'owned', label: 'Owned' },
  { id: 'missing', label: 'Missing' },
];

export function CollectionScreen({ store }: { store: AppStore }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const owned = new Set(store.data.owned);
  const editing = store.tags.find((t) => t.id === editingId);

  if (editing) {
    const close = () => setEditingId(null);
    return (
      <TagEditor
        key={editing.id}
        tag={editing}
        hasCorrection={editing.id in store.data.corrections}
        onSave={async (c) => {
          await store.saveCorrection(editing.id, c);
          close();
        }}
        onReset={async () => {
          await store.saveCorrection(editing.id, null);
          close();
        }}
        onClose={close}
      />
    );
  }

  const isShown = (t: Tag) => filter === 'all' || (filter === 'owned') === owned.has(t.id);
  const list = searchTags(store.tags, query).filter(isShown);

  return (
    <section>
      <h1>Collection</h1>
      <p className="count">{`Owned ${owned.size} / ${store.tags.length}`}</p>
      <input
        type="search"
        placeholder="Search name or number"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="segmented">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <ul className="tag-list">
        {list.map((t) => {
          const isOwned = owned.has(t.id);
          return (
            <li key={t.id}>
              <button
                type="button"
                className={isOwned ? 'own on' : 'own'}
                aria-label={`${isOwned ? 'Owned' : 'Not owned'}: ${t.name} ${t.id}`}
                onClick={() => store.toggleOwned(t.id)}
              >
                {isOwned ? '✓' : ''}
              </button>
              <button type="button" className="tag-row" onClick={() => setEditingId(t.id)}>
                <strong>{t.name}</strong> <small>{`${t.id} · ${gradeLabel(t.grade)} · ${t.types.map(typeLabel).join('/')}`}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/ui/screens/CollectionScreen.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/screens
git commit -m "Add Collection screen with owned toggle and tag corrections

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase 3 — Engine: battle model, plan search, team scoring, stats

### Task 10: Battle model

**Files:**
- Create: `src/engine/battleModel.ts`
- Test: `src/engine/battleModel.test.ts`

The model is a deterministic estimate. All constants live in `MODEL` so they can be tuned later from the play log.

- [ ] **Step 1: Write the failing test `src/engine/battleModel.test.ts`**

```ts
import type { Tag } from '../data/types';
import { makeTag, type TagOverrides } from '../test/factories';
import { attacksFirst, damage, MODEL, simulate, type Battle } from './battleModel';

/** Opponents that barely hit back (Attack 1) and are slow (Speed 1). */
const opp = (id: string, o: TagOverrides = {}) => makeTag(id, { ...o, stats: { attack: 1, speed: 1, ...o.stats } });
const battleOf = (boss: Tag, c1: Tag, c2: Tag, targetIndex: 0 | 1 | 2 = 0): Battle => ({
  opponents: [boss, c1, c2],
  targetIndex,
});

describe('damage', () => {
  it('is Attack × effectiveness ÷ defense factor', () => {
    const fire = makeTag('fire', { move: { name: 'Ember', type: 'fire' } });
    expect(damage(fire, makeTag('g', { types: ['grass'] }), false)).toBe(200);
    expect(damage(fire, makeTag('g', { types: ['grass'], stats: { defense: 200 } }), false)).toBe(100);
  });

  it('uses the special move type and multiplier on the first attack only', () => {
    const z = makeTag('z', { gimmick: { kind: 'zmove', moveName: 'Black Hole Eclipse', moveType: 'dark' } });
    const psychic = makeTag('p', { types: ['psychic'] });
    expect(damage(z, psychic, true)).toBeCloseTo(100 * 2 * MODEL.gimmickMultiplier.zmove);
    expect(damage(z, psychic, false)).toBe(100);
  });

  it('treats unknown stats as average', () => {
    const unknown = makeTag('u', { stats: { attack: null } });
    expect(damage(unknown, makeTag('n'), false)).toBe(MODEL.neutralStat);
  });
});

describe('attacksFirst', () => {
  it('lets the faster Pokémon go first; ties go to the player', () => {
    expect(attacksFirst(makeTag('a'), makeTag('b'))).toBe(true);
    expect(attacksFirst(makeTag('a', { stats: { speed: 50 } }), makeTag('b'))).toBe(false);
  });
});

describe('simulate', () => {
  const a = makeTag('A', { stats: { attack: 40 } });
  const b = makeTag('B', { stats: { attack: 40 } });

  it('adds a supporter from the turn after a crony is defeated', () => {
    const battle = battleOf(opp('boss'), opp('c1', { stats: { hp: 40 } }), opp('c2'));
    const r = simulate([a, b], battle, [{ tagIndex: 0, aimAt: 1 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(r.outcomes[0]).toMatchObject({ defeated: true, supporters: 0, damageDealt: 40 });
    expect(r.outcomes[1]).toMatchObject({ supporters: 1, damageDealt: 40 + MODEL.supporterBonus });
    expect(r.damageToTarget).toBe(40 + MODEL.supporterBonus);
  });

  it('rejects the same tag on two turns in a row (Tiredness)', () => {
    const battle = battleOf(opp('boss'), opp('c1'), opp('c2'));
    expect(simulate([a, b], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 0, aimAt: 1 }])).toBeNull();
  });

  it('ends the battle when the Boss is defeated', () => {
    const battle = battleOf(opp('boss', { stats: { hp: 30 } }), opp('c1'), opp('c2'));
    const r = simulate([a, b], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 1, aimAt: 1 }])!;
    expect(r.outcomes).toHaveLength(1);
    expect(r.bossDefeated).toBe(true);
    expect(r.score).toBe(30 + MODEL.targetDefeatBonus);
  });

  it('counts a tag knocked out before it can attack, and forbids using it again', () => {
    const killer = opp('c1', { stats: { attack: 5000, speed: 999 } });
    const battle = battleOf(opp('boss'), killer, opp('c2'));
    const r = simulate([a, b], battle, [{ tagIndex: 0, aimAt: 1 }])!;
    expect(r.outcomes[0]).toMatchObject({ damageDealt: 0, tagLost: true });
    expect(r.score).toBe(-MODEL.lostTagPenalty);
    const again = [{ tagIndex: 0, aimAt: 1 }, { tagIndex: 1, aimAt: 0 }, { tagIndex: 0, aimAt: 0 }] as const;
    expect(simulate([a, b], battle, [...again])).toBeNull();
  });

  it('rejects aiming at an opponent that is already defeated', () => {
    const battle = battleOf(opp('boss'), opp('c1', { stats: { hp: 40 } }), opp('c2'));
    expect(simulate([a, b], battle, [{ tagIndex: 0, aimAt: 1 }, { tagIndex: 1, aimAt: 1 }])).toBeNull();
  });

  it('uses each kind of special move once per battle', () => {
    const z = { kind: 'zmove' as const, moveName: null, moveType: null };
    const z1 = makeTag('z1', { gimmick: z });
    const z2 = makeTag('z2', { gimmick: z });
    const battle = battleOf(opp('boss', { stats: { hp: 5000 } }), opp('c1'), opp('c2'));
    const r = simulate([z1, z2], battle, [{ tagIndex: 0, aimAt: 0 }, { tagIndex: 1, aimAt: 0 }])!;
    expect(r.outcomes.map((o) => o.usedGimmick)).toEqual([true, false]);
  });
});
```

Run: `npx vitest run src/engine/battleModel.test.ts`
Expected: FAIL — `Failed to resolve import "./battleModel"`.

- [ ] **Step 2: Create `src/engine/battleModel.ts`**

```ts
import type { Gimmick, PokemonType, Tag } from '../data/types';
import { effectiveness } from './typeEffectiveness';

/** Placeholder constants. Measure with the play log before changing them. */
export const MODEL = {
  neutralStat: 100, // stands in for any unknown HP / Attack / Defense / Speed
  defenseScale: 200, // defense factor = 1 + Defense / defenseScale
  supporterBonus: 30, // expected extra damage per supporter per turn
  gimmickMultiplier: {
    mega: 1.5,
    dynamax: 1.5,
    zmove: 1.8,
    tagMove: 1.8,
    doubleMove: 1.8,
    chainAttack: 1.3,
  } satisfies Record<Gimmick, number>,
  targetDefeatBonus: 50, // beating the Boss target starts Catch Time
  lostTagPenalty: 40,
  maxTurns: 3,
};

/** opponents[0] is the Boss; [1] and [2] are the cronies. */
export type Battle = { opponents: [Tag, Tag, Tag]; targetIndex: 0 | 1 | 2 };
export type Turn = { tagIndex: number; aimAt: 0 | 1 | 2 };

export type TurnOutcome = {
  turn: Turn;
  damageDealt: number;
  defeated: boolean;
  tagLost: boolean;
  usedGimmick: boolean;
  supporters: number; // supporters active during this turn
};

export type SimResult = {
  outcomes: TurnOutcome[];
  damageToTarget: number;
  targetDefeated: boolean;
  bossDefeated: boolean;
  tagsLost: number;
  score: number;
};

export const statOrNeutral = (v: number | null): number => v ?? MODEL.neutralStat;

export function attackType(tag: Tag, useGimmick: boolean): PokemonType {
  if (useGimmick && tag.gimmick?.moveType) return tag.gimmick.moveType;
  return tag.move?.type ?? tag.types[0];
}

export function damage(attacker: Tag, defender: Tag, useGimmick: boolean): number {
  const multiplier = useGimmick && attacker.gimmick ? MODEL.gimmickMultiplier[attacker.gimmick.kind] : 1;
  const eff = effectiveness(attackType(attacker, useGimmick), defender.types);
  const defenseFactor = 1 + statOrNeutral(defender.stats.defense) / MODEL.defenseScale;
  return (statOrNeutral(attacker.stats.attack) * eff * multiplier) / defenseFactor;
}

export function attacksFirst(attacker: Tag, defender: Tag): boolean {
  return statOrNeutral(attacker.stats.speed) >= statOrNeutral(defender.stats.speed);
}

/**
 * Plays out a sequence of turns. Returns null if any turn is illegal:
 * same tag twice in a row, a knocked-out tag, or an already-defeated opponent.
 * Turns after the Boss is defeated are ignored (Catch Time has started).
 */
export function simulate(team: Tag[], battle: Battle, turns: Turn[]): SimResult | null {
  const oppHp = battle.opponents.map((o) => statOrNeutral(o.stats.hp));
  const tagHp = team.map((t) => statOrNeutral(t.stats.hp));
  const hasAttacked = team.map(() => false);
  const usedGimmicks = new Set<Gimmick>();
  const outcomes: TurnOutcome[] = [];
  let supporters = 0;
  let newSupporters = 0;
  let damageToTarget = 0;
  let bossDefeated = false;
  let tagsLost = 0;

  for (const [i, turn] of turns.entries()) {
    if (bossDefeated) break;
    const tag = team[turn.tagIndex];
    if (!tag || tagHp[turn.tagIndex] <= 0 || oppHp[turn.aimAt] <= 0) return null;
    if (i > 0 && turns[i - 1].tagIndex === turn.tagIndex) return null;

    supporters += newSupporters;
    newSupporters = 0;
    const opp = battle.opponents[turn.aimAt];
    const kind = tag.gimmick?.kind;
    const usedGimmick = kind !== undefined && !hasAttacked[turn.tagIndex] && !usedGimmicks.has(kind);
    if (usedGimmick && kind) usedGimmicks.add(kind);
    hasAttacked[turn.tagIndex] = true;

    const hit = () => {
      const dealt = Math.min(oppHp[turn.aimAt], damage(tag, opp, usedGimmick) + supporters * MODEL.supporterBonus);
      oppHp[turn.aimAt] -= dealt;
      return dealt;
    };
    const counter = () => {
      tagHp[turn.tagIndex] -= damage(opp, tag, false);
    };

    let dealt = 0;
    if (attacksFirst(tag, opp)) {
      dealt = hit();
      if (oppHp[turn.aimAt] > 0) counter();
    } else {
      counter();
      if (tagHp[turn.tagIndex] > 0) dealt = hit();
    }

    const defeated = oppHp[turn.aimAt] <= 0;
    const tagLost = tagHp[turn.tagIndex] <= 0;
    if (tagLost) tagsLost += 1;
    if (turn.aimAt === battle.targetIndex) damageToTarget += dealt;
    if (defeated && turn.aimAt === 0) bossDefeated = true;
    if (defeated && turn.aimAt !== 0) newSupporters += 1;
    outcomes.push({ turn, damageDealt: dealt, defeated, tagLost, usedGimmick, supporters });
  }

  const targetDefeated = oppHp[battle.targetIndex] <= 0;
  const score =
    damageToTarget +
    (targetDefeated && battle.targetIndex === 0 ? MODEL.targetDefeatBonus : 0) -
    tagsLost * MODEL.lostTagPenalty;
  return { outcomes, damageToTarget, targetDefeated, bossDefeated, tagsLost, score };
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/engine/battleModel.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 4: Commit**

```bash
git add src/engine/battleModel.ts src/engine/battleModel.test.ts
git commit -m "Add deterministic battle model with supporters and Tiredness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Battle plan search

**Files:**
- Create: `src/engine/planSearch.ts`
- Test: `src/engine/planSearch.test.ts`

- [ ] **Step 1: Write the failing test `src/engine/planSearch.test.ts`**

```ts
import type { Tag } from '../data/types';
import { makeTag, type TagOverrides } from '../test/factories';
import type { Battle } from './battleModel';
import { bestPlan } from './planSearch';

const opp = (id: string, o: TagOverrides = {}) => makeTag(id, { ...o, stats: { attack: 1, speed: 1, ...o.stats } });
const battleOf = (boss: Tag, c1: Tag, c2: Tag, targetIndex: 0 | 1 | 2 = 0): Battle => ({
  opponents: [boss, c1, c2],
  targetIndex,
});

describe('bestPlan', () => {
  it('needs at least 2 tags', () => {
    expect(bestPlan([makeTag('A')], battleOf(opp('boss'), opp('c1'), opp('c2')))).toBeNull();
  });

  it('hits the Boss every turn when no crony can be defeated in one hit', () => {
    const team = [makeTag('A'), makeTag('B')];
    const plan = bestPlan(team, battleOf(opp('boss'), opp('c1'), opp('c2')))!;
    expect(plan.kind).toBe('searched');
    expect(plan.steps.map((s) => s.aimAtIndex)).toEqual([0, 0, 0]);
    expect(plan.comparison).toBe('Hitting the Boss on turn 1 is better here: no crony can be defeated in one hit.');
  });

  it('defeats a crony first when the supporter is worth more than one weak hit', () => {
    // Normal moves only do half damage to the Rock Boss; cronies fall in one hit.
    const team = [makeTag('A', { stats: { attack: 40 } }), makeTag('B', { stats: { attack: 40 } })];
    const battle = battleOf(opp('boss', { types: ['rock'] }), opp('c1', { stats: { hp: 40 } }), opp('c2', { stats: { hp: 40 } }));
    const plan = bestPlan(team, battle)!;
    expect(plan.steps.map((s) => s.aimAtIndex)).toEqual([1, 0, 0]);
    expect(plan.steps[0].expectDefeat).toBe(true);
    expect(plan.steps[0].why).toContain('Support Pokémon');
    expect(plan.comparison).toBe('This is the usual crony-first plan, and it is the best here.');
  });

  it('never uses the same tag on two turns in a row', () => {
    const team = [makeTag('A', { stats: { attack: 300 } }), makeTag('B'), makeTag('C')];
    const plan = bestPlan(team, battleOf(opp('boss', { stats: { hp: 5000 } }), opp('c1'), opp('c2')))!;
    for (let i = 1; i < plan.steps.length; i++) expect(plan.steps[i].tagId).not.toBe(plan.steps[i - 1].tagId);
  });

  it('can aim at a crony target', () => {
    const team = [makeTag('A'), makeTag('B')];
    const plan = bestPlan(team, battleOf(opp('boss'), opp('c1'), opp('c2'), 1))!;
    expect(plan.steps.map((s) => s.aimAtIndex)).toEqual([1, 1, 1]);
    expect(plan.steps.every((s) => s.isTarget)).toBe(true);
  });

  it('falls back to the rule of thumb when key stats are missing', () => {
    const team = [makeTag('A'), makeTag('B'), makeTag('C')];
    const battle = battleOf(opp('boss', { stats: { hp: null } }), opp('c1'), opp('c2'));
    const plan = bestPlan(team, battle)!;
    expect(plan.kind).toBe('ruleOfThumb');
    expect(plan.score).toBeNull();
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0].aimAtIndex).not.toBe(0);
    expect(plan.steps[1].tagId).not.toBe(plan.steps[0].tagId);
    expect(plan.steps[2].aimAtIndex).toBe(0);
    expect(plan.steps[2].tagId).not.toBe(plan.steps[1].tagId);
  });
});
```

Run: `npx vitest run src/engine/planSearch.test.ts`
Expected: FAIL — `Failed to resolve import "./planSearch"`.

- [ ] **Step 2: Create `src/engine/planSearch.ts`**

```ts
import { GIMMICK_NAME, type Tag, type Trust } from '../data/types';
import {
  attackType,
  damage,
  MODEL,
  simulate,
  statOrNeutral,
  type Battle,
  type SimResult,
  type Turn,
  type TurnOutcome,
} from './battleModel';
import { effectiveness } from './typeEffectiveness';

export type PlanStep = {
  turn: number;
  tagId: string;
  tagName: string;
  aimAtIndex: 0 | 1 | 2;
  aimAtId: string;
  aimAtLabel: string; // e.g. "Boss: Lugia" or "Crony: Pidgeot"
  isTarget: boolean;
  expectedDamage: number | null;
  expectDefeat: boolean | null;
  why: string;
  trust: Trust;
};

export type PlanResult = {
  kind: 'searched' | 'ruleOfThumb';
  steps: PlanStep[];
  score: number | null;
  comparison: string;
};

type Found = { turns: Turn[]; result: SimResult };

const AIMS = [0, 1, 2] as const;

export function hasKeyStats(team: Tag[], battle: Battle): boolean {
  return (
    team.every((t) => t.stats.attack !== null && t.stats.hp !== null && t.stats.speed !== null) &&
    battle.opponents.every((o) => o.stats.hp !== null)
  );
}

/** Try every legal sequence of (tag, opponent) turns and keep the highest score. */
export function searchBestTurns(team: Tag[], battle: Battle): Found | null {
  const state: { best: Found | null } = { best: null };

  const consider = (turns: Turn[], result: SimResult) => {
    const best = state.best;
    const better = !best || result.score > best.result.score + 1e-9;
    const tieButShorter =
      best !== null && Math.abs(result.score - best.result.score) <= 1e-9 && turns.length < best.turns.length;
    if (better || tieButShorter) state.best = { turns, result };
  };

  const explore = (prefix: Turn[], result: SimResult | null) => {
    let extended = false;
    if (prefix.length < MODEL.maxTurns && !result?.bossDefeated) {
      for (let tagIndex = 0; tagIndex < team.length; tagIndex++) {
        for (const aimAt of AIMS) {
          const turns = [...prefix, { tagIndex, aimAt }];
          const next = simulate(team, battle, turns);
          if (!next) continue;
          extended = true;
          explore(turns, next);
        }
      }
    }
    if (!extended && result) consider(prefix, result);
  };

  explore([], null);
  return state.best;
}

/** The usual advice: defeat a crony, switch tags, then the strongest hit on the target. */
export function ruleOfThumbTurns(team: Tag[], battle: Battle): Turn[] | null {
  if (team.length < 2) return null;
  const eff = (tagIndex: number, aim: number) =>
    effectiveness(attackType(team[tagIndex], false), battle.opponents[aim].types);
  const target = battle.targetIndex;
  const cronies = ([1, 2] as const).filter((i) => i !== target);

  let first: Turn = { tagIndex: 0, aimAt: cronies[0] };
  for (let ti = 0; ti < team.length; ti++) {
    for (const c of cronies) if (eff(ti, c) > eff(first.tagIndex, first.aimAt)) first = { tagIndex: ti, aimAt: c };
  }
  const bestVsTarget = (exclude: number) => {
    let pick = -1;
    for (let ti = 0; ti < team.length; ti++) {
      if (ti !== exclude && (pick < 0 || eff(ti, target) > eff(pick, target))) pick = ti;
    }
    return pick;
  };
  const second = bestVsTarget(first.tagIndex);
  const third = bestVsTarget(second);
  return [first, { tagIndex: second, aimAt: target }, { tagIndex: third, aimAt: target }];
}

const aimLabel = (battle: Battle, aim: 0 | 1 | 2) =>
  `${aim === 0 ? 'Boss' : 'Crony'}: ${battle.opponents[aim].name}`;

function searchedStep(team: Tag[], battle: Battle, o: TurnOutcome, index: number): PlanStep {
  const tag = team[o.turn.tagIndex];
  const aim = o.turn.aimAt;
  const opp = battle.opponents[aim];
  let why: string;
  let trust: Trust = 'player'; // relies on choosing which opponent to hit
  if (o.defeated && aim === 0) {
    why = 'Beats the Boss, so Catch Time starts.';
    trust = 'confirmed';
  } else if (o.defeated) {
    why = `Defeats ${opp.name}; it becomes your Support Pokémon from next turn.`;
    trust = 'confirmed';
  } else if (aim === battle.targetIndex) {
    why = 'Builds damage on your target to fill the Catch Gauge.';
  } else {
    why = `Wears down ${opp.name} (not expected to fall this turn).`;
  }
  if (o.usedGimmick && tag.gimmick) why += ` First attack uses ${tag.gimmick.moveName ?? GIMMICK_NAME[tag.gimmick.kind]}.`;
  if (o.supporters > 0) why += ` ${o.supporters} supporter${o.supporters > 1 ? 's' : ''} add power.`;
  if (o.tagLost) why += ' Risky: this tag may be knocked out.';
  return {
    turn: index + 1,
    tagId: tag.id,
    tagName: tag.name,
    aimAtIndex: aim,
    aimAtId: opp.id,
    aimAtLabel: aimLabel(battle, aim),
    isTarget: aim === battle.targetIndex,
    expectedDamage: Math.round(o.damageDealt),
    expectDefeat: o.defeated,
    why,
    trust,
  };
}

function ruleStep(team: Tag[], battle: Battle, turn: Turn, index: number): PlanStep {
  const tag = team[turn.tagIndex];
  const opp = battle.opponents[turn.aimAt];
  const reasons: [string, Trust][] = [
    [`Try to defeat ${opp.name} first so it becomes your Support Pokémon.`, 'community'],
    ['Use a different tag: the first one is tired.', 'confirmed'],
    ['Your strongest hit on the target.', 'player'],
  ];
  const [why, trust] = reasons[index];
  return {
    turn: index + 1,
    tagId: tag.id,
    tagName: tag.name,
    aimAtIndex: turn.aimAt,
    aimAtId: opp.id,
    aimAtLabel: aimLabel(battle, turn.aimAt),
    isTarget: turn.aimAt === battle.targetIndex,
    expectedDamage: null,
    expectDefeat: null,
    why,
    trust,
  };
}

function compareWithDefault(team: Tag[], battle: Battle, best: Found, defaultTurns: Turn[]): string {
  const same =
    best.turns.length === defaultTurns.length &&
    best.turns.every((t, i) => t.tagIndex === defaultTurns[i].tagIndex && t.aimAt === defaultTurns[i].aimAt);
  if (same) return 'This is the usual crony-first plan, and it is the best here.';
  const def = simulate(team, battle, defaultTurns);
  if (!def) return 'The usual crony-first plan does not fit this battle, so use this one.';
  const gain = Math.round(best.result.score - def.score);
  if (gain <= 0) return 'This plan and the usual crony-first plan are about equal here.';
  if (best.turns[0].aimAt === battle.targetIndex) {
    const targetLabel = battle.targetIndex === 0 ? 'the Boss' : battle.opponents[battle.targetIndex].name;
    const cronies = ([1, 2] as const).filter((i) => i !== battle.targetIndex);
    const noOneHit = cronies.every((c) =>
      team.every((t) => damage(t, battle.opponents[c], true) < statOrNeutral(battle.opponents[c].stats.hp)),
    );
    if (noOneHit) return `Hitting ${targetLabel} on turn 1 is better here: no crony can be defeated in one hit.`;
    return `Hitting ${targetLabel} on turn 1 is better here (about ${gain} more expected damage than crony-first).`;
  }
  return `This plan beats the usual crony-first plan by about ${gain} expected damage.`;
}

export function bestPlan(team: Tag[], battle: Battle): PlanResult | null {
  const defaultTurns = ruleOfThumbTurns(team, battle);
  if (!defaultTurns) return null;
  if (!hasKeyStats(team, battle)) {
    return {
      kind: 'ruleOfThumb',
      steps: defaultTurns.map((turn, i) => ruleStep(team, battle, turn, i)),
      score: null,
      comparison:
        'Some HP, Attack or Speed values are unknown, so this is the usual rule of thumb. Add them in Collection for a searched plan.',
    };
  }
  const found = searchBestTurns(team, battle);
  if (!found) return null;
  return {
    kind: 'searched',
    steps: found.result.outcomes.map((o, i) => searchedStep(team, battle, o, i)),
    score: found.result.score,
    comparison: compareWithDefault(team, battle, found, defaultTurns),
  };
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/engine/planSearch.test.ts`
Expected: PASS, 6 tests.

Why the two scenarios come out this way (useful if a constant changes later):
- Boss-first: every opponent has 1000 HP, so a crony turn gives no supporter. Boss ×3 = 300 vs any crony turn ≤ 200.
- Crony-first: Normal hits on the Rock Boss do 20. Crony, Boss, Boss = 0 + 50 + 50 = 100; Boss ×3 = 60; Boss, Crony, Boss = 70.

- [ ] **Step 4: Commit**

```bash
git add src/engine/planSearch.ts src/engine/planSearch.test.ts
git commit -m "Search every legal 3-turn plan, with rule-of-thumb fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Team scoring

**Files:**
- Create: `src/engine/teamScoring.ts`
- Test: `src/engine/teamScoring.test.ts`

- [ ] **Step 1: Write the failing test `src/engine/teamScoring.test.ts`**

```ts
import { makeTag } from '../test/factories';
import type { Battle } from './battleModel';
import { hitPower, rankTags, scoreTeam, topTeams, WEIGHTS } from './teamScoring';

const fire = makeTag('fire', { move: { name: 'Ember', type: 'fire' } });
const grass = makeTag('grass', { move: { name: 'Vine Whip', type: 'grass' } });
const water = makeTag('water', { move: { name: 'Water Gun', type: 'water' } });
const normal = makeTag('normal');

const grassBossWaterCronies: Battle = {
  opponents: [makeTag('boss', { types: ['grass'] }), makeTag('c1', { types: ['water'] }), makeTag('c2', { types: ['water'] })],
  targetIndex: 0,
};

describe('hitPower', () => {
  it('is Attack × effectiveness of the move type', () => {
    expect(hitPower(fire, grassBossWaterCronies.opponents[0])).toBe(200);
    expect(hitPower(water, grassBossWaterCronies.opponents[0])).toBe(50);
  });
});

describe('rankTags', () => {
  it('keeps the 15 strongest tags for this battle', () => {
    const many = Array.from({ length: 20 }, (_, i) => makeTag(`t${i}`, { stats: { attack: 10 * (i + 1) } }));
    const pool = rankTags(many, grassBossWaterCronies);
    expect(pool).toHaveLength(WEIGHTS.poolSize);
    expect(pool.map((t) => t.id)).not.toContain('t0');
    expect(pool[0].id).toBe('t19');
  });
});

describe('scoreTeam', () => {
  it('penalises a team with only one good attacker on the target (Tiredness)', () => {
    const allGrass: Battle = {
      opponents: [makeTag('boss', { types: ['grass'] }), makeTag('c1', { types: ['grass'] }), makeTag('c2', { types: ['grass'] })],
      targetIndex: 0,
    };
    const fire2 = makeTag('fire2', { move: { name: 'Ember', type: 'fire' } });
    const water2 = makeTag('water2', { move: { name: 'Water Gun', type: 'water' } });
    const twoGood = scoreTeam([fire, fire2, water], allGrass).score;
    const oneGood = scoreTeam([fire, water, water2], allGrass).score;
    expect(twoGood - oneGood).toBeCloseTo(WEIGHTS.rotationPenalty);
  });

  it('says when stats are unknown', () => {
    const unknown = makeTag('u', { stats: { speed: null } });
    const result = scoreTeam([unknown, fire, grass], grassBossWaterCronies);
    expect(result.usesUnknownStats).toBe(true);
    expect(result.reason).toContain('unknown');
  });
});

describe('topTeams', () => {
  it('ranks the team that covers the target and the cronies first', () => {
    const teams = topTeams([normal, water, grass, fire], grassBossWaterCronies);
    expect(teams).toHaveLength(3);
    const best = teams[0].team.map((t) => t.id);
    expect(best).toContain('fire');
    expect(best).toContain('grass');
    expect(teams[0].reason).toContain("fire → boss (target): It's effective!");
    expect(teams[0].score).toBeGreaterThanOrEqual(teams[1].score);
  });

  it('returns one smaller team when fewer than 3 tags are owned', () => {
    const teams = topTeams([fire, grass], grassBossWaterCronies);
    expect(teams).toHaveLength(1);
    expect(teams[0].team).toHaveLength(2);
  });

  it('returns nothing when no tags are owned', () => {
    expect(topTeams([], grassBossWaterCronies)).toEqual([]);
  });
});
```

Run: `npx vitest run src/engine/teamScoring.test.ts`
Expected: FAIL — `Failed to resolve import "./teamScoring"`.

- [ ] **Step 2: Create `src/engine/teamScoring.ts`**

```ts
import type { Tag } from '../data/types';
import { attackType, statOrNeutral, type Battle } from './battleModel';
import { effectiveness, effectText } from './typeEffectiveness';

/** Fixed weights for version 1. */
export const WEIGHTS = {
  target: 2, // the opponent you want to catch counts double
  crony: 1,
  speedBonus: 20, // best attacker is faster than that opponent
  rotationPenalty: 60, // fewer than 2 good attackers on the target
  goodAttackerShare: 0.75, // "good" = at least 75% of the best hit on the target
  resist: 10, // per opponent move type the tag resists
  bulkDivisor: 20, // (HP + Defense) / bulkDivisor
  gimmick: 25, // first-attack special move
  poolSize: 15, // tags kept before trying combinations
};

export type TeamScore = { team: Tag[]; score: number; reason: string; usesUnknownStats: boolean };

const weightOf = (battle: Battle, i: number) => (i === battle.targetIndex ? WEIGHTS.target : WEIGHTS.crony);

export function hitPower(tag: Tag, opp: Tag): number {
  return statOrNeutral(tag.stats.attack) * effectiveness(attackType(tag, false), opp.types);
}

function soloScore(tag: Tag, battle: Battle): number {
  const coverage = battle.opponents.reduce((sum, opp, i) => sum + weightOf(battle, i) * hitPower(tag, opp), 0);
  return coverage + (tag.gimmick ? WEIGHTS.gimmick : 0);
}

export function rankTags(owned: Tag[], battle: Battle): Tag[] {
  return [...owned].sort((a, b) => soloScore(b, battle) - soloScore(a, battle)).slice(0, WEIGHTS.poolSize);
}

function bestAgainst(team: Tag[], opp: Tag): Tag {
  let best = team[0];
  for (const t of team) if (hitPower(t, opp) > hitPower(best, opp)) best = t;
  return best;
}

const hasUnknownStats = (t: Tag) => Object.values(t.stats).some((v) => v === null);

function reasonFor(team: Tag[], battle: Battle, unknown: boolean): string {
  const parts = battle.opponents.map((opp, i) => {
    const best = bestAgainst(team, opp);
    const role = i === battle.targetIndex ? 'target' : i === 0 ? 'Boss' : 'crony';
    const word = effectText(effectiveness(attackType(best, false), opp.types));
    return `${best.name} → ${opp.name} (${role}): ${word}`;
  });
  return parts.join('; ') + (unknown ? '. Some stats unknown, counted as average.' : '.');
}

export function scoreTeam(team: Tag[], battle: Battle): TeamScore {
  let score = 0;

  // 1–2. Attack coverage and Speed
  battle.opponents.forEach((opp, i) => {
    const w = weightOf(battle, i);
    const best = bestAgainst(team, opp);
    score += w * hitPower(best, opp);
    if (best.stats.speed !== null && opp.stats.speed !== null && best.stats.speed > opp.stats.speed) {
      score += w * WEIGHTS.speedBonus;
    }
  });

  // 3. Rotation (Tiredness)
  const target = battle.opponents[battle.targetIndex];
  const top = hitPower(bestAgainst(team, target), target);
  const good = team.filter((t) => hitPower(t, target) >= WEIGHTS.goodAttackerShare * top).length;
  if (good < 2) score -= WEIGHTS.rotationPenalty;

  // 4–5. Defense and special moves
  for (const t of team) {
    for (const opp of battle.opponents) score += WEIGHTS.resist * (1 - effectiveness(attackType(opp, false), t.types));
    score += (statOrNeutral(t.stats.hp) + statOrNeutral(t.stats.defense)) / WEIGHTS.bulkDivisor;
    if (t.gimmick) score += WEIGHTS.gimmick;
  }

  const usesUnknownStats = [...team, ...battle.opponents].some(hasUnknownStats);
  return { team, score, reason: reasonFor(team, battle, usesUnknownStats), usesUnknownStats };
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

export function topTeams(owned: Tag[], battle: Battle, count = 3): TeamScore[] {
  const pool = rankTags(owned, battle);
  const size = Math.min(3, pool.length);
  if (size === 0) return [];
  return combinations(pool, size)
    .map((team) => scoreTeam(team, battle))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/engine/teamScoring.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 4: Commit**

```bash
git add src/engine/teamScoring.ts src/engine/teamScoring.test.ts
git commit -m "Score teams against the Boss and both cronies

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Recommendation facade

**Files:**
- Create: `src/engine/recommend.ts`
- Test: `src/engine/recommend.test.ts`

- [ ] **Step 1: Write the failing test `src/engine/recommend.test.ts`**

```ts
import { makeTag } from '../test/factories';
import type { Battle } from './battleModel';
import { recommend, unknownOpponent } from './recommend';

const battle: Battle = { opponents: [makeTag('boss'), makeTag('c1'), makeTag('c2')], targetIndex: 0 };

describe('recommend', () => {
  it('gives up to 3 teams, each with a battle plan', () => {
    const owned = ['a', 'b', 'c', 'd'].map((id) => makeTag(id));
    const recs = recommend(owned, battle);
    expect(recs).toHaveLength(3);
    for (const r of recs) expect(r.plan?.steps.length).toBeGreaterThan(0);
  });

  it('gives a team without a plan when only one tag is owned', () => {
    const recs = recommend([makeTag('a')], battle);
    expect(recs).toHaveLength(1);
    expect(recs[0].plan).toBeNull();
  });
});

describe('unknownOpponent', () => {
  it('is a neutral placeholder with unknown stats', () => {
    const o = unknownOpponent('x');
    expect(o.name).toBe('Unknown crony');
    expect(Object.values(o.stats).every((v) => v === null)).toBe(true);
  });
});
```

Run: `npx vitest run src/engine/recommend.test.ts`
Expected: FAIL — `Failed to resolve import "./recommend"`.

- [ ] **Step 2: Create `src/engine/recommend.ts`**

```ts
import type { Tag } from '../data/types';
import type { Battle } from './battleModel';
import { bestPlan, type PlanResult } from './planSearch';
import { topTeams, type TeamScore } from './teamScoring';

export type Recommendation = TeamScore & { plan: PlanResult | null };

export function recommend(owned: Tag[], battle: Battle, count = 3): Recommendation[] {
  return topTeams(owned, battle, count).map((t) => ({ ...t, plan: bestPlan(t.team, battle) }));
}

/** Stand-in for a crony the player did not enter (Plan screen). Normal type = neutral matchups. */
export function unknownOpponent(id: string): Tag {
  return {
    id,
    name: 'Unknown crony',
    grade: null,
    types: ['normal'],
    pokenergy: null,
    stats: { hp: null, attack: null, defense: null, speed: null },
    move: null,
    gimmick: null,
    legendary: false,
    mythical: false,
    sources: [],
  };
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/engine/recommend.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 4: Commit**

```bash
git add src/engine/recommend.ts src/engine/recommend.test.ts
git commit -m "Combine team scoring and plan search into recommendations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Play-log statistics

**Files:**
- Create: `src/engine/stats.ts`
- Test: `src/engine/stats.test.ts`

- [ ] **Step 1: Write the failing test `src/engine/stats.test.ts`**

```ts
import { TAGS } from '../data/tags';
import { makeLogEntry } from '../test/factories';
import { computeStats } from './stats';

const log = [
  makeLogEntry({
    id: 'a', location: 'Mall A', target: '1-3-001', caught: '1-3-001', bossDefeated: true, cronyDefeatedCount: 2,
    turns: [{ attacker: '1-3-002', aimedAt: '1-3-017', defeated: '1-3-017', predictedDefeat: true }],
  }),
  makeLogEntry({
    id: 'b', location: 'Mall A', target: '1-3-001', caught: null, bossDefeated: false, cronyDefeatedCount: 0,
    turns: [{ attacker: '1-3-002', aimedAt: '1-3-017', predictedDefeat: true }],
  }),
  makeLogEntry({
    id: 'c', target: '1-3-017', caught: '1-3-041', bossDefeated: true, cronyDefeatedCount: 1, superstarAppeared: false,
  }),
];

describe('computeStats', () => {
  const s = computeStats(log, TAGS);

  it('counts plays, wins and catches', () => {
    expect(s).toMatchObject({ plays: 3, wins: 2, catches: 2, superstarsSeen: 2, superstarsCaught: 1 });
  });

  it('measures how often the target was caught, overall and by win/loss', () => {
    expect(s.targetCatch).toEqual({ count: 3, caught: 1, rate: 1 / 3 });
    expect(s.whenWon).toEqual({ count: 2, caught: 1, rate: 0.5 });
    expect(s.whenLost).toEqual({ count: 1, caught: 0, rate: 0 });
  });

  it('groups by target grade, Superstars first', () => {
    expect(s.byTargetGrade).toEqual([
      { grade: '6★', rate: { count: 2, caught: 1, rate: 0.5 } },
      { grade: '5★', rate: { count: 1, caught: 0, rate: 0 } },
    ]);
  });

  it('compares plays where a crony was defeated against plays where none was', () => {
    expect(s.cronyDefeated).toEqual({ count: 2, caught: 1, rate: 0.5 });
    expect(s.noCronyDefeated).toEqual({ count: 1, caught: 0, rate: 0 });
  });

  it('counts Superstars seen per location', () => {
    expect(s.byLocation).toEqual([
      { location: 'Mall A', plays: 2, superstarsSeen: 2 },
      { location: 'Unlabelled', plays: 1, superstarsSeen: 0 },
    ]);
  });

  it('checks the model\'s one-hit predictions', () => {
    expect(s.predictions).toEqual({ checked: 2, correct: 1, rate: 0.5 });
  });

  it('handles an empty log', () => {
    const empty = computeStats([], TAGS);
    expect(empty.plays).toBe(0);
    expect(empty.targetCatch.rate).toBeNull();
    expect(empty.predictions.rate).toBeNull();
  });
});
```

Run: `npx vitest run src/engine/stats.test.ts`
Expected: FAIL — `Failed to resolve import "./stats"`.

- [ ] **Step 2: Create `src/engine/stats.ts`**

```ts
import type { Grade, PlayLogEntry, Tag } from '../data/types';

export type Rate = { count: number; caught: number; rate: number | null };

export type PlayStats = {
  plays: number;
  wins: number;
  catches: number;
  targetCatch: Rate;
  whenWon: Rate;
  whenLost: Rate;
  byTargetGrade: { grade: string; rate: Rate }[];
  superstarsSeen: number;
  superstarsCaught: number;
  cronyDefeated: Rate;
  noCronyDefeated: Rate;
  byLocation: { location: string; plays: number; superstarsSeen: number }[];
  predictions: { checked: number; correct: number; rate: number | null };
};

const GRADE_ORDER = ['6★', '5★', '4★', '3★', '2★', 'Unknown'];

/** Rate of plays where the player caught the Pokémon they were aiming for. */
function rate(entries: PlayLogEntry[]): Rate {
  const caught = entries.filter((e) => e.caught !== null && e.caught === e.target).length;
  return { count: entries.length, caught, rate: entries.length ? caught / entries.length : null };
}

export function computeStats(log: PlayLogEntry[], tags: Tag[]): PlayStats {
  const gradeOf = (id: string | null): Grade | null => tags.find((t) => t.id === id)?.grade ?? null;

  const byGrade = new Map<string, PlayLogEntry[]>();
  for (const e of log) {
    const g = gradeOf(e.target);
    const key = g === null ? 'Unknown' : `${g}★`;
    byGrade.set(key, [...(byGrade.get(key) ?? []), e]);
  }

  const locations = new Map<string, { plays: number; superstarsSeen: number }>();
  for (const e of log) {
    const key = e.location?.trim() || 'Unlabelled';
    const current = locations.get(key) ?? { plays: 0, superstarsSeen: 0 };
    current.plays += 1;
    if (e.superstarAppeared) current.superstarsSeen += 1;
    locations.set(key, current);
  }

  const checked = log
    .flatMap((e) => e.turns)
    .filter((t) => t.predictedDefeat !== undefined && t.aimedAt !== undefined);
  const correct = checked.filter((t) => t.predictedDefeat === (t.defeated === t.aimedAt)).length;

  return {
    plays: log.length,
    wins: log.filter((e) => e.bossDefeated).length,
    catches: log.filter((e) => e.caught !== null).length,
    targetCatch: rate(log),
    whenWon: rate(log.filter((e) => e.bossDefeated)),
    whenLost: rate(log.filter((e) => !e.bossDefeated)),
    byTargetGrade: GRADE_ORDER.filter((g) => byGrade.has(g)).map((grade) => ({ grade, rate: rate(byGrade.get(grade)!) })),
    superstarsSeen: log.filter((e) => e.superstarAppeared).length,
    superstarsCaught: log.filter((e) => gradeOf(e.caught) === 6).length,
    cronyDefeated: rate(log.filter((e) => e.cronyDefeatedCount > 0)),
    noCronyDefeated: rate(log.filter((e) => e.cronyDefeatedCount === 0)),
    byLocation: [...locations].map(([location, v]) => ({ location, ...v })),
    predictions: { checked: checked.length, correct, rate: checked.length ? correct / checked.length : null },
  };
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/engine/stats.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: all test files PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/stats.ts src/engine/stats.test.ts
git commit -m "Compute catch rates and prediction accuracy from the play log

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase 4 — Play and Plan screens (with the quick log form)

### Task 15: Tag picker and recommendation cards

**Files:**
- Create: `src/ui/components/TagPicker.tsx`, `src/ui/components/Recommendations.tsx`
- Test: `src/ui/components/Recommendations.test.tsx`

- [ ] **Step 1: Create `src/ui/components/TagPicker.tsx`**

```tsx
import { useState } from 'react';
import type { Tag } from '../../data/types';
import { gradeLabel, searchTags } from '../format';

type Props = { label: string; tags: Tag[]; value: Tag | null; onChange: (tag: Tag | null) => void };

export function TagPicker({ label, tags, value, onChange }: Props) {
  const [query, setQuery] = useState('');

  if (value) {
    return (
      <div className="picker">
        <span className="picker-label">{label}</span>
        <button type="button" className="chip" aria-label={`Clear ${label}`} onClick={() => onChange(null)}>
          {value.name} <small>{`${value.id} ${gradeLabel(value.grade)}`}</small> ✕
        </button>
      </div>
    );
  }

  const matches = query.trim() ? searchTags(tags, query).slice(0, 8) : [];
  return (
    <div className="picker">
      <label className="picker-label">
        {label}
        <input type="search" value={query} placeholder="Name or number" onChange={(e) => setQuery(e.target.value)} />
      </label>
      <div className="picker-results">
        {matches.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onChange(t);
              setQuery('');
            }}
          >
            {t.name} <small>{`${t.id} ${gradeLabel(t.grade)}`}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test `src/ui/components/Recommendations.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAGS } from '../../data/tags';
import type { Battle } from '../../engine/battleModel';
import { Recommendations } from './Recommendations';

const byId = (id: string) => TAGS.find((t) => t.id === id)!;
const battle: Battle = { opponents: [byId('1-3-001'), byId('1-3-017'), byId('1-3-041')], targetIndex: 0 };
const owned = ['1-3-002', '1-3-008', '1-3-012'].map(byId);

it('shows reminders, a team, its reason and a turn-by-turn plan', () => {
  render(<Recommendations owned={owned} battle={battle} />);
  expect(screen.getByText(/Scan it before placing any tags/)).toBeInTheDocument();
  expect(screen.getByText(/^Team 1:/)).toBeInTheDocument();
  expect(screen.getByText(/→ Lugia \(target\):/)).toBeInTheDocument(); // the reason line
  expect(screen.getByText('rule of thumb')).toBeInTheDocument();
  expect(screen.getAllByText(/^Turn \d:/)).toHaveLength(3);
});

it('asks for more tags when fewer than 2 are owned', () => {
  render(<Recommendations owned={[byId('1-3-002')]} battle={battle} />);
  expect(screen.getByText(/Mark at least 2 tags as owned/)).toBeInTheDocument();
});

it('lets the player pick the team they used', async () => {
  const onUseTeam = vi.fn();
  render(<Recommendations owned={owned} battle={battle} onUseTeam={onUseTeam} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'I used this team — log the play' }));
  expect(onUseTeam).toHaveBeenCalledTimes(1);
});
```

Run: `npx vitest run src/ui/components/Recommendations.test.tsx`
Expected: FAIL — `Failed to resolve import "./Recommendations"`.

- [ ] **Step 3: Create `src/ui/components/Recommendations.tsx`**

```tsx
import { useMemo } from 'react';
import type { Tag } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import { recommend, type Recommendation } from '../../engine/recommend';
import { TRUST_LABEL } from '../format';

type Props = { owned: Tag[]; battle: Battle; onUseTeam?: (rec: Recommendation) => void };

const REMINDERS = [
  'Have a Support Pokémon Ticket? Scan it before placing any tags.',
  'Slide a tag forward to preview the matchup: "It\'s effective!" is what you want.',
  'If "Everyone Attack!" appears, slide all your tags forward.',
];

export function Recommendations({ owned, battle, onUseTeam }: Props) {
  const recs = useMemo(() => recommend(owned, battle), [owned, battle]);
  if (owned.length < 2) {
    return <p className="notice">Mark at least 2 tags as owned in Collection to get a team and battle plan.</p>;
  }
  return (
    <div>
      <ul className="reminders">
        {REMINDERS.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {recs.map((rec, i) => (
        <TeamCard key={rec.team.map((t) => t.id).join('+')} rank={i + 1} rec={rec} onUse={onUseTeam && (() => onUseTeam(rec))} />
      ))}
    </div>
  );
}

function TeamCard({ rank, rec, onUse }: { rank: number; rec: Recommendation; onUse?: () => void }) {
  return (
    <article className="card">
      <h3>{`Team ${rank}: ${rec.team.map((t) => t.name).join(' + ')}`}</h3>
      <p className="reason">{rec.reason}</p>
      {rec.plan ? (
        <>
          <h4>
            Battle plan {rec.plan.kind === 'ruleOfThumb' && <span className="badge">rule of thumb</span>}
          </h4>
          <ol className="turns">
            {rec.plan.steps.map((s) => (
              <li key={s.turn}>
                <strong>{`Turn ${s.turn}:`}</strong> {`${s.tagName} → ${s.aimAtLabel}${s.isTarget ? ' (target)' : ''}`}
                <br />
                <small>
                  {s.why} <span className={`trust trust-${s.trust}`}>{TRUST_LABEL[s.trust]}</span>
                </small>
              </li>
            ))}
          </ol>
          <p className="comparison">{rec.plan.comparison}</p>
        </>
      ) : (
        <p>Own at least 2 tags to get a battle plan.</p>
      )}
      {onUse && (
        <button type="button" className="primary" onClick={onUse}>
          I used this team — log the play
        </button>
      )}
    </article>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/ui/components/Recommendations.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components
git commit -m "Add tag picker and team cards with battle plans

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Quick log form

**Files:**
- Create: `src/ui/screens/LogForm.tsx`
- Test: `src/ui/screens/LogForm.test.tsx`

- [ ] **Step 1: Write the failing test `src/ui/screens/LogForm.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAGS } from '../../data/tags';
import type { PlayLogEntry } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import { recommend } from '../../engine/recommend';
import { LogForm } from './LogForm';

const byId = (id: string) => TAGS.find((t) => t.id === id)!;
const battle: Battle = { opponents: [byId('1-3-001'), byId('1-3-017'), byId('1-3-041')], targetIndex: 0 };
const [rec] = recommend(['1-3-002', '1-3-008', '1-3-012'].map(byId), battle);

it('builds a log entry from a few taps', async () => {
  const user = userEvent.setup();
  const onSave = vi.fn<(e: PlayLogEntry) => void>();
  render(<LogForm mode="battle" battle={battle} rec={rec} lastLocation="Mall A" onSave={onSave} onCancel={() => {}} />);
  await user.click(screen.getByRole('button', { name: '1' }));
  await user.click(screen.getByRole('button', { name: 'Yes' }));
  await user.click(screen.getByRole('button', { name: 'Lugia' }));
  await user.click(screen.getByRole('button', { name: 'Ultra' }));
  await user.click(screen.getByRole('checkbox', { name: 'Add turn detail' }));
  await user.click(screen.getAllByRole('checkbox', { name: 'Defeated it' })[0]);
  await user.click(screen.getByRole('button', { name: 'Save play' }));

  const entry = onSave.mock.calls[0][0];
  expect(entry).toMatchObject({
    mode: 'battle',
    location: 'Mall A',
    boss: '1-3-001',
    cronies: ['1-3-017', '1-3-041'],
    target: '1-3-001',
    superstarAppeared: true,
    teamUsed: rec.team.map((t) => t.id),
    cronyDefeatedCount: 1,
    bossDefeated: true,
    ballType: 'ultra',
    caught: '1-3-001',
  });
  expect(entry.turns).toHaveLength(3);
  expect(entry.turns[0].defeated).toBe(entry.turns[0].aimedAt);
  expect(entry.turns[1].defeated).toBeUndefined();
});
```

Run: `npx vitest run src/ui/screens/LogForm.test.tsx`
Expected: FAIL — `Failed to resolve import "./LogForm"`.

- [ ] **Step 2: Create `src/ui/screens/LogForm.tsx`**

```tsx
import { useState } from 'react';
import type { BallType, PlayLogEntry, PlayMode } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import type { Recommendation } from '../../engine/recommend';

type Props = {
  mode: PlayMode;
  battle: Battle;
  rec: Recommendation;
  lastLocation: string;
  onSave: (entry: PlayLogEntry) => void;
  onCancel: () => void;
};

const BALLS: { id: BallType; label: string }[] = [
  { id: 'poke', label: 'Poké' },
  { id: 'great', label: 'Great' },
  { id: 'ultra', label: 'Ultra' },
  { id: 'master', label: 'Master' },
];

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function LogForm({ mode, battle, rec, lastLocation, onSave, onCancel }: Props) {
  const [boss, crony1, crony2] = battle.opponents;
  const steps = rec.plan?.steps ?? [];
  const [location, setLocation] = useState(lastLocation);
  const [cronyDefeated, setCronyDefeated] = useState<0 | 1 | 2>(0);
  const [bossDefeated, setBossDefeated] = useState(false);
  const [caughtIndex, setCaughtIndex] = useState<number | null>(null);
  const [ball, setBall] = useState<BallType | undefined>(undefined);
  const [note, setNote] = useState('');
  const [withTurns, setWithTurns] = useState(false);
  const [defeatedAt, setDefeatedAt] = useState<boolean[]>(steps.map(() => false));

  function save() {
    onSave({
      id: newId(),
      date: new Date().toISOString(),
      location: location.trim() || undefined,
      mode,
      boss: boss.id,
      cronies: [crony1.id, crony2.id],
      target: battle.opponents[battle.targetIndex].id,
      superstarAppeared: battle.opponents.some((o) => o.grade === 6),
      teamUsed: rec.team.map((t) => t.id),
      turns: withTurns
        ? steps.map((s, i) => ({
            attacker: s.tagId,
            aimedAt: s.aimAtId,
            defeated: defeatedAt[i] ? s.aimAtId : undefined,
            predictedDefeat: s.expectDefeat ?? undefined,
          }))
        : [],
      cronyDefeatedCount: cronyDefeated,
      bossDefeated,
      ballType: ball,
      caught: caughtIndex === null ? null : battle.opponents[caughtIndex].id,
      note: note.trim() || undefined,
    });
  }

  return (
    <section>
      <h1>Log this play</h1>
      <label>
        Location
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Arcade or machine" />
      </label>

      <h2>Cronies defeated</h2>
      <div className="segmented">
        {([0, 1, 2] as const).map((n) => (
          <button key={n} type="button" aria-pressed={cronyDefeated === n} onClick={() => setCronyDefeated(n)}>
            {n}
          </button>
        ))}
      </div>

      <h2>Boss defeated?</h2>
      <div className="segmented">
        <button type="button" aria-pressed={bossDefeated} onClick={() => setBossDefeated(true)}>
          Yes
        </button>
        <button type="button" aria-pressed={!bossDefeated} onClick={() => setBossDefeated(false)}>
          No
        </button>
      </div>

      <h2>Caught</h2>
      <div className="segmented">
        <button type="button" aria-pressed={caughtIndex === null} onClick={() => setCaughtIndex(null)}>
          Nothing
        </button>
        {battle.opponents.map((o, i) => (
          <button key={i} type="button" aria-pressed={caughtIndex === i} onClick={() => setCaughtIndex(i)}>
            {o.name}
          </button>
        ))}
      </div>

      <h2>Ball (optional)</h2>
      <div className="segmented">
        {BALLS.map((b) => (
          <button key={b.id} type="button" aria-pressed={ball === b.id} onClick={() => setBall(ball === b.id ? undefined : b.id)}>
            {b.label}
          </button>
        ))}
      </div>

      {steps.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={withTurns} onChange={(e) => setWithTurns(e.target.checked)} />
          Add turn detail
        </label>
      )}
      {withTurns && (
        <ol className="turns">
          {steps.map((s, i) => (
            <li key={s.turn}>
              {`Turn ${s.turn}: ${s.tagName} → ${s.aimAtLabel}`}
              <label className="check">
                <input
                  type="checkbox"
                  checked={defeatedAt[i]}
                  onChange={(e) => setDefeatedAt(defeatedAt.map((d, j) => (j === i ? e.target.checked : d)))}
                />
                Defeated it
              </label>
            </li>
          ))}
        </ol>
      )}

      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
      </label>
      <div className="actions">
        <button type="button" className="primary" onClick={save}>
          Save play
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/ui/screens/LogForm.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/LogForm.tsx src/ui/screens/LogForm.test.tsx
git commit -m "Add 10-second play log form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Play screen

**Files:**
- Create: `src/ui/screens/PlayScreen.tsx`
- Test: `src/ui/screens/PlayScreen.test.tsx`

- [ ] **Step 1: Write the failing test `src/ui/screens/PlayScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadAll, setOwned } from '../../storage/db';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { PlayScreen } from './PlayScreen';

beforeEach(freshDb);

async function enterBattle() {
  for (const id of ['1-3-002', '1-3-008', '1-3-012']) await setOwned(id, true);
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlayScreen store={store} />}</WithStore>);
  await user.type(await screen.findByLabelText('Boss'), 'Lugia');
  await user.click(screen.getByRole('button', { name: /^Lugia 1-3-001/ }));
  await user.type(screen.getByLabelText('Crony 1'), 'Pidgeot');
  await user.click(screen.getByRole('button', { name: /^Pidgeot 1-3-017/ }));
  await user.type(screen.getByLabelText('Crony 2'), 'Koffing');
  await user.click(screen.getByRole('button', { name: /^Koffing 1-3-041/ }));
  return user;
}

it('recommends a team and plan once all three opponents are entered', async () => {
  await enterBattle();
  expect(screen.getByText(/^Team 1:/)).toBeInTheDocument();
  expect(screen.getAllByText(/^Turn 1:/).length).toBeGreaterThan(0);
});

it('lets the player switch the target to a crony', async () => {
  const user = await enterBattle();
  await user.click(screen.getByRole('button', { name: 'Pidgeot' }));
  expect(screen.getByText(/→ Pidgeot \(target\):/)).toBeInTheDocument(); // the reason line
});

it('shows the Catch now warning', async () => {
  const user = await enterBattle();
  await user.click(screen.getByRole('button', { name: 'Catch now' }));
  expect(screen.getByText(/rarely gives Superstars/)).toBeInTheDocument();
});

it('logs the play and saves it on the phone', async () => {
  const user = await enterBattle();
  await user.click(screen.getByRole('button', { name: 'I used this team — log the play' }));
  await user.click(screen.getByRole('button', { name: 'Yes' }));
  await user.click(screen.getByRole('button', { name: 'Lugia' }));
  await user.click(screen.getByRole('button', { name: 'Save play' }));
  expect(await screen.findByText(/Play saved/)).toBeInTheDocument();
  const { log } = await loadAll();
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ boss: '1-3-001', target: '1-3-001', caught: '1-3-001', bossDefeated: true });
});
```

Run: `npx vitest run src/ui/screens/PlayScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./PlayScreen"`.

- [ ] **Step 2: Create `src/ui/screens/PlayScreen.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { PlayMode, Tag } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import type { Recommendation } from '../../engine/recommend';
import { Recommendations } from '../components/Recommendations';
import { TagPicker } from '../components/TagPicker';
import type { AppStore } from '../useAppData';
import { LogForm } from './LogForm';

const MODES: { id: PlayMode; label: string }[] = [
  { id: 'battle', label: 'Battle' },
  { id: 'catchNow', label: 'Catch now' },
  { id: 'specialTagBattle', label: 'Special Tag Battle' },
];
const SLOTS = ['Boss', 'Crony 1', 'Crony 2'];

export function PlayScreen({ store }: { store: AppStore }) {
  const [mode, setMode] = useState<PlayMode>('battle');
  const [picked, setPicked] = useState<(Tag | null)[]>([null, null, null]);
  const [targetIndex, setTargetIndex] = useState<0 | 1 | 2>(0);
  const [logging, setLogging] = useState<Recommendation | null>(null);
  const [saved, setSaved] = useState(false);

  const owned = useMemo(
    () => store.tags.filter((t) => store.data.owned.includes(t.id)),
    [store.tags, store.data.owned],
  );
  const [boss, crony1, crony2] = picked;
  const battle = useMemo<Battle | null>(
    () => (boss && crony1 && crony2 ? { opponents: [boss, crony1, crony2], targetIndex } : null),
    [boss, crony1, crony2, targetIndex],
  );

  const pick = (slot: number) => (tag: Tag | null) => {
    setPicked((p) => p.map((x, i) => (i === slot ? tag : x)));
    if (tag === null && slot === targetIndex) setTargetIndex(0);
    setSaved(false);
  };

  if (logging && battle) {
    return (
      <LogForm
        mode={mode}
        battle={battle}
        rec={logging}
        lastLocation={store.data.log[0]?.location ?? ''}
        onCancel={() => setLogging(null)}
        onSave={async (entry) => {
          await store.addLog(entry);
          setLogging(null);
          setPicked([null, null, null]);
          setTargetIndex(0);
          setSaved(true);
        }}
      />
    );
  }

  return (
    <section>
      <h1>Play</h1>
      {saved && <p className="notice">Play saved. Good luck on the next one!</p>}
      <div className="segmented">
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'catchNow' && (
        <p className="notice">Community tip: "Catch now!" rarely gives Superstars. A full battle is usually better.</p>
      )}
      <p className="hint">Enter the 3 Pokémon on the screen.</p>
      {SLOTS.map((label, i) => (
        <TagPicker key={label} label={label} tags={store.tags} value={picked[i]} onChange={pick(i)} />
      ))}
      {battle && (
        <>
          <h2>Which one do you want to catch?</h2>
          <div className="segmented">
            {battle.opponents.map((o, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={targetIndex === i}
                onClick={() => setTargetIndex(i as 0 | 1 | 2)}
              >
                {o.name}
              </button>
            ))}
          </div>
          <Recommendations owned={owned} battle={battle} onUseTeam={setLogging} />
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/ui/screens/PlayScreen.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/PlayScreen.tsx src/ui/screens/PlayScreen.test.tsx
git commit -m "Add Play screen: enter opponents, get teams and plans, log the play

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 18: Plan screen

**Files:**
- Create: `src/ui/screens/PlanScreen.tsx`
- Test: `src/ui/screens/PlanScreen.test.tsx`

- [ ] **Step 1: Write the failing test `src/ui/screens/PlanScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setOwned } from '../../storage/db';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { PlanScreen } from './PlanScreen';

beforeEach(freshDb);

it('plans for a Superstar picked with one tap, using unknown cronies', async () => {
  for (const id of ['1-3-002', '1-3-008']) await setOwned(id, true);
  const user = userEvent.setup();
  render(<WithStore>{(store) => <PlanScreen store={store} />}</WithStore>);
  await user.click(await screen.findByRole('button', { name: 'Lugia' }));
  expect(screen.getByText(/^Team 1:/)).toBeInTheDocument();
  expect(screen.getAllByText(/Unknown crony/).length).toBeGreaterThan(0);
});
```

Run: `npx vitest run src/ui/screens/PlanScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./PlanScreen"`.

- [ ] **Step 2: Create `src/ui/screens/PlanScreen.tsx`**

```tsx
import { useMemo, useState } from 'react';
import type { Tag } from '../../data/types';
import type { Battle } from '../../engine/battleModel';
import { unknownOpponent } from '../../engine/recommend';
import { Recommendations } from '../components/Recommendations';
import { TagPicker } from '../components/TagPicker';
import type { AppStore } from '../useAppData';

export function PlanScreen({ store }: { store: AppStore }) {
  const [target, setTarget] = useState<Tag | null>(null);
  const [crony1, setCrony1] = useState<Tag | null>(null);
  const [crony2, setCrony2] = useState<Tag | null>(null);

  const owned = useMemo(
    () => store.tags.filter((t) => store.data.owned.includes(t.id)),
    [store.tags, store.data.owned],
  );
  const superstars = store.tags.filter((t) => t.grade === 6);
  const battle = useMemo<Battle | null>(
    () =>
      target
        ? {
            opponents: [target, crony1 ?? unknownOpponent('unknown-1'), crony2 ?? unknownOpponent('unknown-2')],
            targetIndex: 0,
          }
        : null,
    [target, crony1, crony2],
  );

  return (
    <section>
      <h1>Plan</h1>
      <p className="hint">Pick the Pokémon you want to catch. The plan assumes it appears as the Boss.</p>
      {!target && (
        <div className="chips">
          {superstars.map((t) => (
            <button key={t.id} type="button" onClick={() => setTarget(t)}>
              {t.name}
            </button>
          ))}
        </div>
      )}
      <TagPicker label="Target" tags={store.tags} value={target} onChange={setTarget} />
      <TagPicker label="Crony 1 (optional)" tags={store.tags} value={crony1} onChange={setCrony1} />
      <TagPicker label="Crony 2 (optional)" tags={store.tags} value={crony2} onChange={setCrony2} />
      {battle && <Recommendations owned={owned} battle={battle} />}
    </section>
  );
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/ui/screens/PlanScreen.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/PlanScreen.tsx src/ui/screens/PlanScreen.test.tsx
git commit -m "Add Plan screen for planning a Superstar catch at home

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase 5 — Stats screen (play log, backup, restore)

### Task 19: Stats screen

**Files:**
- Create: `src/ui/screens/StatsScreen.tsx`
- Test: `src/ui/screens/StatsScreen.test.tsx`

- [ ] **Step 1: Write the failing test `src/ui/screens/StatsScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addLogEntry, loadAll } from '../../storage/db';
import { makeLogEntry } from '../../test/factories';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { StatsScreen } from './StatsScreen';

beforeEach(freshDb);

const renderScreen = () => render(<WithStore>{(store) => <StatsScreen store={store} />}</WithStore>);

it('shows numbers from the play log', async () => {
  await addLogEntry(makeLogEntry({ id: 'a', caught: '1-3-001', bossDefeated: true }));
  await addLogEntry(makeLogEntry({ id: 'b' }));
  renderScreen();
  expect(await screen.findByTestId('plays')).toHaveTextContent('2');
  expect(screen.getByTestId('superstars-caught')).toHaveTextContent('1');
  expect(screen.getByTestId('target-catch')).toHaveTextContent('50% (1/2)');
});

it('deletes a log entry', async () => {
  await addLogEntry(makeLogEntry({ id: 'a' }));
  const user = userEvent.setup();
  renderScreen();
  await user.click(await screen.findByRole('button', { name: /^Delete play/ }));
  expect(await screen.findByTestId('plays')).toHaveTextContent('0');
  expect((await loadAll()).log).toHaveLength(0);
});

it('rejects a bad backup file and changes nothing', async () => {
  await addLogEntry(makeLogEntry({ id: 'a' }));
  const user = userEvent.setup();
  renderScreen();
  const file = new File(['not json'], 'backup.json', { type: 'application/json' });
  await user.upload(await screen.findByLabelText('Restore from backup'), file);
  expect(await screen.findByText(/Restore failed/)).toBeInTheDocument();
  expect((await loadAll()).log).toHaveLength(1);
});
```

Run: `npx vitest run src/ui/screens/StatsScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./StatsScreen"`.

- [ ] **Step 2: Create `src/ui/screens/StatsScreen.tsx`**

```tsx
import { useMemo, useState, type ChangeEvent } from 'react';
import { computeStats, type Rate } from '../../engine/stats';
import { makeBackup } from '../../storage/backup';
import { percent } from '../format';
import type { AppStore } from '../useAppData';

const showRate = (r: Rate) => (r.rate === null ? '—' : `${percent(r.rate)} (${r.caught}/${r.count})`);

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function Row({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td data-testid={testId}>{value}</td>
    </tr>
  );
}

export function StatsScreen({ store }: { store: AppStore }) {
  const stats = useMemo(() => computeStats(store.data.log, store.tags), [store.data.log, store.tags]);
  const [message, setMessage] = useState<string | null>(null);
  const nameOf = (id: string | null) => store.tags.find((t) => t.id === id)?.name ?? 'nothing';

  function backup() {
    const json = JSON.stringify(makeBackup(store.data), null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mezastar-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function restore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = await store.restore(await readFileText(file));
    setMessage(result.ok ? 'Backup restored.' : `Restore failed: ${result.error} Nothing was changed.`);
  }

  return (
    <section>
      <h1>Stats</h1>
      <table className="stats">
        <tbody>
          <Row label="Plays" value={stats.plays} testId="plays" />
          <Row label="Boss defeated" value={stats.wins} />
          <Row label="Caught anything" value={stats.catches} />
          <Row label="Caught your target" value={showRate(stats.targetCatch)} testId="target-catch" />
          <Row label="…when you beat the Boss" value={showRate(stats.whenWon)} />
          <Row label="…when you didn't" value={showRate(stats.whenLost)} />
          <Row label="…when a crony was defeated" value={showRate(stats.cronyDefeated)} />
          <Row label="…when no crony was defeated" value={showRate(stats.noCronyDefeated)} />
          <Row label="Superstars seen" value={stats.superstarsSeen} />
          <Row label="Superstars caught" value={stats.superstarsCaught} testId="superstars-caught" />
          {stats.byTargetGrade.map((g) => (
            <Row key={g.grade} label={`Target ${g.grade}`} value={showRate(g.rate)} />
          ))}
          <Row
            label="Plan's one-hit predictions right"
            value={stats.predictions.rate === null ? '—' : `${percent(stats.predictions.rate)} (${stats.predictions.correct}/${stats.predictions.checked})`}
          />
        </tbody>
      </table>

      {stats.byLocation.length > 0 && (
        <>
          <h2>Superstars by location</h2>
          <table className="stats">
            <tbody>
              {stats.byLocation.map((l) => (
                <Row key={l.location} label={l.location} value={`${l.superstarsSeen} in ${l.plays} plays`} />
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Play log</h2>
      <ul className="log">
        {store.data.log.map((e) => (
          <li key={e.id}>
            <span>{`${e.date.slice(0, 10)} · Boss ${nameOf(e.boss)} · caught ${nameOf(e.caught)}`}</span>
            <button type="button" aria-label={`Delete play ${e.date.slice(0, 10)} ${nameOf(e.boss)}`} onClick={() => store.deleteLog(e.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>

      <h2>Backup</h2>
      <p className="hint">Save a backup to Files or iCloud Drive now and then. Data lives only on this phone.</p>
      <div className="actions">
        <button type="button" className="primary" onClick={backup}>
          Save backup
        </button>
        <label className="file-button">
          Restore from backup
          <input type="file" accept="application/json,.json" onChange={restore} />
        </label>
      </div>
      {message && <p className="notice">{message}</p>}
    </section>
  );
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/ui/screens/StatsScreen.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/StatsScreen.tsx src/ui/screens/StatsScreen.test.tsx
git commit -m "Add Stats screen with play log, backup and restore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase 6 — Guide screen

### Task 20: Guide screen with open questions

**Files:**
- Create: `src/ui/screens/GuideScreen.tsx`
- Test: `src/ui/screens/GuideScreen.test.tsx`

- [ ] **Step 1: Write the failing test `src/ui/screens/GuideScreen.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loadAll } from '../../storage/db';
import { freshDb } from '../../test/freshDb';
import { WithStore } from '../testHarness';
import { GuideScreen } from './GuideScreen';

beforeEach(freshDb);

it('groups mechanics by trust level', async () => {
  render(<WithStore>{(store) => <GuideScreen store={store} />}</WithStore>);
  expect(await screen.findByText('Tiredness')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Official' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Community tip' })).toBeInTheDocument();
});

it('saves the player\'s answer to an open question', async () => {
  const user = userEvent.setup();
  render(<WithStore>{(store) => <GuideScreen store={store} />}</WithStore>);
  await user.type(await screen.findByLabelText(/How many tags can you place/), 'Three lanes');
  await user.click(screen.getAllByRole('button', { name: 'Save answer' })[0]);
  expect(await screen.findByText('Saved')).toBeInTheDocument();
  expect((await loadAll()).notes.lanes).toBe('Three lanes');
});
```

Run: `npx vitest run src/ui/screens/GuideScreen.test.tsx`
Expected: FAIL — `Failed to resolve import "./GuideScreen"`.

- [ ] **Step 2: Create `src/ui/screens/GuideScreen.tsx`**

```tsx
import { useState } from 'react';
import { MECHANICS, OPEN_QUESTIONS } from '../../data/mechanics';
import type { OpenQuestion, Trust } from '../../data/types';
import { TRUST_LABEL } from '../format';
import type { AppStore } from '../useAppData';

const ORDER: Trust[] = ['confirmed', 'player', 'community', 'open'];

function Source({ source }: { source: string }) {
  return source.startsWith('http') ? (
    <a href={source} target="_blank" rel="noreferrer">
      {new URL(source).pathname.split('/').pop() || source}
    </a>
  ) : (
    <span>{source}</span>
  );
}

function AnswerField({ q, initial, onSave }: { q: OpenQuestion; initial: string; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <div className="question">
      <label>
        {q.question}
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <small>{q.why}</small>
      <div className="actions">
        <button
          type="button"
          onClick={async () => {
            await onSave(text);
            setSaved(true);
          }}
        >
          Save answer
        </button>
        {saved && <span className="saved">Saved</span>}
      </div>
    </div>
  );
}

export function GuideScreen({ store }: { store: AppStore }) {
  return (
    <section>
      <h1>Guide</h1>
      {ORDER.map((trust) => (
        <div key={trust}>
          <h2>{TRUST_LABEL[trust]}</h2>
          {MECHANICS.filter((m) => m.trust === trust).map((m) => (
            <details key={m.id}>
              <summary>
                <strong>{m.title}</strong> <span className={`trust trust-${m.trust}`}>{TRUST_LABEL[m.trust]}</span>
              </summary>
              <p>{m.explanation}</p>
              {m.sources.length > 0 && (
                <p className="sources">
                  Sources:{' '}
                  {m.sources.map((s, i) => (
                    <span key={s}>
                      {i > 0 && ' · '}
                      <Source source={s} />
                    </span>
                  ))}
                </p>
              )}
            </details>
          ))}
        </div>
      ))}
      <h2>Help fill the gaps</h2>
      <p className="hint">Answer what you see at the machine. Answers stay on this phone and go into backups.</p>
      {OPEN_QUESTIONS.map((q) => (
        <AnswerField key={q.id} q={q} initial={store.data.notes[q.id] ?? ''} onSave={(text) => store.saveNote(q.id, text)} />
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run src/ui/screens/GuideScreen.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/GuideScreen.tsx src/ui/screens/GuideScreen.test.tsx
git commit -m "Add Guide screen with trust levels and open questions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Phase 7 — App shell, offline check, publishing

### Task 21: App shell and styles

**Files:**
- Modify (replace): `src/ui/App.tsx`, `src/ui/App.test.tsx`, `src/ui/styles.css`

- [ ] **Step 1: Replace `src/ui/App.test.tsx` with the failing test**

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { freshDb } from '../test/freshDb';
import { App } from './App';

beforeEach(freshDb);

it('opens on Play and switches screens from the tab bar', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Play' })).toBeInTheDocument();
  const tabs = within(screen.getByRole('navigation', { name: 'Main' }));
  for (const name of ['Plan', 'Collection', 'Guide', 'Stats']) {
    await user.click(tabs.getByRole('button', { name }));
    expect(await screen.findByRole('heading', { level: 1, name })).toBeInTheDocument();
  }
});
```

Run: `npx vitest run src/ui/App.test.tsx`
Expected: FAIL — `Unable to find role="heading" and name "Play"`.

- [ ] **Step 2: Replace `src/ui/App.tsx`**

```tsx
import { useState } from 'react';
import { CollectionScreen } from './screens/CollectionScreen';
import { GuideScreen } from './screens/GuideScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PlayScreen } from './screens/PlayScreen';
import { StatsScreen } from './screens/StatsScreen';
import { useAppData } from './useAppData';

type TabId = 'play' | 'plan' | 'collection' | 'guide' | 'stats';

const TABS: { id: TabId; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'plan', label: 'Plan' },
  { id: 'collection', label: 'Collection' },
  { id: 'guide', label: 'Guide' },
  { id: 'stats', label: 'Stats' },
];

export function App() {
  const store = useAppData();
  const [tab, setTab] = useState<TabId>('play');

  return (
    <div className="app">
      {store.error && (
        <p className="error" role="alert">
          {store.error}{' '}
          <button type="button" onClick={store.dismissError}>
            OK
          </button>
        </p>
      )}
      <main>
        {!store.loaded ? (
          <p>Loading…</p>
        ) : (
          <>
            {tab === 'play' && <PlayScreen store={store} />}
            {tab === 'plan' && <PlanScreen store={store} />}
            {tab === 'collection' && <CollectionScreen store={store} />}
            {tab === 'guide' && <GuideScreen store={store} />}
            {tab === 'stats' && <StatsScreen store={store} />}
          </>
        )}
      </main>
      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/ui/styles.css`**

```css
:root {
  --navy: #1d3557;
  --gold: #ffd166;
  --bg: #ffffff;
  --muted: #6b7280;
  --line: #e5e7eb;
  --ok: #2a9d8f;
  --bad: #e63946;
  font-family: -apple-system, system-ui, sans-serif;
  font-size: 17px;
  color: #111827;
  background: var(--bg);
}
* { box-sizing: border-box; }
body { margin: 0; }
.app { min-height: 100dvh; padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
main { padding: 16px; padding-top: calc(16px + env(safe-area-inset-top)); max-width: 640px; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 12px; }
h2 { font-size: 1.1rem; margin: 20px 0 8px; }
button, input, select, textarea { font: inherit; }
button { min-height: 44px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 10px; background: #f9fafb; }
button.primary { background: var(--navy); color: white; border-color: var(--navy); }
button.link { border: none; background: none; color: var(--navy); padding-left: 0; }
button[aria-pressed='true'] { background: var(--navy); color: white; border-color: var(--navy); }
input, select, textarea { width: 100%; min-height: 44px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; margin-top: 4px; }
label { display: block; margin: 10px 0; font-weight: 600; }
label.check { display: flex; gap: 8px; align-items: center; font-weight: 400; }
label.check input { width: auto; min-height: 0; margin: 0; }
small { color: var(--muted); font-weight: 400; }
.hint { color: var(--muted); }
.notice { background: #fff8e1; border-radius: 10px; padding: 10px 12px; }
.error { background: #fdecea; color: var(--bad); padding: 10px 12px; margin: 0; }
.segmented { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 12px 0; }
.picker { margin: 10px 0; }
.picker-label { display: block; font-weight: 600; }
.picker-results { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.picker-results button { text-align: left; }
.chip { margin-top: 4px; }
.count { font-weight: 600; }
.tag-list { list-style: none; padding: 0; margin: 8px 0; }
.tag-list li { display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--line); padding: 4px 0; }
.tag-list .own { width: 44px; flex: none; color: white; }
.tag-list .own.on { background: var(--ok); border-color: var(--ok); }
.tag-list .tag-row { flex: 1; text-align: left; border: none; background: none; }
.card { border: 1px solid var(--line); border-radius: 14px; padding: 12px; margin: 12px 0; }
.card h3 { margin: 0 0 6px; font-size: 1.05rem; }
.card h4 { margin: 10px 0 4px; }
.reason, .comparison { margin: 6px 0; }
.comparison { font-style: italic; }
.turns { padding-left: 20px; }
.turns li { margin: 6px 0; }
.badge { background: var(--gold); border-radius: 6px; padding: 1px 6px; font-size: 0.8rem; font-weight: 600; }
.trust { border-radius: 6px; padding: 0 5px; font-size: 0.75rem; border: 1px solid currentColor; }
.trust-confirmed { color: var(--ok); }
.trust-player { color: var(--navy); }
.trust-community { color: #b7791f; }
.trust-open { color: var(--bad); }
.reminders { background: #f1f5f9; border-radius: 10px; padding: 10px 10px 10px 28px; }
.stats { width: 100%; border-collapse: collapse; }
.stats th { text-align: left; font-weight: 400; padding: 6px 0; border-bottom: 1px solid var(--line); }
.stats td { text-align: right; padding: 6px 0; border-bottom: 1px solid var(--line); }
.log { list-style: none; padding: 0; }
.log li { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); }
.file-button { display: inline-flex; align-items: center; min-height: 44px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 10px; margin: 0; font-weight: 400; }
.file-button input { display: none; }
details { border-bottom: 1px solid var(--line); padding: 8px 0; }
summary { cursor: pointer; }
.question { margin: 12px 0; }
.saved { color: var(--ok); }
.sources { color: var(--muted); font-size: 0.85rem; word-break: break-word; }
.tabbar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: white; border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
.tabbar button { flex: 1; border: none; border-radius: 0; background: none; min-height: 56px; font-size: 0.85rem; }
.tabbar button[aria-current='page'] { color: var(--navy); font-weight: 700; box-shadow: inset 0 3px 0 var(--navy); }
```

- [ ] **Step 4: Run all tests and the type-check build**

Run: `npm test`
Expected: all test files PASS.

Run: `npm run build`
Expected: no TypeScript errors; `dist/` contains `index.html`, `sw.js`, `manifest.webmanifest`.

- [ ] **Step 5: Look at it in a phone-sized browser**

Run: `npm run dev` (in the background), open `http://localhost:5173` at a 375×812 viewport and check:
- Collection: tick 3 tags (e.g. Ho-Oh, Keldeo, Blaziken); the count goes up.
- Play: enter Lugia / Pidgeot / Koffing; 1 team card appears with a rule-of-thumb plan.
- Collection → Ho-Oh: enter HP, Attack, Defense, Speed; back on Play, plans for teams with full stats become "searched" once every opponent's HP is entered too.
- Log the play, then Stats shows 1 play.
- Tab bar stays at the bottom; buttons are easy to tap.

Stop the dev server after checking.

- [ ] **Step 6: Commit**

```bash
git add src/ui/App.tsx src/ui/App.test.tsx src/ui/styles.css
git commit -m "Add tab bar app shell and phone-first styles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 22: Offline check of the production build

**Files:** none changed (fix any problem found in the file it belongs to).

- [ ] **Step 1: Build and serve the production version**

Run: `npm run build && npm run preview` (in the background)
Expected: preview server on `http://localhost:4173`.

- [ ] **Step 2: Check the service worker and offline use**

In the browser at `http://localhost:4173`:
1. Load the page once; in DevTools → Application, a service worker for the page is "activated".
2. Tick an owned tag in Collection.
3. Switch the browser to offline (DevTools → Network → Offline) and reload.
Expected: the app still loads, and the owned tag is still ticked.

- [ ] **Step 3: Stop the preview server.** No commit unless a fix was needed.

---

### Task 23: Publish to GitHub Pages and install on iPhone

**STOP before Step 2: ask the player.** Publishing puts the app on a public URL and needs their free GitHub account. Ask for: their GitHub username, the repository name they want (default `mezastar-helper`), and a clear "yes, publish". Do not push anything without that yes.

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          BASE_PATH: /${{ github.event.repository.name }}/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Commit:
```bash
git add .github/workflows/deploy.yml
git commit -m "Deploy to GitHub Pages on push to main

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: (After the player says yes) create the repository and push**

```bash
gh repo create <username>/mezastar-helper --public --source . --push
```

Then turn on Pages with GitHub Actions as the source:
```bash
gh api -X POST repos/<username>/mezastar-helper/pages -f build_type=workflow
```

- [ ] **Step 3: Watch the deploy**

Run: `gh run watch --repo <username>/mezastar-helper`
Expected: both jobs succeed. The site is at `https://<username>.github.io/mezastar-helper/`.

- [ ] **Step 4: Install on iPhone (the player does this)**

1. Open `https://<username>.github.io/mezastar-helper/` in Safari.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen, tick a few tags in Collection, close the app fully, turn on Airplane Mode, and open it again.
Expected: the app opens offline and the ticked tags are still there.

---

## Self-review against the spec

| Spec item | Task |
|---|---|
| PWA, offline, GitHub Pages, Add to Home Screen | 1, 22, 23 |
| Data: V3 tag list, type chart, mechanics with trust | 2, 3, 4 |
| Unknown fields stay `null`, shown as "unknown" | 3, 9 (editor), 12 (reason line) |
| Data corrections override shipped values, included in backups | 5, 8, 9, 7 |
| Collection: search, owned/missing, count, edit | 9 |
| Team scoring: coverage, speed, rotation, defense, gimmick; top 15 → 455 combos; top 3 with reason | 12, 13 |
| Searched battle plan, Tiredness, supporters, Boss ends battle, objective, comparison line, fallback | 10, 11 |
| Reminders (ticket, slide preview, Everyone Attack!) and trust per step | 15 |
| Play screen: Boss + 2 cronies, target choice, top 3 teams + plans, quick log | 15, 16, 17 |
| Plan screen: target + optional cronies | 18 |
| Play log with optional turn detail | 16 |
| Stats incl. crony-first comparison, per location, prediction accuracy; backup/restore | 14, 19 |
| Restore validates and changes nothing if invalid; save-failure message | 7, 8, 19, 21 |
| Guide with trust levels and open questions saved as notes | 4, 20 |
| Tests: engine, data validation, storage round-trip, manual iPhone check | 2–14, 6–7, 23 |
