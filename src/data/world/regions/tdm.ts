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
// TDM 01 — Sunlit Ridge (48 x 14)
// Flowing left-to-right combo chain with Bramble Stompers, Winged Brambles,
// Horned Beetle, bounce pad to elevated ridge, and combo reward.
// ============================================================================
const TDM_01 = buildRoom(
  [
    '################################################', // ty=13
    '#..............................................#', // ty=12
    '#..............................................#', // ty=11
    '#..............................................#', // ty=10
    '#..............................................#', // ty=9
    '#..............................................#', // ty=8
    '#...................----.......................#', // ty=7
    '#..............................................#', // ty=6
    '#..............................................#', // ty=5
    '............-----..........----.................', // ty=4  tx=0,47 OPEN
    '...................######.......................', // ty=3  tx=0,47 OPEN
    '.................O.######...^^..#########.......', // ty=2  tx=0,47 OPEN
    '################################################', // ty=1
    '################################################', // ty=0
  ],
  {
    id: 'tdm_01',
    name: "Monster's Trail — Sunlit Ridge",
    biome: 'TDM',
    mode: 'normal',
    mapX: 1,
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
        targetRoomId: 'hub_haven',
        targetSpawnX: 53.0,
        targetSpawnY: 2.0,
        label: 'Subrosa Haven',
      },
      {
        dir: 'right',
        x: 47,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'tdm_02',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Canyon Climb',
      },
    ],
    enemies: [
      { id: 'tdm_01_e1', archetype: 'goomba', x: 7.5, y: 2.0, patrolMinX: 5.0, patrolMaxX: 11.0 },
      { id: 'tdm_01_e2', archetype: 'air_goomba', x: 12.5, y: 6.5, patrolMinX: 10.5, patrolMaxX: 15.5 },
      { id: 'tdm_01_e3', archetype: 'goomba', x: 14.0, y: 2.0, patrolMinX: 11.5, patrolMaxX: 16.0 },
      { id: 'tdm_01_e4', archetype: 'goomba', x: 21.5, y: 4.0, patrolMinX: 19.5, patrolMaxX: 23.8 },
      { id: 'tdm_01_e5', archetype: 'air_goomba', x: 28.5, y: 6.5, patrolMinX: 26.0, patrolMaxX: 31.0 },
      { id: 'tdm_01_e6', archetype: 'horned_beetle', x: 35.5, y: 3.0, patrolMinX: 32.5, patrolMaxX: 39.8 },
      { id: 'tdm_01_e7', archetype: 'air_goomba', x: 42.0, y: 5.5, patrolMinX: 40.0, patrolMaxX: 44.5 },
    ],
    coins: [
      { id: 'tdm_01_coin_1', x: 21.5, y: 9.2, kind: 'world' },
      { id: 'tdm_01_coin_2', x: 36.0, y: 6.5, kind: 'world' },
      { id: 'tdm_01_coin_combo', x: 44.0, y: 3.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'tdm_01_c1', x: 5.5, y: 2.6, value: 10 },
      { id: 'tdm_01_c2', x: 9.5, y: 4.2, value: 10 },
      { id: 'tdm_01_c3', x: 13.5, y: 5.6, value: 15 },
      { id: 'tdm_01_c4', x: 15.5, y: 5.6, value: 15 },
      { id: 'tdm_01_c5', x: 20.5, y: 8.6, value: 20 },
      { id: 'tdm_01_c6', x: 22.5, y: 8.6, value: 20 },
      { id: 'tdm_01_c7', x: 28.5, y: 5.8, value: 15 },
      { id: 'tdm_01_c8', x: 34.0, y: 4.2, value: 15 },
      { id: 'tdm_01_c9', x: 38.0, y: 4.2, value: 15 },
      { id: 'tdm_01_c10', x: 42.5, y: 3.5, value: 15 },
    ],
    props: [],
  },
);

