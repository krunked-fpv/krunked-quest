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
// MLAIR 01 — Awakening Chamber (36 x 13)
// Teaches movement, double-jump, bounce pads, wall-jump shaft, breakable blocks,
// and basic stomp combat.
// ============================================================================
const MLAIR_01 = buildRoom(
  [
    '####################################', // ty=12
    '#..................................#', // ty=11
    '#..................#...............#', // ty=10
    '#..................#...............#', // ty=9
    '#..........---.....#...............#', // ty=8
    '#..................#...............#', // ty=7
    '#..................#....##BB##.....#', // ty=6
    '#.............---..#....#....#.....#', // ty=5
    '#.......................#...........', // ty=4  tx=35 OPEN
    '#........####...........#.....--....', // ty=3  tx=35 OPEN
    '#........####..O........#...........', // ty=2  tx=35 OPEN
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'mlair_01',
    name: 'Tutorial Lair — Awakening Chamber',
    biome: 'MLAIR',
    mode: 'normal',
    mapX: -3,
    mapY: 0,
    defaultSpawnX: 3.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 35,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'mlair_02',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Stomp Cavern',
      },
    ],
    enemies: [
      {
        id: 'mlair_01_e1',
        archetype: 'goomba',
        x: 10.0,
        y: 4.0,
        patrolMinX: 9.0,
        patrolMaxX: 12.1,
      },
      {
        id: 'mlair_01_e2',
        archetype: 'goomba',
        x: 31.5,
        y: 2.0,
        patrolMinX: 29.5,
        patrolMaxX: 34.0,
      },
    ],
    coins: [
      { id: 'mlair_01_coin_1', x: 12.5, y: 9.5, kind: 'world' },
      { id: 'mlair_01_coin_2', x: 27.0, y: 3.2, kind: 'world' },
      { id: 'mlair_01_coin_3', x: 31.0, y: 5.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'mlair_01_c1', x: 7.5, y: 2.6, value: 10 },
      { id: 'mlair_01_c2', x: 9.5, y: 5.5, value: 10 },
      { id: 'mlair_01_c3', x: 11.5, y: 5.5, value: 10 },
      { id: 'mlair_01_c4', x: 15.5, y: 6.5, value: 15 },
      { id: 'mlair_01_c5', x: 21.5, y: 5.0, value: 15 },
      { id: 'mlair_01_c6', x: 22.5, y: 7.5, value: 15 },
      { id: 'mlair_01_c7', x: 26.5, y: 7.5, value: 15 },
      { id: 'mlair_01_c8', x: 26.0, y: 2.8, value: 20 },
      { id: 'mlair_01_c9', x: 28.0, y: 2.8, value: 20 },
      { id: 'mlair_01_c10', x: 33.0, y: 2.6, value: 15 },
    ],
    props: [
      {
        id: 'mlair_01_sign_1',
        kind: 'signpost',
        x: 5.5,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Codex Note: Jump, Double-Jump, and Air Stomp foes to launch high combo chains!',
      },
      {
        id: 'mlair_01_sign_2',
        kind: 'signpost',
        x: 20.5,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Codex Note: Wall-Jump up the stone shaft, then Air Stomp through the cracked blocks ahead!',
      },
    ],
  },
);

// ============================================================================
// MLAIR 02 — Stomp Cavern (38 x 14)
// Teaches Ground Dash, aerial stomp chains across Bramble Stompers & Winged
// Brambles, and uncovering secret walls with hidden chests.
// ============================================================================
const MLAIR_02 = buildRoom(
  [
    '######################################', // ty=13
    '#....................................#', // ty=12
    '#....................................#', // ty=11
    '#........######......................#', // ty=10
    '#........#....?..........-----.......#', // ty=9
    '#........#....?......................#', // ty=8
    '#........######......................#', // ty=7
    '#....................---.............#', // ty=6
    '#.....----...........................#', // ty=5
    '......................................', // ty=4  tx=0,37 OPEN
    '..............####.......####.........', // ty=3  tx=0,37 OPEN
    '............O.####..^^...####..O......', // ty=2  tx=0,37 OPEN
    '######################################', // ty=1
    '######################################', // ty=0
  ],
  {
    id: 'mlair_02',
    name: 'Tutorial Lair — Stomp Cavern',
    biome: 'MLAIR',
    mode: 'normal',
    mapX: -2,
    mapY: 0,
    defaultSpawnX: 2.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'mlair_01',
        targetSpawnX: 33.0,
        targetSpawnY: 2.0,
        label: 'Awakening Chamber',
      },
      {
        dir: 'right',
        x: 37,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'mlair_03',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Chimney Ascent',
      },
    ],
    enemies: [
      {
        id: 'mlair_02_e1',
        archetype: 'goomba',
        x: 7.5,
        y: 2.0,
        patrolMinX: 5.5,
        patrolMaxX: 10.5,
      },
      {
        id: 'mlair_02_e2',
        archetype: 'air_goomba',
        x: 19.5,
        y: 7.2,
        patrolMinX: 16.5,
        patrolMaxX: 23.0,
      },
      {
        id: 'mlair_02_e3',
        archetype: 'goomba',
        x: 26.5,
        y: 4.0,
        patrolMinX: 25.0,
        patrolMaxX: 28.1,
      },
      {
        id: 'mlair_02_e4',
        archetype: 'air_goomba',
        x: 32.0,
        y: 6.5,
        patrolMinX: 30.0,
        patrolMaxX: 35.0,
      },
    ],
    coins: [
      { id: 'mlair_02_coin_chest', x: 11.5, y: 8.6, kind: 'chest' },
      { id: 'mlair_02_coin_1', x: 27.5, y: 11.0, kind: 'world' },
      { id: 'mlair_02_coin_combo', x: 34.5, y: 3.4, kind: 'combo' },
    ],
    crystals: [
      { id: 'mlair_02_c1', x: 6.5, y: 6.4, value: 15 },
      { id: 'mlair_02_c2', x: 8.5, y: 6.4, value: 15 },
      { id: 'mlair_02_c3', x: 15.5, y: 5.2, value: 15 },
      { id: 'mlair_02_c4', x: 17.5, y: 5.2, value: 15 },
      { id: 'mlair_02_c5', x: 21.5, y: 7.5, value: 15 },
      { id: 'mlair_02_c6', x: 26.5, y: 10.4, value: 20 },
      { id: 'mlair_02_c7', x: 28.5, y: 10.4, value: 20 },
      { id: 'mlair_02_c8', x: 33.5, y: 2.8, value: 15 },
    ],
    props: [
      {
        id: 'mlair_02_sign_1',
        kind: 'signpost',
        x: 4.0,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Codex Note: Ground Dash launches you forward! Look for cracked secret walls hiding treasure chests.',
      },
      {
        id: 'mlair_02_chest',
        kind: 'chest',
        x: 11.0,
        y: 8.0,
        width: 1.0,
        height: 0.85,
        coinId: 'mlair_02_coin_chest',
        label: 'Cavern Nook Cache',
      },
    ],
  },
);

