import type { RoomDef } from '../../../contracts/index';
import { parseRoomGrid } from '../parseGrid';

function buildRoom(
  asciiRows: readonly string[],
  meta: Omit<RoomDef, 'widthTiles' | 'heightTiles' | 'tiles'>,
): RoomDef {
  const { widthTiles, heightTiles, tiles } = parseRoomGrid(asciiRows);
  return { ...meta, widthTiles, heightTiles, tiles };
}

// ============================================================================
// GSHIP 01 — Ghost Ship: Endless Deck (30 x 15, mode: 'arena')
// Spacious 3-tier haunted galleon arena with bounce corners, crow's nest beam,
// rigging Volt Nodes, and endless spectral corsair waves!
// ============================================================================
const GSHIP_01 = buildRoom(
  [
    '##############################', // ty=14
    '#............................#', // ty=13
    '#............................#', // ty=12
    '#............................#', // ty=11
    '#............................#', // ty=10
    '#...........------...........#', // ty=9  Tier 3 Crow's Nest
    '#............................#', // ty=8
    '#............................#', // ty=7
    '#............................#', // ty=6
    '#....------........------....#', // ty=5  Tier 2 Shrouds
    '#............................#', // ty=4
    '#............................#', // ty=3
    '#....O..................O....#', // ty=2  Tier 1 Main Deck + Bounce Springs
    '##############################', // ty=1
    '##############################', // ty=0
  ],
  {
    id: 'gship_01',
    name: 'Ghost Ship — Endless Deck',
    biome: 'GSHIP',
    mode: 'arena',
    mapX: 0,
    mapY: -1,
    defaultSpawnX: 14.5,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 2.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'hub_haven',
        targetSpawnX: 50.0,
        targetSpawnY: 2.0,
        label: 'Return to Subrosa Haven',
      },
    ],
    enemies: [
      {
        id: 'gship_01_e1',
        archetype: 'ghost_crow',
        x: 8.5,
        y: 8.5,
        patrolMinX: 5.0,
        patrolMaxX: 13.5,
      },
      {
        id: 'gship_01_e2',
        archetype: 'ghost_owl',
        x: 20.0,
        y: 8.5,
        patrolMinX: 15.5,
        patrolMaxX: 24.0,
      },
      {
        id: 'gship_01_e3',
        archetype: 'ghost_pig',
        x: 19.5,
        y: 2.0,
        patrolMinX: 17.5,
        patrolMaxX: 22.0,
      },
    ],
    coins: [
      { id: 'gship_01_coin_combo', x: 15.0, y: 11.2, kind: 'combo' },
      { id: 'gship_01_coin_1', x: 26.5, y: 6.5, kind: 'world' },
    ],
    crystals: [
      { id: 'gship_01_c1', x: 7.0, y: 7.2, value: 20 },
      { id: 'gship_01_c2', x: 9.0, y: 7.2, value: 20 },
      { id: 'gship_01_c3', x: 14.0, y: 11.2, value: 25 },
      { id: 'gship_01_c4', x: 16.0, y: 11.2, value: 25 },
      { id: 'gship_01_c5', x: 21.0, y: 7.2, value: 20 },
      { id: 'gship_01_c6', x: 23.0, y: 7.2, value: 20 },
    ],
    props: [
      {
        id: 'gship_sign',
        kind: 'signpost',
        x: 7.0,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Ghost Ship Endless Deck — Chain spectral corsairs across 3 tiers of escalating waves!',
      },
      {
        id: 'gship_volt_1',
        kind: 'volt_node',
        x: 10.5,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Port Rigging Lantern',
      },
      {
        id: 'gship_volt_2',
        kind: 'volt_node',
        x: 18.7,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Starboard Rigging Lantern',
      },
    ],
  },
);

export const GSHIP_ROOMS: readonly RoomDef[] = [GSHIP_01] as const;
