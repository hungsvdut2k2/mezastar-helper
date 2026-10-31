import type { Tag } from './types';
import { STARDUST_V3 } from './sets/stardust-v3';
import { STARDUST_V1 } from './sets/stardust-v1';
import { STARDUST_V2 } from './sets/stardust-v2';
import { STARDUST_V4 } from './sets/stardust-v4';
import { GALAXY_V1 } from './sets/galaxy-v1';
import { GALAXY_V2 } from './sets/galaxy-v2';
import { GALAXY_V3 } from './sets/galaxy-v3';

/** Every shipped tag. Stardust V3 comes first (TAGS[0] is Lugia), then the other sets in site order. */
export const TAGS: Tag[] = [
  ...STARDUST_V3,
  ...STARDUST_V1,
  ...STARDUST_V2,
  ...STARDUST_V4,
  ...GALAXY_V1,
  ...GALAXY_V2,
  ...GALAXY_V3,
];