// ============================================================================
// MLAIR 03 — Chimney Ascent (36 x 16)
// Final tutorial test: wall-jump & bounce climb, armored Horned Beetle taught
// via Air Stomp, Save Shrine, and grand threshold into Subrosa Haven.
// ============================================================================
const MLAIR_03 = buildRoom(
  [
    '####################################', // ty=15
    '#..................................#', // ty=14
    '#..................................#', // ty=13
    '#............----------............#', // ty=12
    '#.......#..................#.......#', // ty=11
    '#.......#..................#.......#', // ty=10
    '#.......#....---....---....#.......#', // ty=9
    '#.......#..................#.......#', // ty=8
    '#.......#.......####.......#.......#', // ty=7
    '#..---..#.......####.......#..---..#', // ty=6
    '#.......#..................#.......#', // ty=5
    '....................................', // ty=4  tx=0,35 OPEN
    '............O..........O............', // ty=3  tx=0,35 OPEN
    '............#..........#............', // ty=2  tx=0,35 OPEN
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'mlair_03',
    name: 'Tutorial Lair — Chimney Ascent',
    biome: 'MLAIR',
    mode: 'normal',
    mapX: -1,
    mapY: 0,
    defaultSpawnX: 2.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'mlair_02',
        targetSpawnX: 35.0,
        targetSpawnY: 2.0,
        label: 'Stomp Cavern',
      },
      {
        dir: 'right',
        x: 35,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'hub_haven',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'To Subrosa Haven',
      },
    ],
    enemies: [
      {
        id: 'mlair_03_e1',
        archetype: 'horned_beetle',
        x: 17.5,
        y: 2.0,
        patrolMinX: 14.0,
        patrolMaxX: 21.5,
      },
      {
        id: 'mlair_03_e2',
        archetype: 'air_goomba',
        x: 14.5,
        y: 11.2,
        patrolMinX: 10.5,
        patrolMaxX: 18.0,
      },
      {
        id: 'mlair_03_e3',
        archetype: 'goomba',
        x: 17.5,
        y: 8.0,
        patrolMinX: 16.2,
        patrolMaxX: 19.0,
      },
      {
        id: 'mlair_03_e4',
        archetype: 'air_goomba',
        x: 21.5,
        y: 11.2,
        patrolMinX: 18.0,
        patrolMaxX: 25.0,
      },
    ],
    coins: [
      { id: 'mlair_03_coin_1', x: 18.0, y: 13.8, kind: 'world' },
      { id: 'mlair_03_coin_2', x: 4.0, y: 8.0, kind: 'world' },
      { id: 'mlair_03_coin_combo', x: 31.5, y: 8.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'mlair_03_c1', x: 5.5, y: 3.0, value: 15 },
      { id: 'mlair_03_c2', x: 10.5, y: 6.5, value: 15 },
      { id: 'mlair_03_c3', x: 14.5, y: 10.5, value: 15 },
      { id: 'mlair_03_c4', x: 18.0, y: 10.5, value: 20 },
      { id: 'mlair_03_c5', x: 21.5, y: 10.5, value: 15 },
      { id: 'mlair_03_c6', x: 25.5, y: 6.5, value: 15 },
      { id: 'mlair_03_c7', x: 31.0, y: 3.0, value: 15 },
    ],
    props: [
      {
        id: 'mlair_03_sign',
        kind: 'signpost',
        x: 5.0,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Codex Note: Armored beetles deflect gentle hops — slam them with an Air Stomp! Subrosa Haven lies east.',
      },
      {
        id: 'mlair_03_save',
        kind: 'save_shrine',
        x: 29.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Lair Threshold Shrine',
      },
    ],
  },
);

export const MLAIR_ROOMS: readonly RoomDef[] = [MLAIR_01, MLAIR_02, MLAIR_03] as const;