// ============================================================================
// TDM 02 — Canyon Climb (36 x 22)
// Vertical wall-jump chimney, Canopy Hornets & Sap Spitters, secret wall grotto
// housing a hidden chest AND doorway to the Hidden Meadow Vault (tdm_07)!
// ============================================================================
const TDM_02 = buildRoom(
  [
    '####################################', // ty=21
    '#.........#........................#', // ty=20
    '#.........#........................#', // ty=19
    '#.........#........................#', // ty=18
    '#.........#.........................', // ty=17  tx=35 OPEN
    '#.........#.........................', // ty=16  tx=35 OPEN
    '###########.........................', // ty=15  tx=35 OPEN
    '#.........#....#######BBB###########', // ty=14
    '#.........?--..#.....#...#.........#', // ty=13
    '#.....BB..?....#.....#...#.........#', // ty=12
    '###########....#.....#.O.#.........#', // ty=11
    '#.........#..--#.....#####.........#', // ty=10
    '#.........#....#...................#', // ty=9
    '#.........#....#...................#', // ty=8
    '#.........#....#...................#', // ty=7
    '#.........#--..#...................#', // ty=6
    '#.........#....#...................#', // ty=5
    '...............#...................#', // ty=4  tx=0 OPEN
    '...............#...................#', // ty=3  tx=0 OPEN
    '...............#...................#', // ty=2  tx=0 OPEN
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'tdm_02',
    name: "Monster's Trail — Canyon Climb",
    biome: 'TDM',
    mode: 'normal',
    mapX: 2,
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
        targetRoomId: 'tdm_01',
        targetSpawnX: 45.0,
        targetSpawnY: 2.0,
        label: 'Sunlit Ridge',
      },
      {
        dir: 'right',
        x: 35,
        y: 15,
        width: 1,
        height: 3,
        targetRoomId: 'tdm_03',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Meadow Arena',
      },
      {
        dir: 'door',
        x: 4.0,
        y: 12.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'tdm_07',
        targetSpawnX: 3.0,
        targetSpawnY: 2.0,
        label: 'Hidden Meadow Vault',
      },
    ],
    enemies: [
      { id: 'tdm_02_e1', archetype: 'spitter', x: 6.5, y: 2.0, patrolMinX: 4.0, patrolMaxX: 9.5 },
      { id: 'tdm_02_e2', archetype: 'bee', x: 12.5, y: 8.5, patrolMinX: 11.2, patrolMaxX: 14.0 },
      { id: 'tdm_02_e3', archetype: 'bee', x: 12.5, y: 12.5, patrolMinX: 11.2, patrolMaxX: 14.0 },
      { id: 'tdm_02_e4', archetype: 'spitter', x: 18.0, y: 15.0, patrolMinX: 16.0, patrolMaxX: 20.5 },
      { id: 'tdm_02_e5', archetype: 'bee', x: 26.5, y: 17.5, patrolMinX: 24.0, patrolMaxX: 29.5 },
      { id: 'tdm_02_e6', archetype: 'goomba', x: 30.5, y: 15.0, patrolMinX: 27.5, patrolMaxX: 33.0 },
    ],
    coins: [
      { id: 'tdm_02_coin_chest', x: 2.5, y: 12.6, kind: 'chest' },
      { id: 'tdm_02_coin_2', x: 23.5, y: 13.0, kind: 'world' },
      { id: 'tdm_02_coin_3', x: 18.5, y: 18.5, kind: 'world' },
      { id: 'tdm_02_coin_combo', x: 32.0, y: 16.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'tdm_02_c1', x: 5.0, y: 2.6, value: 10 },
      { id: 'tdm_02_c2', x: 12.0, y: 4.5, value: 15 },
      { id: 'tdm_02_c3', x: 13.5, y: 7.5, value: 15 },
      { id: 'tdm_02_c4', x: 11.5, y: 10.5, value: 15 },
      { id: 'tdm_02_c5', x: 8.5, y: 12.6, value: 25 },
      { id: 'tdm_02_c6', x: 16.5, y: 16.2, value: 15 },
      { id: 'tdm_02_c7', x: 22.5, y: 12.5, value: 20 },
      { id: 'tdm_02_c8', x: 28.5, y: 16.5, value: 15 },
    ],
    props: [
      {
        id: 'tdm_02_secret_chest',
        kind: 'chest',
        x: 2.0,
        y: 12.0,
        width: 1.0,
        height: 0.85,
        coinId: 'tdm_02_coin_chest',
        label: 'Hidden Canyon Cache',
      },
    ],
  },
);

