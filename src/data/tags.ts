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
