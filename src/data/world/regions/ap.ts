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
// AP 01 — Bark Stairway (40 x 16)
// Rising wind updrafts (W) weaving through great tree boughs.
// ============================================================================
const AP_01 = buildRoom(
  [
    '########################################', // ty=15
    '#......................................#', // ty=14
    '#......................................#', // ty=13
    '#............WW..........WW............#', // ty=12
    '#.....----...WW..------..WW...----.....#', // ty=11
    '#............WW..........WW............#', // ty=10
    '#............WW..........WW............#', // ty=9
    '#............WW...----...WW............#', // ty=8
    '#............WW..........WW............#', // ty=7
    '#......----..WW..........WW..----......#', // ty=6
    '#............WW..........WW............#', // ty=5
    '.............WW..........WW.............', // ty=4  tx=0,39 OPEN
    '.............WW..........WW.............', // ty=3  tx=0,39 OPEN
    '...........O.WW..........WW.O...........', // ty=2  tx=0,39 OPEN
    '########################################', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'ap_01',
    name: 'Primal Tree — Bark Stairway',
    biome: 'AP',
    mode: 'normal',
    mapX: 6,
    mapY: 2,
    defaultSpawnX: 37.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 39,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'flin_07',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Rootway Gate',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_02',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Gusting Boughs',
      },
    ],
    enemies: [
      { id: 'ap_01_e1', archetype: 'horned_beetle', x: 20.0, y: 2.0, patrolMinX: 16.0, patrolMaxX: 24.5 },
      { id: 'ap_01_e2', archetype: 'ladybug', x: 20.0, y: 9.0, patrolMinX: 18.2, patrolMaxX: 21.2 },
      { id: 'ap_01_e3', archetype: 'bee', x: 10.0, y: 9.5, patrolMinX: 6.5, patrolMaxX: 14.0 },
      { id: 'ap_01_e4', archetype: 'bee', x: 30.0, y: 9.5, patrolMinX: 26.0, patrolMaxX: 33.5 },
    ],
    coins: [
      { id: 'ap_01_coin_1', x: 20.0, y: 12.8, kind: 'world' },
      { id: 'ap_01_coin_2', x: 8.0, y: 12.5, kind: 'world' },
      { id: 'ap_01_coin_combo', x: 32.0, y: 12.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'ap_01_c1', x: 13.5, y: 7.5, value: 15 },
      { id: 'ap_01_c2', x: 13.5, y: 10.5, value: 15 },
      { id: 'ap_01_c3', x: 25.5, y: 7.5, value: 15 },
      { id: 'ap_01_c4', x: 25.5, y: 10.5, value: 15 },
    ],
    props: [],
  },
);

// ============================================================================
// AP 02 — Gusting Boughs (40 x 16)
// Twin wind vents rising to the upper canopy doorway (ap_03) plus secret wall
// on the west leading to Hollow Amber Nest (ap_06)!
// ============================================================================
const AP_02 = buildRoom(
  [
    '########################################', // ty=15
    '#......................................#', // ty=14
    '#......................................#', // ty=13
    '#...............----------.............#', // ty=12
    '#..........WW................WW........#', // ty=11
    '#..........WW................WW........#', // ty=10
    '#....----..WW.....------.....WW..----..#', // ty=9
    '#..........WW................WW........#', // ty=8
    '#..........WW................WW........#', // ty=7
    '#..........WW................WW........#', // ty=6
    '#..........WW................WW........#', // ty=5
    '...?.......WW................WW.........', // ty=4  tx=0,39 OPEN; tx=3 secret wall
    '...?.......WW................WW.........', // ty=3  tx=0,39 OPEN
    '...?....O..WW................WW..O......', // ty=2  tx=0,39 OPEN
    '########################################', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'ap_02',
    name: 'Primal Tree — Gusting Boughs',
    biome: 'AP',
    mode: 'normal',
    mapX: 5,
    mapY: 2,
    defaultSpawnX: 37.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 39,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Bark Stairway',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_06',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Hollow Amber Nest',
      },
      {
        dir: 'door',
        x: 20.0,
        y: 13.0,
        width: 1.5,
        height: 2.0,
        targetRoomId: 'ap_03',
        targetSpawnX: 4.0,
        targetSpawnY: 2.0,
        label: 'Emerald Updrafts',
      },
    ],
    enemies: [
      { id: 'ap_02_e1', archetype: 'ladybug', x: 20.0, y: 2.0, patrolMinX: 14.0, patrolMaxX: 26.5 },
      { id: 'ap_02_e2', archetype: 'mushroom_warrior', x: 20.5, y: 10.0, patrolMinX: 18.2, patrolMaxX: 23.0 },
      { id: 'ap_02_e3', archetype: 'guilhofly', x: 15.0, y: 7.5, patrolMinX: 12.0, patrolMaxX: 25.0 },
      { id: 'ap_02_e4', archetype: 'guilhofly', x: 27.0, y: 12.0, patrolMinX: 24.0, patrolMaxX: 33.0 },
    ],
    coins: [
      { id: 'ap_02_coin_1', x: 7.0, y: 10.6, kind: 'world' },
      { id: 'ap_02_coin_2', x: 35.0, y: 10.6, kind: 'world' },
      { id: 'ap_02_coin_combo', x: 20.5, y: 7.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'ap_02_c1', x: 11.5, y: 6.5, value: 15 },
      { id: 'ap_02_c2', x: 11.5, y: 9.5, value: 15 },
      { id: 'ap_02_c3', x: 29.5, y: 6.5, value: 15 },
      { id: 'ap_02_c4', x: 29.5, y: 9.5, value: 15 },
    ],
    props: [],
  },
);

