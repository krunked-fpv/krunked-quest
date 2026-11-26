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
// DSI 01 — Sunscorch Dunes (44 x 14, sandstormDir: -1)
// Westward sandstorm winds (<), crumbling sandstone bridges (C), quicksand (Q).
// ============================================================================
const DSI_01 = buildRoom(
  [
    '############################################', // ty=13
    '#..........................................#', // ty=12
    '#..........................................#', // ty=11
    '#...........<<<<<<........<<<<<<...........#', // ty=10
    '#..........................................#', // ty=9
    '#......----.......CCCCCCC.......----.......#', // ty=8
    '#..........................................#', // ty=7
    '#..........................................#', // ty=6
    '#............CCCC.........CCCC.............#', // ty=5
    '............................................', // ty=4  tx=0,43 OPEN
    '............................................', // ty=3  tx=0,43 OPEN
    '.......O............................O.......', // ty=2  tx=0,43 OPEN
    '##########QQQQQQQ######QQQQQQQ##############', // ty=1  quicksand beds over solid ty=0
    '############################################', // ty=0
  ],
  {
    id: 'dsi_01',
    name: 'Isolated Desert — Sunscorch Dunes',
    biome: 'DSI',
    mode: 'normal',
    sandstormDir: -1,
    mapX: 9,
    mapY: -1,
    defaultSpawnX: 41.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 43,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'atvc_boss',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Molten Caldera',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_02',
        targetSpawnX: 41.0,
        targetSpawnY: 2.0,
        label: 'Crumbling Obelisk',
      },
    ],
    enemies: [
      { id: 'dsi_01_e1', archetype: 'vulture', x: 14.0, y: 10.5, patrolMinX: 9.0, patrolMaxX: 19.5 },
      { id: 'dsi_01_e2', archetype: 'sand_worm', x: 20.0, y: 2.0, patrolMinX: 17.5, patrolMaxX: 22.0 },
      { id: 'dsi_01_e3', archetype: 'spike_turtle', x: 21.5, y: 9.0, patrolMinX: 18.5, patrolMaxX: 24.0 },
      { id: 'dsi_01_e4', archetype: 'fire_lizard', x: 34.0, y: 9.0, patrolMinX: 32.2, patrolMaxX: 35.2 },
    ],
    coins: [
      { id: 'dsi_01_coin_1', x: 21.5, y: 11.2, kind: 'world' },
      { id: 'dsi_01_coin_2', x: 9.0, y: 9.6, kind: 'world' },
      { id: 'dsi_01_coin_combo', x: 34.0, y: 11.2, kind: 'combo' },
    ],
    crystals: [
      { id: 'dsi_01_c1', x: 14.5, y: 6.5, value: 20 },
      { id: 'dsi_01_c2', x: 27.5, y: 6.5, value: 20 },
      { id: 'dsi_01_c3', x: 20.0, y: 10.5, value: 20 },
      { id: 'dsi_01_c4', x: 23.0, y: 10.5, value: 20 },
    ],
    props: [
      {
        id: 'dsi_01_sign',
        kind: 'signpost',
        x: 38.5,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Isolated Desert: Sandstorms push your stride, crumble stones shatter underfoot, and quicksand slows every step!',
      },
    ],
  },
);