// ============================================================================
// TDM 03 — Meadow Arena (28 x 14, mode: 'arena', hasTeleporter: true)
// Symmetrical combat arena with Horned Beetle, Bog Hopper, Cap Knight,
// Snapbloom, Canopy Hornet, and Meadow Waystone Teleporter.
// ============================================================================
const TDM_03 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........................#', // ty=10
    '#..........------..........#', // ty=9
    '#..........................#', // ty=8
    '#..........................#', // ty=7
    '#..........................#', // ty=6
    '#.....-----......-----.....#', // ty=5
    '............................', // ty=4  tx=0,27 OPEN
    '............................', // ty=3  tx=0,27 OPEN
    '......O..............O......', // ty=2  tx=0,27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'tdm_03',
    name: "Monster's Trail — Meadow Arena",
    biome: 'TDM',
    mode: 'arena',
    mapX: 3,
    mapY: 0,
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
        targetRoomId: 'tdm_02',
        targetSpawnX: 33.0,
        targetSpawnY: 15.0,
        label: 'Canyon Climb',
      },
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'tdm_04',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Bramble Ravine',
      },
    ],
    enemies: [
      { id: 'tdm_03_e1', archetype: 'horned_beetle', x: 9.0, y: 2.0, patrolMinX: 7.5, patrolMaxX: 13.5 },
      { id: 'tdm_03_e2', archetype: 'frog', x: 18.0, y: 2.0, patrolMinX: 14.0, patrolMaxX: 20.0 },
      { id: 'tdm_03_e3', archetype: 'mushroom_warrior', x: 8.0, y: 6.0, patrolMinX: 6.0, patrolMaxX: 10.0 },
      { id: 'tdm_03_e4', archetype: 'carnivorous_plant', x: 19.0, y: 6.0, patrolMinX: 17.0, patrolMaxX: 21.0 },
      { id: 'tdm_03_e5', archetype: 'frog', x: 13.5, y: 10.0, patrolMinX: 11.0, patrolMaxX: 16.0 },
      { id: 'tdm_03_e6', archetype: 'bee', x: 13.5, y: 5.5, patrolMinX: 10.0, patrolMaxX: 17.5 },
    ],
    coins: [
      { id: 'tdm_03_coin_1', x: 8.5, y: 7.5, kind: 'world' },
      { id: 'tdm_03_coin_2', x: 19.5, y: 7.5, kind: 'world' },
      { id: 'tdm_03_coin_combo', x: 14.0, y: 11.4, kind: 'combo' },
    ],
    crystals: [
      { id: 'tdm_03_c1', x: 6.5, y: 4.5, value: 15 },
      { id: 'tdm_03_c2', x: 12.5, y: 11.2, value: 20 },
      { id: 'tdm_03_c3', x: 15.5, y: 11.2, value: 20 },
      { id: 'tdm_03_c4', x: 21.5, y: 4.5, value: 15 },
      { id: 'tdm_03_c5', x: 11.5, y: 2.8, value: 15 },
      { id: 'tdm_03_c6', x: 16.5, y: 2.8, value: 15 },
    ],
    props: [
      {
        id: 'tdm_03_teleporter',
        kind: 'teleporter',
        x: 24.0,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Meadow Waystone',
      },
    ],
  },
);