// ============================================================================
// AP 03 — Emerald Updrafts (38 x 16, hasTeleporter: true)
// Wide wind-chasm crossing above thorn beds with Emerald Waystone Teleporter.
// ============================================================================
const AP_03 = buildRoom(
  [
    '######################################', // ty=15
    '#....................................#', // ty=14
    '#....................................#', // ty=13
    '#.........WW......WW......WW.........#', // ty=12
    '#.........WW.----.WW.----.WW.........#', // ty=11
    '#.........WW......WW......WW.........#', // ty=10
    '#.........WW......WW......WW.........#', // ty=9
    '#.........WW......WW......WW.........#', // ty=8
    '#.....----WW......WW......WW----.....#', // ty=7
    '#.........WW......WW......WW.........#', // ty=6
    '#.........WW......WW......WW.........#', // ty=5
    '#.........WW......WW......WW..........', // ty=4  tx=37 OPEN
    '#.........WW......WW......WW..........', // ty=3  tx=37 OPEN
    '#.........WW.^^^^.WW.^^^^.WW..........', // ty=2  tx=37 OPEN
    '######################################', // ty=1
    '######################################', // ty=0
  ],
  {
    id: 'ap_03',
    name: 'Primal Tree — Emerald Updrafts',
    biome: 'AP',
    mode: 'normal',
    mapX: 5,
    mapY: 3,
    defaultSpawnX: 4.0,
    defaultSpawnY: 2.0,
    hasTeleporter: true,
    exits: [
      {
        dir: 'door',
        x: 3.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'ap_02',
        targetSpawnX: 20.0,
        targetSpawnY: 13.0,
        label: 'Gusting Boughs',
      },
      {
        dir: 'right',
        x: 37,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_04',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Canopy Arena',
      },
    ],
    enemies: [
      { id: 'ap_03_e1', archetype: 'bee', x: 15.0, y: 9.0, patrolMinX: 11.5, patrolMaxX: 19.0 },
      { id: 'ap_03_e2', archetype: 'neural_spider', x: 23.0, y: 9.0, patrolMinX: 19.5, patrolMaxX: 26.5 },
      { id: 'ap_03_e3', archetype: 'mini_jelly', x: 19.0, y: 12.8, patrolMinX: 14.0, patrolMaxX: 24.0 },
    ],
    coins: [
      { id: 'ap_03_coin_1', x: 15.0, y: 12.8, kind: 'world' },
      { id: 'ap_03_coin_2', x: 23.0, y: 12.8, kind: 'world' },
      { id: 'ap_03_coin_combo', x: 31.0, y: 9.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'ap_03_c1', x: 10.5, y: 6.5, value: 15 },
      { id: 'ap_03_c2', x: 18.5, y: 6.5, value: 15 },
      { id: 'ap_03_c3', x: 26.5, y: 6.5, value: 15 },
      { id: 'ap_03_c4', x: 19.0, y: 13.5, value: 20 },
    ],
    props: [
      {
        id: 'ap_03_teleporter',
        kind: 'teleporter',
        x: 7.0,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Emerald Waystone',
      },
    ],
  },
);