// ============================================================================
// DSI 02 — Crumbling Obelisk (44 x 15, sandstormDir: 1)
// Eastward headwind (>), crumbling obelisk platforms (C), Talon Battery & Mummy.
// ============================================================================
const DSI_02 = buildRoom(
  [
    '############################################', // ty=14
    '#..........................................#', // ty=13
    '#..........................................#', // ty=12
    '#.............>>>>>>....>>>>>>.............#', // ty=11
    '#..........................................#', // ty=10
    '#.....----....CCCCCC....CCCCCC....----.....#', // ty=9
    '#..........................................#', // ty=8
    '#..................######..................#', // ty=7
    '#............CCCC..######..CCCC............#', // ty=6
    '#..........................................#', // ty=5
    '............................................', // ty=4  tx=0,43 OPEN
    '............................................', // ty=3  tx=0,43 OPEN
    '........O..........................O........', // ty=2  tx=0,43 OPEN
    '##########QQQQQQQQ########QQQQQQQQ##########', // ty=1
    '############################################', // ty=0
  ],
  {
    id: 'dsi_02',
    name: 'Isolated Desert — Crumbling Obelisk',
    biome: 'DSI',
    mode: 'normal',
    sandstormDir: 1,
    mapX: 8,
    mapY: -1,
    defaultSpawnX: 41.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 43,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Sunscorch Dunes',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_03',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Quicksand Basin',
      },
    ],
    enemies: [
      { id: 'dsi_02_e1', archetype: 'mummy', x: 21.5, y: 2.0, patrolMinX: 18.5, patrolMaxX: 25.0 },
      { id: 'dsi_02_e2', archetype: 'eagle_cannon', x: 15.5, y: 12.0, patrolMinX: 11.0, patrolMaxX: 20.5 },
      { id: 'dsi_02_e3', archetype: 'vulture', x: 28.5, y: 12.0, patrolMinX: 23.5, patrolMaxX: 33.5 },
      { id: 'dsi_02_e4', archetype: 'fire_lizard', x: 21.5, y: 8.0, patrolMinX: 19.2, patrolMaxX: 24.0 },
    ],
    coins: [
      { id: 'dsi_02_coin_1', x: 22.0, y: 12.6, kind: 'world' },
      { id: 'dsi_02_coin_2', x: 8.0, y: 10.6, kind: 'world' },
      { id: 'dsi_02_coin_combo', x: 36.0, y: 10.6, kind: 'combo' },
    ],
    crystals: [
      { id: 'dsi_02_c1', x: 16.5, y: 10.5, value: 20 },
      { id: 'dsi_02_c2', x: 27.5, y: 10.5, value: 20 },
      { id: 'dsi_02_c3', x: 14.5, y: 7.5, value: 15 },
      { id: 'dsi_02_c4', x: 29.5, y: 7.5, value: 15 },
    ],
    props: [],
  },
);

// ============================================================================
// DSI 03 — Quicksand Basin (40 x 15, hasTeleporter: true)
// Wide quicksand basin with crumbling pillars, Desert Waystone Teleporter,
// and secret oasis tunnel hidden behind sandstone cracks (?) -> dsi_05!
// ============================================================================
const DSI_03 = buildRoom(
  [
    '########################################', // ty=14
    '#......................................#', // ty=13
    '#......................................#', // ty=12
    '#..............----------..............#', // ty=11
    '#......................................#', // ty=10
    '#......CCCC..................CCCC......#', // ty=9
    '#......................................#', // ty=8
    '#.............####????####.............#', // ty=7  secret oasis alcove roof
    '#.............#..........#.............#', // ty=6
    '#......CCCC...#..........#...CCCC......#', // ty=5
    '..............?..........?..............', // ty=4  tx=0,39 OPEN
    '..............?..........?..............', // ty=3  tx=0,39 OPEN
    '......O.......?..........?.......O......', // ty=2  tx=0,39 OPEN
    '########QQQQQQ############QQQQQQ########', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'dsi_03',
    name: 'Isolated Desert — Quicksand Basin',
    biome: 'DSI',
    mode: 'normal',
    mapX: 7,
    mapY: -1,
    defaultSpawnX: 37.0,
    defaultSpawnY: 2.0,
    hasTeleporter: true,
    exits: [
      {
        dir: 'right',
        x: 39,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_02',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Crumbling Obelisk',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_04',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Mirage Arena',
      },
      {
        dir: 'door',
        x: 19.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'dsi_05',
        targetSpawnX: 14.0,
        targetSpawnY: 2.0,
        label: 'Hidden Oasis',
      },
    ],
    enemies: [
      { id: 'dsi_03_e1', archetype: 'sand_worm', x: 18.0, y: 12.0, patrolMinX: 15.5, patrolMaxX: 24.0 },
      { id: 'dsi_03_e2', archetype: 'scavenger', x: 8.5, y: 10.0, patrolMinX: 7.2, patrolMaxX: 10.2 },
      { id: 'dsi_03_e3', archetype: 'spike_turtle', x: 30.5, y: 10.0, patrolMinX: 29.2, patrolMaxX: 32.2 },
    ],
    coins: [
      { id: 'dsi_03_coin_1', x: 20.0, y: 13.0, kind: 'world' },
      { id: 'dsi_03_coin_2', x: 9.0, y: 7.0, kind: 'world' },
      { id: 'dsi_03_coin_combo', x: 31.0, y: 7.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'dsi_03_c1', x: 17.5, y: 3.5, value: 20 },
      { id: 'dsi_03_c2', x: 22.5, y: 3.5, value: 20 },
      { id: 'dsi_03_c3', x: 18.0, y: 12.6, value: 20 },
      { id: 'dsi_03_c4', x: 22.0, y: 12.6, value: 20 },
    ],
    props: [
      {
        id: 'dsi_03_teleporter',
        kind: 'teleporter',
        x: 3.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Basin Waystone',
      },
    ],
  },
);