// ============================================================================
// TDM 04 — Bramble Ravine (44 x 15)
// High-speed aerial bounce chain over spike ravines with Razorflies, Shell
// Hoppers, and Bog Hoppers.
// ============================================================================
const TDM_04 = buildRoom(
  [
    '############################################', // ty=14
    '#..........................................#', // ty=13
    '#..........................................#', // ty=12
    '#...................------.................#', // ty=11
    '#..........................................#', // ty=10
    '#..........-----..............-----........#', // ty=9
    '#..........................................#', // ty=8
    '#..........................................#', // ty=7
    '#.....----..........######..........----...#', // ty=6
    '#...................######.................#', // ty=5
    '............................................', // ty=4  tx=0,43 OPEN
    '............####..............####..........', // ty=3  tx=0,43 OPEN
    '.........O..####..^^^^^^^^....####..O.......', // ty=2  tx=0,43 OPEN
    '############################################', // ty=1
    '############################################', // ty=0
  ],
  {
    id: 'tdm_04',
    name: "Monster's Trail — Bramble Ravine",
    biome: 'TDM',
    mode: 'normal',
    mapX: 4,
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
        targetRoomId: 'tdm_03',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Meadow Arena',
      },
      {
        dir: 'right',
        x: 43,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'tdm_05',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Briar Crossing',
      },
    ],
    enemies: [
      { id: 'tdm_04_e1', archetype: 'ladybug', x: 7.5, y: 7.0, patrolMinX: 6.0, patrolMaxX: 9.2 },
      { id: 'tdm_04_e2', archetype: 'guilhofly', x: 14.0, y: 10.5, patrolMinX: 11.0, patrolMaxX: 17.5 },
      { id: 'tdm_04_e3', archetype: 'frog', x: 22.0, y: 7.0, patrolMinX: 20.2, patrolMaxX: 25.0 },
      { id: 'tdm_04_e4', archetype: 'air_goomba', x: 27.5, y: 10.5, patrolMinX: 25.0, patrolMaxX: 31.0 },
      { id: 'tdm_04_e5', archetype: 'ladybug', x: 31.5, y: 4.0, patrolMinX: 30.2, patrolMaxX: 33.1 },
      { id: 'tdm_04_e6', archetype: 'goomba', x: 38.5, y: 2.0, patrolMinX: 37.5, patrolMaxX: 41.0 },
    ],
    coins: [
      { id: 'tdm_04_coin_1', x: 22.5, y: 12.6, kind: 'world' },
      { id: 'tdm_04_coin_2', x: 32.0, y: 10.6, kind: 'world' },
      { id: 'tdm_04_coin_combo', x: 39.5, y: 7.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'tdm_04_c1', x: 6.5, y: 2.8, value: 15 },
      { id: 'tdm_04_c2', x: 12.5, y: 10.2, value: 15 },
      { id: 'tdm_04_c3', x: 20.5, y: 12.2, value: 20 },
      { id: 'tdm_04_c4', x: 24.5, y: 12.2, value: 20 },
      { id: 'tdm_04_c5', x: 31.5, y: 5.5, value: 15 },
      { id: 'tdm_04_c6', x: 39.5, y: 3.0, value: 15 },
    ],
    props: [],
  },
);

// ============================================================================
// TDM 05 — Briar Crossing (44 x 16)
// Breakable bridge floor over hidden chest vault, Thorn Rollers & Razorflies.
// ============================================================================
const TDM_05 = buildRoom(
  [
    '############################################', // ty=15
    '#..........................................#', // ty=14
    '#..........................................#', // ty=13
    '#.............----------...................#', // ty=12
    '#..........................................#', // ty=11
    '#..........................................#', // ty=10
    '#......----................----............#', // ty=9
    '#..........................................#', // ty=8
    '#............####BBBB####..................#', // ty=7
    '#............#..........#..................#', // ty=6
    '#............#..........#......-----.......#', // ty=5
    '.............#..........#...................', // ty=4  tx=0,43 OPEN
    '.............#..........#...................', // ty=3  tx=0,43 OPEN
    '.........O...#....OO....#..^^^.......O......', // ty=2  tx=0,43 OPEN
    '############################################', // ty=1
    '############################################', // ty=0
  ],
  {
    id: 'tdm_05',
    name: "Monster's Trail — Briar Crossing",
    biome: 'TDM',
    mode: 'normal',
    mapX: 5,
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
        targetRoomId: 'tdm_04',
        targetSpawnX: 41.0,
        targetSpawnY: 2.0,
        label: 'Bramble Ravine',
      },
      {
        dir: 'right',
        x: 43,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'tdm_06',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Ridge Overlook',
      },
    ],
    enemies: [
      { id: 'tdm_05_e1', archetype: 'spikeball', x: 18.0, y: 8.0, patrolMinX: 13.5, patrolMaxX: 23.5 },
      { id: 'tdm_05_e2', archetype: 'spitter', x: 8.0, y: 10.0, patrolMinX: 7.0, patrolMaxX: 10.2 },
      { id: 'tdm_05_e3', archetype: 'guilhofly', x: 22.0, y: 11.0, patrolMinX: 16.0, patrolMaxX: 27.0 },
      { id: 'tdm_05_e4', archetype: 'goomba', x: 33.0, y: 6.0, patrolMinX: 31.2, patrolMaxX: 35.2 },
      { id: 'tdm_05_e5', archetype: 'spikeball', x: 39.5, y: 2.0, patrolMinX: 38.0, patrolMaxX: 41.2 },
    ],
    coins: [
      { id: 'tdm_05_coin_chest', x: 16.5, y: 2.6, kind: 'chest' },
      { id: 'tdm_05_coin_1', x: 18.0, y: 13.6, kind: 'world' },
      { id: 'tdm_05_coin_2', x: 29.0, y: 10.6, kind: 'world' },
      { id: 'tdm_05_coin_combo', x: 39.5, y: 8.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'tdm_05_c1', x: 6.5, y: 3.0, value: 15 },
      { id: 'tdm_05_c2', x: 15.5, y: 4.5, value: 20 },
      { id: 'tdm_05_c3', x: 21.5, y: 4.5, value: 20 },
      { id: 'tdm_05_c4', x: 16.0, y: 13.4, value: 20 },
      { id: 'tdm_05_c5', x: 20.0, y: 13.4, value: 20 },
      { id: 'tdm_05_c6', x: 33.0, y: 7.5, value: 15 },
    ],
    props: [
      {
        id: 'tdm_05_chest',
        kind: 'chest',
        x: 16.0,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'tdm_05_coin_chest',
        label: 'Briar Vault Chest',
      },
    ],
  },
);