// ============================================================================
// AP 04 — Canopy Arena (28 x 14, mode: 'arena')
// Wind-assisted aerial arena with twin updrafts and elevated treasure chest.
// ============================================================================
const AP_04 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#....WW..............WW....#', // ty=9
    '#....WW..............WW....#', // ty=8
    '#....WW..............WW....#', // ty=7
    '#....WW...--------...WW....#', // ty=6
    '#....WW..............WW....#', // ty=5
    '.....WW..............WW.....', // ty=4  tx=0,27 OPEN
    '.....WW..............WW.....', // ty=3  tx=0,27 OPEN
    '.....WW..............WW.....', // ty=2  tx=0,27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'ap_04',
    name: 'Primal Tree — Canopy Arena',
    biome: 'AP',
    mode: 'arena',
    mapX: 6,
    mapY: 3,
    defaultSpawnX: 2.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_03',
        targetSpawnX: 35.0,
        targetSpawnY: 2.0,
        label: 'Emerald Updrafts',
      },
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_05',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Gale Spire',
      },
    ],
    enemies: [
      { id: 'ap_04_e1', archetype: 'mushroom_warrior', x: 13.5, y: 2.0, patrolMinX: 9.0, patrolMaxX: 18.5 },
      { id: 'ap_04_e2', archetype: 'carnivorous_plant', x: 11.5, y: 7.0, patrolMinX: 10.2, patrolMaxX: 13.5 },
      { id: 'ap_04_e3', archetype: 'ladybug', x: 16.0, y: 7.0, patrolMinX: 14.0, patrolMaxX: 17.2 },
      { id: 'ap_04_e4', archetype: 'bee', x: 10.0, y: 9.5, patrolMinX: 6.5, patrolMaxX: 14.0 },
      { id: 'ap_04_e5', archetype: 'bee', x: 18.0, y: 9.5, patrolMinX: 14.0, patrolMaxX: 21.5 },
    ],
    coins: [
      { id: 'ap_04_coin_1', x: 6.0, y: 11.2, kind: 'world' },
      { id: 'ap_04_coin_2', x: 22.0, y: 11.2, kind: 'world' },
      { id: 'ap_04_coin_chest', x: 14.0, y: 11.6, kind: 'chest' },
      { id: 'ap_04_coin_combo', x: 14.0, y: 4.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'ap_04_c1', x: 6.0, y: 6.5, value: 15 },
      { id: 'ap_04_c2', x: 22.0, y: 6.5, value: 15 },
      { id: 'ap_04_c3', x: 12.0, y: 8.5, value: 20 },
      { id: 'ap_04_c4', x: 16.0, y: 8.5, value: 20 },
    ],
    props: [
      {
        id: 'ap_04_chest',
        kind: 'chest',
        x: 13.5,
        y: 11.0,
        width: 1.0,
        height: 0.85,
        coinId: 'ap_04_coin_chest',
        label: 'Canopy Arena Spoils',
      },
    ],
  },
);

// ============================================================================
// AP 05 — Gale Spire (42 x 16)
// High-altitude wind updrafts & vine walls patrolled by Talon Batteries!
// ============================================================================
const AP_05 = buildRoom(
  [
    '##########################################', // ty=15
    '#........................................#', // ty=14
    '#........................................#', // ty=13
    '#...........WW..............WW...........#', // ty=12
    '#....----...WW...--------...WW...----....#', // ty=11
    '#...........WW..............WW...........#', // ty=10
    '#...........WW....#V..V#....WW...........#', // ty=9
    '#...........WW....#V..V#....WW...........#', // ty=8
    '#...........WW....#V..V#....WW...........#', // ty=7
    '#......----.WW....#V..V#....WW.----......#', // ty=6
    '#...........WW..............WW...........#', // ty=5
    '............WW..............WW............', // ty=4  tx=0,41 OPEN
    '............WW..............WW............', // ty=3  tx=0,41 OPEN
    '.........O..WW....^^^^^^....WW..O.........', // ty=2  tx=0,41 OPEN
    '##########################################', // ty=1
    '##########################################', // ty=0
  ],
  {
    id: 'ap_05',
    name: 'Primal Tree — Gale Spire',
    biome: 'AP',
    mode: 'normal',
    mapX: 7,
    mapY: 3,
    defaultSpawnX: 2.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_04',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Canopy Arena',
      },
      {
        dir: 'right',
        x: 41,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_07',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Leaf Shrine Terrace',
      },
    ],
    enemies: [
      { id: 'ap_05_e1', archetype: 'eagle_cannon', x: 20.5, y: 13.0, patrolMinX: 15.0, patrolMaxX: 26.5 },
      { id: 'ap_05_e2', archetype: 'carnivorous_plant', x: 20.5, y: 12.0, patrolMinX: 17.5, patrolMaxX: 24.0 },
      { id: 'ap_05_e3', archetype: 'ladybug', x: 8.5, y: 7.0, patrolMinX: 7.2, patrolMaxX: 10.2 },
      { id: 'ap_05_e4', archetype: 'neural_spider', x: 33.0, y: 8.5, patrolMinX: 30.0, patrolMaxX: 37.5 },
    ],
    coins: [
      { id: 'ap_05_coin_1', x: 7.0, y: 12.6, kind: 'world' },
      { id: 'ap_05_coin_2', x: 35.0, y: 12.6, kind: 'world' },
      { id: 'ap_05_coin_combo', x: 21.0, y: 13.8, kind: 'combo' },
    ],
    crystals: [
      { id: 'ap_05_c1', x: 12.5, y: 8.0, value: 15 },
      { id: 'ap_05_c2', x: 28.5, y: 8.0, value: 15 },
      { id: 'ap_05_c3', x: 19.5, y: 13.4, value: 20 },
      { id: 'ap_05_c4', x: 22.5, y: 13.4, value: 20 },
    ],
    props: [],
  },
);