// ============================================================================
// DSI 04 — Mirage Arena (28 x 14, mode: 'arena', sandstormDir: -1)
// Sandstorm combat crucible with crumbling ledges & elevated Mirage Chest!
// ============================================================================
const DSI_04 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#..........................#', // ty=9
    '#..........................#', // ty=8
    '#....CCCCC........CCCCC....#', // ty=7
    '#..........................#', // ty=6
    '#..........................#', // ty=5
    '............................', // ty=4  tx=0,27 OPEN
    '............................', // ty=3  tx=0,27 OPEN
    '.....O................O.....', // ty=2  tx=0,27 OPEN
    '#########QQQQ##QQQQ#########', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'dsi_04',
    name: 'Isolated Desert — Mirage Arena',
    biome: 'DSI',
    mode: 'arena',
    sandstormDir: -1,
    mapX: 6,
    mapY: -1,
    defaultSpawnX: 25.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_03',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Quicksand Basin',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_06',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Dune Ravine',
      },
    ],
    enemies: [
      { id: 'dsi_04_e1', archetype: 'spike_turtle', x: 7.0, y: 8.0, patrolMinX: 5.2, patrolMaxX: 9.0 },
      { id: 'dsi_04_e2', archetype: 'sand_worm', x: 20.5, y: 8.0, patrolMinX: 18.2, patrolMaxX: 22.0 },
      { id: 'dsi_04_e3', archetype: 'vulture', x: 9.5, y: 10.5, patrolMinX: 5.0, patrolMaxX: 14.0 },
      { id: 'dsi_04_e4', archetype: 'eagle_cannon', x: 18.5, y: 10.5, patrolMinX: 14.0, patrolMaxX: 23.0 },
    ],
    coins: [
      { id: 'dsi_04_coin_1', x: 7.5, y: 9.5, kind: 'world' },
      { id: 'dsi_04_coin_2', x: 20.5, y: 9.5, kind: 'world' },
      { id: 'dsi_04_coin_chest', x: 14.0, y: 11.6, kind: 'chest' },
      { id: 'dsi_04_coin_combo', x: 14.0, y: 5.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'dsi_04_c1', x: 11.0, y: 5.0, value: 20 },
      { id: 'dsi_04_c2', x: 17.0, y: 5.0, value: 20 },
      { id: 'dsi_04_c3', x: 14.0, y: 12.4, value: 25 },
    ],
    props: [
      {
        id: 'dsi_04_chest',
        kind: 'chest',
        x: 13.5,
        y: 11.0,
        width: 1.0,
        height: 0.85,
        coinId: 'dsi_04_coin_chest',
        label: 'Mirage Spoils Chest',
      },
    ],
  },
);