// ============================================================================
// TDM 06 — Ridge Overlook (36 x 14, hasTeleporter: true)
// Pre-boss staging terrace with Teleporter, Save Shrine, and armored patrols.
// ============================================================================
const TDM_06 = buildRoom(
  [
    '####################################', // ty=13
    '#..................................#', // ty=12
    '#..................................#', // ty=11
    '#..............------..............#', // ty=10
    '#..................................#', // ty=9
    '#..................................#', // ty=8
    '#......-----..........-----........#', // ty=7
    '#..................................#', // ty=6
    '#..................................#', // ty=5
    '....................................', // ty=4  tx=0,35 OPEN
    '............####..####..............', // ty=3  tx=0,35 OPEN
    '.........O..####..####..O...........', // ty=2  tx=0,35 OPEN
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'tdm_06',
    name: "Monster's Trail — Ridge Overlook",
    biome: 'TDM',
    mode: 'normal',
    mapX: 6,
    mapY: 0,
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
        targetRoomId: 'tdm_05',
        targetSpawnX: 41.0,
        targetSpawnY: 2.0,
        label: 'Briar Crossing',
      },
      {
        dir: 'right',
        x: 35,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'tdm_boss',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Behemoth Gorge',
      },
    ],
    enemies: [
      { id: 'tdm_06_e1', archetype: 'horned_beetle', x: 13.5, y: 4.0, patrolMinX: 12.2, patrolMaxX: 15.1 },
      { id: 'tdm_06_e2', archetype: 'mushroom_warrior', x: 19.5, y: 4.0, patrolMinX: 18.2, patrolMaxX: 21.1 },
      { id: 'tdm_06_e3', archetype: 'spikeball', x: 9.0, y: 8.0, patrolMinX: 7.2, patrolMaxX: 11.1 },
      { id: 'tdm_06_e4', archetype: 'air_goomba', x: 17.5, y: 9.5, patrolMinX: 13.0, patrolMaxX: 22.0 },
    ],
    coins: [
      { id: 'tdm_06_coin_1', x: 17.5, y: 11.6, kind: 'world' },
      { id: 'tdm_06_coin_2', x: 24.5, y: 8.6, kind: 'world' },
      { id: 'tdm_06_coin_combo', x: 17.0, y: 2.8, kind: 'combo' },
    ],
    crystals: [
      { id: 'tdm_06_c1', x: 8.5, y: 8.5, value: 15 },
      { id: 'tdm_06_c2', x: 16.0, y: 11.4, value: 20 },
      { id: 'tdm_06_c3', x: 19.0, y: 11.4, value: 20 },
      { id: 'tdm_06_c4', x: 25.5, y: 8.5, value: 15 },
    ],
    props: [
      {
        id: 'tdm_06_teleporter',
        kind: 'teleporter',
        x: 27.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Ridge Waystone',
      },
      {
        id: 'tdm_06_save',
        kind: 'save_shrine',
        x: 31.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Gorge Threshold Shrine',
      },
    ],
  },
);