// ============================================================================
// AP 06 — Hollow Amber Nest (28 x 14, isSecret: true)
// Secret tree-heart grotto behind Gusting Boughs' western cracked wall!
// ============================================================================
const AP_06 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#...........----...........#', // ty=10
    '#.......WW........WW.......#', // ty=9
    '#.......WW........WW.......#', // ty=8
    '#...----WW........WW----...#', // ty=7
    '#.......WW........WW.......#', // ty=6
    '#.......WW........WW.......#', // ty=5
    '#.......WW........WW........', // ty=4  tx=27 OPEN
    '#.......WW........WW........', // ty=3  tx=27 OPEN
    '#.......WW........WW........', // ty=2  tx=27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'ap_06',
    name: 'Primal Tree — Hollow Amber Nest',
    biome: 'AP',
    mode: 'normal',
    isSecret: true,
    mapX: 4,
    mapY: 2,
    defaultSpawnX: 25.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_02',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Gusting Boughs',
      },
    ],
    enemies: [
      { id: 'ap_06_e1', archetype: 'big_jelly', x: 13.5, y: 6.5, patrolMinX: 10.5, patrolMaxX: 16.5 },
      { id: 'ap_06_e2', archetype: 'mini_jelly', x: 13.5, y: 11.5, patrolMinX: 10.0, patrolMaxX: 17.0 },
      { id: 'ap_06_e3', archetype: 'neural_spider', x: 6.0, y: 9.5, patrolMinX: 4.0, patrolMaxX: 10.0 },
    ],
    coins: [
      { id: 'ap_06_coin_1', x: 6.0, y: 8.6, kind: 'world' },
      { id: 'ap_06_coin_2', x: 14.0, y: 11.6, kind: 'world' },
      { id: 'ap_06_coin_chest', x: 3.5, y: 2.6, kind: 'chest' },
      { id: 'ap_06_coin_combo', x: 22.0, y: 8.6, kind: 'combo' },
    ],
    crystals: [
      { id: 'ap_06_c1', x: 8.5, y: 6.5, value: 25 },
      { id: 'ap_06_c2', x: 18.5, y: 6.5, value: 25 },
      { id: 'ap_06_c3', x: 14.0, y: 4.5, value: 25 },
    ],
    props: [
      {
        id: 'ap_06_chest',
        kind: 'chest',
        x: 3.0,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'ap_06_coin_chest',
        label: 'Amber Heart Cache',
      },
    ],
  },
);

