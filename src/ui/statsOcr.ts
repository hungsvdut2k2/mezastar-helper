import { POKEMON_TYPES, type Grade, type MoveCategory, type PokemonType } from '../data/types';

export const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash';
/** Built in from a GitHub secret. Public in the deployed bundle: restrict it to this site's referrer in Google Cloud. */
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
/** Stat photos keep more pixels than display photos, so small printed digits stay readable. */
export const OCR_MAX_SIDE = 1600;

/** What could be read from a tag photo. null = not visible / not sure. */
export type ReadStats = {
  grade: Grade | null;
  pokenergy: number | null;
  hp: number | null;
  attack: number | null;
  defense: number | null;
  spAttack: number | null;
  spDefense: number | null;
  speed: number | null;
  move: { name: string; type: PokemonType; category?: MoveCategory } | null;
};

export type StatsReader = (image: Blob) => Promise<ReadStats>;

/** Shown to the player when the photo cannot be read. */
export class OcrError extends Error {}

const PROMPT = `This is a photo of a Pokémon MEZASTAR arcade tag (Meza Tag).
Read the values printed on it: grade (number of stars, 1-6), Pokénergy, HP, Attack, Defense, Sp. Atk, Sp. Def, Speed, and the move name with its type and whether it is physical or special.
Only report what you can actually read in the photo. Use null for anything not visible or unclear. Never guess.
Types must be one of: ${POKEMON_TYPES.join(', ')}.`;

const nullableInt = { type: 'integer', nullable: true };
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    grade: nullableInt,
    pokenergy: nullableInt,
    hp: nullableInt,
    attack: nullableInt,
    defense: nullableInt,
    spAttack: nullableInt,
    spDefense: nullableInt,
    speed: nullableInt,
    moveName: { type: 'string', nullable: true },
    moveType: { type: 'string', nullable: true, enum: [...POKEMON_TYPES] },
    moveCategory: { type: 'string', nullable: true, enum: ['physical', 'special'] },
  },
  required: ['grade', 'pokenergy', 'hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed', 'moveName', 'moveType', 'moveCategory'],
};

const wholeOrNull = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null;

/** Turn the model's JSON text into checked values; anything odd becomes null. */
export function parseStatsReply(text: string): ReadStats {
  let raw: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
    raw = parsed as Record<string, unknown>;
  } catch {
    throw new OcrError('Could not understand the reply. Try again or type the numbers in.');
  }
  const grade = wholeOrNull(raw.grade, 6);
  const moveType = POKEMON_TYPES.find((t) => t === String(raw.moveType ?? '').toLowerCase()) ?? null;
  const moveName = typeof raw.moveName === 'string' ? raw.moveName.trim().slice(0, 60) : '';
  const category = (['physical', 'special'] as const).find((c) => c === String(raw.moveCategory ?? '').toLowerCase());
  return {
    grade: grade !== null && grade >= 1 ? (grade as Grade) : null,
    pokenergy: wholeOrNull(raw.pokenergy, 9999),
    hp: wholeOrNull(raw.hp, 9999),
    attack: wholeOrNull(raw.attack, 9999),
    defense: wholeOrNull(raw.defense, 9999),
    spAttack: wholeOrNull(raw.spAttack, 9999),
    spDefense: wholeOrNull(raw.spDefense, 9999),
    speed: wholeOrNull(raw.speed, 9999),
    move: moveName && moveType ? { name: moveName, type: moveType, ...(category && { category }) } : null,
  };
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Reads a tag photo with Gemini. Returns null when no key was built in. */
export function geminiReader(apiKey = GEMINI_API_KEY, model = GEMINI_MODEL, fetcher: typeof fetch = fetch): StatsReader | null {
  if (!apiKey) return null;
  return async (image) => {
    const body = {
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: image.type || 'image/jpeg', data: await toBase64(image) } }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0 },
    };
    let res: Response;
    try {
      res = await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body),
      });
    } catch {
      throw new OcrError('No connection. Reading a photo needs the internet.');
    }
    if (!res.ok) {
      throw new OcrError(
        res.status === 429 ? 'Too many requests right now. Wait a minute and try again.' : `The photo reader failed (error ${res.status}). Try again later.`,
      );
    }
    const json = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    return parseStatsReply(text);
  };
}
