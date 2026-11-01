import { COMMUNITY_STATS, COMMUNITY_STATS_SOURCE } from './communityStats';
import type { Grade, Tag } from './types';
import { STARDUST_V3 } from './sets/stardust-v3';
import { STARDUST_V1 } from './sets/stardust-v1';
import { STARDUST_V2 } from './sets/stardust-v2';
import { STARDUST_V4 } from './sets/stardust-v4';
import { GALAXY_V1 } from './sets/galaxy-v1';
import { GALAXY_V2 } from './sets/galaxy-v2';
import { GALAXY_V3 } from './sets/galaxy-v3';

const OFFICIAL_TAGS: Tag[] = [
  ...STARDUST_V3,
  ...STARDUST_V1,
  ...STARDUST_V2,
  ...STARDUST_V4,
  ...GALAXY_V1,
  ...GALAXY_V2,
  ...GALAXY_V3,
];

/**
 * Fill stats, Pokénergy, and any grade or move the official pages left blank from the community stats API.
 * Official data (grade, types, moves) always wins; player corrections still override everything.
 */
export function withCommunityStats(tag: Tag): Tag {
  const row = COMMUNITY_STATS[tag.id];
  if (!row) return tag;
  const [grade, pokenergy, hp, attack, defense, spAttack, spDefense, speed, move] = row;
  const category = move?.[2] ?? undefined;
  // The category belongs to the community's move, so it only carries over when the shipped move is the same one.
  const sameMove = tag.move && move && tag.move.name.toLowerCase() === move[0].toLowerCase();
  return {
    ...tag,
    grade: tag.grade ?? (grade as Grade | null),
    pokenergy: tag.pokenergy ?? pokenergy,
    stats: {
      hp: tag.stats.hp ?? hp,
      attack: tag.stats.attack ?? attack,
      defense: tag.stats.defense ?? defense,
      spAttack: tag.stats.spAttack ?? spAttack,
      spDefense: tag.stats.spDefense ?? spDefense,
      speed: tag.stats.speed ?? speed,
    },
    move: tag.move
      ? sameMove && category && !tag.move.category ? { ...tag.move, category } : tag.move
      : move ? { name: move[0], type: move[1], ...(category && { category }) } : null,
    sources: [...tag.sources, COMMUNITY_STATS_SOURCE],
  };
}

/** Every shipped tag. Stardust V3 comes first (TAGS[0] is Lugia), then the other sets in site order. */
export const TAGS: Tag[] = OFFICIAL_TAGS.map(withCommunityStats);