// ============================================================================
// DSI 05 — Hidden Oasis (30 x 14, isSecret: true)
// Secret lush palm sanctuary tucked beneath Quicksand Basin!
// ============================================================================
const DSI_05 = buildRoom(
  [
    '##############################', // ty=13
    '#............................#', // ty=12
    '#............................#', // ty=11
    '#...........------...........#', // ty=10
    '#............................#', // ty=9
    '#....----............----....#', // ty=8
    '#............................#', // ty=7
    '#............WWWW............#', // ty=6  oasis spring updraft
    '#............WWWW............#', // ty=5
    '#............WWWW............#', // ty=4
    '#............WWWW............#', // ty=3
    '#......O..............O......#', // ty=2
    '#########QQQQ####QQQQ#########', // ty=1
    '##############################', // ty=0
  ],
  {
    id: 'dsi_05',
    name: 'Isolated Desert — Hidden Oasis',
    biome: 'DSI',
    mode: 'normal',
    isSecret: true,
    mapX: 7,
    mapY: -2,
    defaultSpawnX: 14.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 14.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'dsi_03',
        targetSpawnX: 19.5,
        targetSpawnY: 2.0,
        label: 'Quicksand Basin',
      },
    ],
    enemies: [
      { id: 'dsi_05_e1', archetype: 'scavenger', x: 7.0, y: 9.0, patrolMinX: 5.2, patrolMaxX: 8.2 },
      { id: 'dsi_05_e2', archetype: 'fire_lizard', x: 22.5, y: 9.0, patrolMinX: 21.2, patrolMaxX: 24.2 },
      { id: 'dsi_05_e3', archetype: 'sand_worm', x: 14.5, y: 11.0, patrolMinX: 12.2, patrolMaxX: 17.0 },
    ],
    coins: [
      { id: 'dsi_05_coin_1', x: 7.0, y: 11.0, kind: 'world' },
      { id: 'dsi_05_coin_2', x: 23.0, y: 11.0, kind: 'world' },
      { id: 'dsi_05_coin_chest', x: 26.5, y: 2.6, kind: 'chest' },
      { id: 'dsi_05_coin_combo', x: 15.0, y: 12.4, kind: 'combo' },
    ],
    crystals: [
      { id: 'dsi_05_c1', x: 11.0, y: 5.5, value: 25 },
      { id: 'dsi_05_c2', x: 19.0, y: 5.5, value: 25 },
      { id: 'dsi_05_c3', x: 15.0, y: 8.5, value: 30 },
    ],
    props: [
      {
        id: 'dsi_05_chest',
        kind: 'chest',
        x: 26.0,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'dsi_05_coin_chest',
        label: 'Oasis Relic Chest',
      },
      {
        id: 'dsi_05_save',
        kind: 'save_shrine',
        x: 4.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Oasis Spring Shrine',
      },
    ],
  },
);