// ============================================================================
// TDM 07 — Hidden Meadow Vault (28 x 14, isSecret: true)
// Secret bonus treasure chamber accessible through Canyon Climb's hidden grotto!
// ============================================================================
const TDM_07 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#..........................#', // ty=9
    '#....----..........----....#', // ty=8
    '#..........................#', // ty=7
    '#............BB............#', // ty=6
    '#..........######..........#', // ty=5
    '#..........................#', // ty=4
    '#..........................#', // ty=3
    '#.......O..........O.......#', // ty=2
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'tdm_07',
    name: "Monster's Trail — Hidden Meadow Vault",
    biome: 'TDM',
    mode: 'normal',
    isSecret: true,
    mapX: 2,
    mapY: 1,
    defaultSpawnX: 3.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 2.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'tdm_02',
        targetSpawnX: 4.5,
        targetSpawnY: 12.0,
        label: 'Canyon Climb',
      },
    ],
    enemies: [
      { id: 'tdm_07_e1', archetype: 'ladybug', x: 13.0, y: 2.0, patrolMinX: 10.0, patrolMaxX: 17.5 },
      { id: 'tdm_07_e2', archetype: 'spikeball', x: 13.5, y: 11.0, patrolMinX: 11.2, patrolMaxX: 16.0 },
    ],
    coins: [
      { id: 'tdm_07_coin_1', x: 7.0, y: 9.6, kind: 'world' },
      { id: 'tdm_07_coin_2', x: 21.0, y: 9.6, kind: 'world' },
      { id: 'tdm_07_coin_chest', x: 23.5, y: 2.6, kind: 'chest' },
      { id: 'tdm_07_coin_combo', x: 14.0, y: 12.2, kind: 'combo' },
    ],
    crystals: [
      { id: 'tdm_07_c1', x: 6.5, y: 9.4, value: 25 },
      { id: 'tdm_07_c2', x: 13.0, y: 7.5, value: 25 },
      { id: 'tdm_07_c3', x: 15.0, y: 7.5, value: 25 },
      { id: 'tdm_07_c4', x: 21.5, y: 9.4, value: 25 },
    ],
    props: [
      {
        id: 'tdm_07_chest',
        kind: 'chest',
        x: 23.0,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'tdm_07_coin_chest',
        label: 'Secret Meadow Hoard',
      },
    ],
  },
);

// ============================================================================
// TDM BOSS — Behemoth Gorge (28 x 14, mode: 'boss', bossId: 'dino_behemoth')
// Mini-Boss 1 (10 HP) guarding the eastern gateway into the Infested Forest!
// ============================================================================
const TDM_BOSS = buildRoom(
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
    '............................', // ty=4  tx=0,27 OPEN
    '............................', // ty=3  tx=0,27 OPEN
    '.....O................O.....', // ty=2  tx=0,27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'tdm_boss',
    name: "Monster's Trail — Behemoth Gorge",
    biome: 'TDM',
    mode: 'boss',
    bossId: 'dino_behemoth',
    mapX: 7,
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
        targetRoomId: 'tdm_06',
        targetSpawnX: 33.0,
        targetSpawnY: 2.0,
        label: 'Ridge Overlook',
      },
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'flin_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Infested Forest',
      },
    ],
    enemies: [],
    coins: [{ id: 'boss_dino_behemoth', x: 14.0, y: 10.6, kind: 'boss' }],
    crystals: [
      { id: 'tdm_boss_c1', x: 7.5, y: 6.8, value: 20 },
      { id: 'tdm_boss_c2', x: 14.0, y: 10.5, value: 25 },
      { id: 'tdm_boss_c3', x: 20.5, y: 6.8, value: 20 },
    ],
    props: [],
  },
);

export const TDM_ROOMS: readonly RoomDef[] = [
  TDM_01,
  TDM_02,
  TDM_03,
  TDM_04,
  TDM_05,
  TDM_06,
  TDM_07,
  TDM_BOSS,
] as const;