// ============================================================================
// AP 07 — Leaf Shrine Terrace (36 x 15, hasTeleporter: true)
// Houses the Leaf Form Totem (krunk_leaf), Save Shrine, Teleporter, and wind
// updraft glide gallery right before the Canopy Sanctum boss!
// ============================================================================
const AP_07 = buildRoom(
  [
    '####################################', // ty=14
    '#..................................#', // ty=13
    '#..................................#', // ty=12
    '#..............------..............#', // ty=11
    '#.........WW............WW.........#', // ty=10
    '#.........WW............WW.........#', // ty=9
    '#.........WW............WW.........#', // ty=8
    '#...----..WW...------...WW..----...#', // ty=7
    '#.........WW............WW.........#', // ty=6
    '#.........WW............WW.........#', // ty=5
    '..........WW............WW..........', // ty=4  tx=0,35 OPEN
    '..........WW............WW..........', // ty=3  tx=0,35 OPEN
    '..........WW............WW..........', // ty=2  tx=0,35 OPEN
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'ap_07',
    name: 'Primal Tree — Leaf Shrine Terrace',
    biome: 'AP',
    mode: 'normal',
    mapX: 8,
    mapY: 3,
    defaultSpawnX: 2.0,
    defaultSpawnY: 2.0,
    hasTeleporter: true,
    exits: [
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_05',
        targetSpawnX: 39.0,
        targetSpawnY: 2.0,
        label: 'Gale Spire',
      },
      {
        dir: 'right',
        x: 35,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_boss',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Canopy Sanctum',
      },
    ],
    enemies: [
      { id: 'ap_07_e1', archetype: 'mushroom_warrior', x: 17.5, y: 2.0, patrolMinX: 13.5, patrolMaxX: 22.0 },
      { id: 'ap_07_e2', archetype: 'eagle_cannon', x: 17.5, y: 9.8, patrolMinX: 13.5, patrolMaxX: 22.5 },
      { id: 'ap_07_e3', archetype: 'spike_turtle', x: 6.0, y: 8.0, patrolMinX: 4.2, patrolMaxX: 7.2 },
    ],
    coins: [
      { id: 'ap_07_coin_1', x: 18.0, y: 12.8, kind: 'world' },
      { id: 'ap_07_coin_2', x: 6.0, y: 10.0, kind: 'world' },
      { id: 'ap_07_coin_combo', x: 30.0, y: 10.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'ap_07_c1', x: 11.0, y: 7.5, value: 15 },
      { id: 'ap_07_c2', x: 24.5, y: 7.5, value: 15 },
      { id: 'ap_07_c3', x: 18.0, y: 9.5, value: 20 },
    ],
    props: [
      {
        id: 'ap_07_leaf_totem',
        kind: 'form_totem',
        formId: 'krunk_leaf',
        x: 17.5,
        y: 8.0,
        width: 1.0,
        height: 1.5,
        label: 'Leaf Form Shrine',
      },
      {
        id: 'ap_07_teleporter',
        kind: 'teleporter',
        x: 5.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Canopy Waystone',
      },
      {
        id: 'ap_07_save',
        kind: 'save_shrine',
        x: 30.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Sanctum Threshold Shrine',
      },
    ],
  },
);

// ============================================================================
// AP BOSS — Canopy Sanctum (28 x 14, mode: 'boss', bossId: 'primal_eye')
// Boss 1 (20 HP -> unlocks krunk_leaf!) with wind updraft flanks & bounce pads,
// leading eastward onto Volcanic Altar's Cinder Bridge (atvc_01)!
// ============================================================================
const AP_BOSS = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........................#', // ty=10
    '#...........----...........#', // ty=9
    '#...WW................WW...#', // ty=8
    '#...WW................WW...#', // ty=7
    '#...WW................WW...#', // ty=6
    '#...WW.----......----.WW...#', // ty=5
    '....WW................WW....', // ty=4  tx=0,27 OPEN
    '....WW................WW....', // ty=3  tx=0,27 OPEN
    '.....O................O.....', // ty=2  tx=0,27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'ap_boss',
    name: 'Primal Tree — Canopy Sanctum',
    biome: 'AP',
    mode: 'boss',
    bossId: 'primal_eye',
    mapX: 9,
    mapY: 3,
    defaultSpawnX: 2.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_07',
        targetSpawnX: 33.0,
        targetSpawnY: 2.0,
        label: 'Leaf Shrine Terrace',
      },
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'atvc_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Volcanic Altar',
      },
    ],
    enemies: [],
    coins: [
      { id: 'boss_primal_eye', x: 14.0, y: 10.6, kind: 'boss' },
      { id: 'ap_boss_coin_2', x: 14.0, y: 6.5, kind: 'world' },
    ],
    crystals: [
      { id: 'ap_boss_c1', x: 8.5, y: 6.8, value: 20 },
      { id: 'ap_boss_c2', x: 19.5, y: 6.8, value: 20 },
      { id: 'ap_boss_c3', x: 14.0, y: 10.8, value: 25 },
    ],
    props: [],
  },
);

export const AP_ROOMS: readonly RoomDef[] = [
  AP_01,
  AP_02,
  AP_03,
  AP_04,
  AP_05,
  AP_06,
  AP_07,
  AP_BOSS,
] as const;
