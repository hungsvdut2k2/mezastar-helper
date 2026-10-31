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