// ============================================================================
// DSI 06 — Dune Ravine (40 x 15)
// Opposing wind tunnels (< and >), crumble stepping stones, Save Shrine before
// Mini-Boss 2 (Bone Colossus)!
// ============================================================================
const DSI_06 = buildRoom(
  [
    '########################################', // ty=14
    '#......................................#', // ty=13
    '#......................................#', // ty=12
    '#..........<<<<<<......>>>>>>..........#', // ty=11
    '#......................................#', // ty=10
    '#......CCCC..................CCCC......#', // ty=9
    '#................------................#', // ty=8
    '#......................................#', // ty=7
    '#...........CCCC........CCCC...........#', // ty=6
    '#......................................#', // ty=5
    '........................................', // ty=4  tx=0,39 OPEN
    '........................................', // ty=3  tx=0,39 OPEN
    '........O......................O........', // ty=2  tx=0,39 OPEN
    '##########QQQQQQ########QQQQQQ##########', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'dsi_06',
    name: 'Isolated Desert — Dune Ravine',
    biome: 'DSI',
    mode: 'normal',
    mapX: 5,
    mapY: -1,
    defaultSpawnX: 37.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 39,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_04',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Mirage Arena',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_boss',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Titan Bonepit',
      },
    ],
    enemies: [
      { id: 'dsi_06_e1', archetype: 'mummy', x: 19.5, y: 2.0, patrolMinX: 16.5, patrolMaxX: 23.0 },
      { id: 'dsi_06_e2', archetype: 'spike_turtle', x: 19.5, y: 9.0, patrolMinX: 17.2, patrolMaxX: 22.0 },
      { id: 'dsi_06_e3', archetype: 'vulture', x: 13.0, y: 12.0, patrolMinX: 8.5, patrolMaxX: 18.0 },
      { id: 'dsi_06_e4', archetype: 'sand_worm', x: 26.5, y: 7.0, patrolMinX: 24.2, patrolMaxX: 27.2 },
    ],
    coins: [
      { id: 'dsi_06_coin_1', x: 20.0, y: 12.5, kind: 'world' },
      { id: 'dsi_06_coin_2', x: 9.0, y: 10.6, kind: 'world' },
      { id: 'dsi_06_coin_combo', x: 31.0, y: 10.6, kind: 'combo' },
    ],
    crystals: [
      { id: 'dsi_06_c1', x: 14.0, y: 7.5, value: 20 },
      { id: 'dsi_06_c2', x: 26.0, y: 7.5, value: 20 },
      { id: 'dsi_06_c3', x: 20.0, y: 10.5, value: 20 },
    ],
    props: [
      {
        id: 'dsi_06_save',
        kind: 'save_shrine',
        x: 4.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Bonepit Threshold Shrine',
      },
    ],
  },
);

// ============================================================================
// DSI BOSS — Titan Bonepit (28 x 14, mode: 'boss', bossId: 'bone_colossus', hasTeleporter: true)
// Mini-Boss 2 (15 HP), Waystone Teleporter, Shortcut Door back to Subrosa Haven,
// and Labyrinth Hatch descending into the Forgotten Labyrinth (lab_01)!
// ============================================================================
const DSI_BOSS = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........................#', // ty=10
    '#..........------..........#', // ty=9
    '#..........................#', // ty=8
    '#..........................#', // ty=7
    '#..........................#', // ty=6
    '#....-----........-----....#', // ty=5
    '#........................... ', // ty=4  tx=27 OPEN
    '#........................... ', // ty=3  tx=27 OPEN
    '#....O................O.....', // ty=2  tx=27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ].map((row) => row.trimEnd()),
  {
    id: 'dsi_boss',
    name: 'Isolated Desert — Titan Bonepit',
    biome: 'DSI',
    mode: 'boss',
    bossId: 'bone_colossus',
    hasTeleporter: true,
    mapX: 4,
    mapY: -1,
    defaultSpawnX: 25.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_06',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Dune Ravine',
      },
      {
        dir: 'door',
        x: 13.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'hub_haven',
        targetSpawnX: 38.5,
        targetSpawnY: 6.0,
        label: 'Shortcut to Subrosa Haven',
      },
      {
        dir: 'door',
        x: 3.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'lab_01',
        targetSpawnX: 34.0,
        targetSpawnY: 2.0,
        label: 'Forgotten Labyrinth',
      },
    ],
    enemies: [],
    coins: [
      { id: 'boss_bone_colossus', x: 14.0, y: 10.6, kind: 'boss' },
      { id: 'dsi_boss_coin_2', x: 7.5, y: 7.0, kind: 'world' },
    ],
    crystals: [
      { id: 'dsi_boss_c1', x: 7.5, y: 6.5, value: 20 },
      { id: 'dsi_boss_c2', x: 20.5, y: 6.5, value: 20 },
      { id: 'dsi_boss_c3', x: 14.0, y: 10.8, value: 25 },
    ],
    props: [
      {
        id: 'dsi_boss_teleporter',
        kind: 'teleporter',
        x: 18.0,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Bonepit Waystone',
      },
    ],
  },
);

export const DSI_ROOMS: readonly RoomDef[] = [
  DSI_01,
  DSI_02,
  DSI_03,
  DSI_04,
  DSI_05,
  DSI_06,
  DSI_BOSS,
] as const;
