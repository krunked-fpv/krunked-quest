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
// ATVC 01 — Cinder Bridge (40 x 15)
// Lava pools (L), explosive blocks (X), spinning platforms over molten troughs.
// ============================================================================
const ATVC_01 = buildRoom(
  [
    '########################################', // ty=14
    '#......................................#', // ty=13
    '#......................................#', // ty=12
    '#..............----------..............#', // ty=11
    '#......................................#', // ty=10
    '#......................................#', // ty=9
    '#.....----....................----.....#', // ty=8
    '#................##XX##................#', // ty=7
    '#................#....#................#', // ty=6
    '#......................................#', // ty=5
    '.......................................#', // ty=4  tx=0 OPEN
    '.......................................#', // ty=3  tx=0 OPEN
    '......O..........................O.....#', // ty=2  tx=0 OPEN
    '#########LLLLLLL########LLLLLLL#########', // ty=1  lava pools over solid ty=0
    '########################################', // ty=0
  ],
  {
    id: 'atvc_01',
    name: 'Volcanic Altar — Cinder Bridge',
    biome: 'ATVC',
    mode: 'normal',
    mapX: 10,
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
        targetRoomId: 'ap_boss',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Canopy Sanctum',
      },
      {
        dir: 'door',
        x: 35.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'atvc_02',
        targetSpawnX: 4.0,
        targetSpawnY: 2.0,
        label: 'Magma Vent Ascent',
      },
    ],
    enemies: [
      { id: 'atvc_01_e1', archetype: 'salamander', x: 19.0, y: 2.0, patrolMinX: 16.5, patrolMaxX: 22.8 },
      { id: 'atvc_01_e2', archetype: 'big_jelly', x: 12.5, y: 7.5, patrolMinX: 9.0, patrolMaxX: 15.5 },
      { id: 'atvc_01_e3', archetype: 'mystic_wheel', x: 19.0, y: 12.0, patrolMinX: 15.5, patrolMaxX: 24.0 },
      { id: 'atvc_01_e4', archetype: 'fire_lizard', x: 31.0, y: 9.0, patrolMinX: 30.2, patrolMaxX: 33.0 },
    ],
    coins: [
      { id: 'atvc_01_coin_1', x: 19.5, y: 6.2, kind: 'world' },
      { id: 'atvc_01_coin_2', x: 8.0, y: 9.6, kind: 'world' },
      { id: 'atvc_01_coin_combo', x: 31.5, y: 9.6, kind: 'combo' },
    ],
    crystals: [
      { id: 'atvc_01_c1', x: 12.5, y: 5.5, value: 20 },
      { id: 'atvc_01_c2', x: 27.5, y: 5.5, value: 20 },
      { id: 'atvc_01_c3', x: 18.0, y: 12.6, value: 20 },
      { id: 'atvc_01_c4', x: 21.0, y: 12.6, value: 20 },
    ],
    props: [
      {
        id: 'atvc_01_spin_1',
        kind: 'spinning_platform',
        x: 11.5,
        y: 4.5,
        width: 2.5,
        height: 0.5,
        moveDx: 2.0,
        moveDy: 1.5,
        periodSec: 3.6,
      },
      {
        id: 'atvc_01_spin_2',
        kind: 'spinning_platform',
        x: 26.0,
        y: 4.5,
        width: 2.5,
        height: 0.5,
        moveDx: 2.0,
        moveDy: 1.5,
        periodSec: 3.6,
      },
    ],
  },
);

// ============================================================================
// ATVC 02 — Magma Vent Ascent (32 x 22, risingLava: true)
// High-stakes rising lava climb with bounce pads, explosive walls (X),
// and spinning platforms leading to the upper Foundry exit!
// ============================================================================
const ATVC_02 = buildRoom(
  [
    '################################', // ty=21
    '#..............................#', // ty=20
    '#..............................#', // ty=19
    '#.............................. ', // ty=18  tx=31 OPEN (Wait: use '.'!)
    '#.............................. ', // ty=17
    '#.............................. ', // ty=16
    '#..................#############', // ty=15
    '#.......-----..................#', // ty=14
    '#....................----......#', // ty=13
    '#............##XX##............#', // ty=12
    '#.....----.....................#', // ty=11
    '#......................----....#', // ty=10
    '#...........-----..............#', // ty=9
    '#..............................#', // ty=8
    '#....----..............----....#', // ty=7
    '#..............................#', // ty=6
    '#............------............#', // ty=5
    '#..............................#', // ty=4
    '#.......O..............O.......#', // ty=3
    '#.......#..............#.......#', // ty=2
    '################################', // ty=1
    '################################', // ty=0
  ].map((row) => row.replace(/ /g, '.')),
  {
    id: 'atvc_02',
    name: 'Volcanic Altar — Magma Vent Ascent',
    biome: 'ATVC',
    mode: 'normal',
    risingLava: true,
    mapX: 10,
    mapY: 2,
    defaultSpawnX: 4.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 3.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'atvc_01',
        targetSpawnX: 35.0,
        targetSpawnY: 2.0,
        label: 'Cinder Bridge',
      },
      {
        dir: 'right',
        x: 31,
        y: 16,
        width: 1,
        height: 3,
        targetRoomId: 'atvc_03',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Blaststone Foundry',
      },
    ],
    enemies: [
      { id: 'atvc_02_e1', archetype: 'salamander', x: 15.0, y: 6.0, patrolMinX: 13.2, patrolMaxX: 18.0 },
      { id: 'atvc_02_e2', archetype: 'mini_jelly', x: 10.0, y: 10.5, patrolMinX: 6.0, patrolMaxX: 14.0 },
      { id: 'atvc_02_e3', archetype: 'bombalon', x: 19.0, y: 17.5, patrolMinX: 14.0, patrolMaxX: 24.5 },
      { id: 'atvc_02_e4', archetype: 'salamander', x: 23.0, y: 16.0, patrolMinX: 19.5, patrolMaxX: 28.0 },
    ],
    coins: [
      { id: 'atvc_02_coin_1', x: 15.5, y: 10.8, kind: 'world' },
      { id: 'atvc_02_coin_2', x: 9.5, y: 16.0, kind: 'world' },
      { id: 'atvc_02_coin_combo', x: 25.5, y: 18.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'atvc_02_c1', x: 6.5, y: 8.5, value: 15 },
      { id: 'atvc_02_c2', x: 15.5, y: 13.8, value: 20 },
      { id: 'atvc_02_c3', x: 25.0, y: 11.5, value: 20 },
      { id: 'atvc_02_c4', x: 21.0, y: 17.5, value: 20 },
    ],
    props: [
      {
        id: 'atvc_02_spin_1',
        kind: 'spinning_platform',
        x: 15.0,
        y: 8.0,
        width: 2.5,
        height: 0.5,
        moveDx: 3.0,
        moveDy: 1.5,
        periodSec: 3.4,
      },
    ],
  },
);

// ============================================================================
// ATVC 03 — Blaststone Foundry (40 x 15, hasTeleporter: true)
// Explosive block chains (X), spinning platforms, Waystone Teleporter, and
// secret upper vault doorway to Obsidian Vault (atvc_06)!
// ============================================================================
const ATVC_03 = buildRoom(
  [
    '########################################', // ty=14
    '#......................................#', // ty=13
    '#......................................#', // ty=12
    '#...............--------...............#', // ty=11
    '#..............?........?..............#', // ty=10
    '#..............##########..............#', // ty=9
    '#......................................#', // ty=8
    '#......----..................----......#', // ty=7
    '#............XX..........XX............#', // ty=6
    '#............##..........##............#', // ty=5
    '.......................................#', // ty=4  tx=0 OPEN
    '.......................................#', // ty=3  tx=0 OPEN
    '.......O........O..............O.......#', // ty=2  tx=0 OPEN
    '##########LLLLL#######LLLLL#############', // ty=1  lava pools
    '########################################', // ty=0
  ],
  {
    id: 'atvc_03',
    name: 'Volcanic Altar — Blaststone Foundry',
    biome: 'ATVC',
    mode: 'normal',
    mapX: 11,
    mapY: 2,
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
        targetRoomId: 'atvc_02',
        targetSpawnX: 28.5,
        targetSpawnY: 16.0,
        label: 'Magma Vent Ascent',
      },
      {
        dir: 'door',
        x: 19.5,
        y: 10.0,
        width: 1.5,
        height: 2.0,
        targetRoomId: 'atvc_06',
        targetSpawnX: 3.0,
        targetSpawnY: 2.0,
        label: 'Obsidian Vault',
      },
      {
        dir: 'door',
        x: 35.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'atvc_04',
        targetSpawnX: 3.0,
        targetSpawnY: 2.0,
        label: 'Crucible Arena',
      },
    ],
    enemies: [
      { id: 'atvc_03_e1', archetype: 'puncher_pig', x: 18.5, y: 2.0, patrolMinX: 17.5, patrolMaxX: 20.8 },
      { id: 'atvc_03_e2', archetype: 'big_jelly', x: 12.0, y: 9.5, patrolMinX: 8.5, patrolMaxX: 15.0 },
      { id: 'atvc_03_e3', archetype: 'mini_jelly', x: 27.5, y: 9.5, patrolMinX: 24.5, patrolMaxX: 31.5 },
      { id: 'atvc_03_e4', archetype: 'bombalon', x: 20.0, y: 7.0, patrolMinX: 15.5, patrolMaxX: 24.5 },
    ],
    coins: [
      { id: 'atvc_03_coin_1', x: 8.5, y: 9.0, kind: 'world' },
      { id: 'atvc_03_coin_2', x: 31.0, y: 9.0, kind: 'world' },
      { id: 'atvc_03_coin_combo', x: 20.0, y: 12.8, kind: 'combo' },
    ],
    crystals: [
      { id: 'atvc_03_c1', x: 13.5, y: 7.5, value: 20 },
      { id: 'atvc_03_c2', x: 26.5, y: 7.5, value: 20 },
      { id: 'atvc_03_c3', x: 18.0, y: 10.6, value: 25 },
      { id: 'atvc_03_c4', x: 22.0, y: 10.6, value: 25 },
    ],
    props: [
      {
        id: 'atvc_03_teleporter',
        kind: 'teleporter',
        x: 4.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Foundry Waystone',
      },
      {
        id: 'atvc_03_spin_1',
        kind: 'spinning_platform',
        x: 19.0,
        y: 5.5,
        width: 2.5,
        height: 0.5,
        moveDx: 3.5,
        moveDy: 1.2,
        periodSec: 3.5,
      },
    ],
  },
);

// ============================================================================
// ATVC 04 — Crucible Arena (28 x 14, mode: 'arena')
// Fiery 3-tier combat pit with spinning center platform & volcanic chest!
// ============================================================================
const ATVC_04 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#..........................#', // ty=9
    '#..........................#', // ty=8
    '#....-----........-----....#', // ty=7
    '#..........................#', // ty=6
    '#..........................#', // ty=5
    '#..........................#', // ty=4
    '#..........................#', // ty=3
    '#......O............O......#', // ty=2
    '#########LLLL##LLLL#########', // ty=1  lava pockets
    '############################', // ty=0
  ],
  {
    id: 'atvc_04',
    name: 'Volcanic Altar — Crucible Arena',
    biome: 'ATVC',
    mode: 'arena',
    mapX: 11,
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
        targetRoomId: 'atvc_03',
        targetSpawnX: 35.0,
        targetSpawnY: 2.0,
        label: 'Blaststone Foundry',
      },
      {
        dir: 'door',
        x: 24.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'atvc_05',
        targetSpawnX: 4.0,
        targetSpawnY: 2.0,
        label: 'Molten Chimney',
      },
    ],
    enemies: [
      { id: 'atvc_04_e1', archetype: 'puncher_pig', x: 7.0, y: 8.0, patrolMinX: 5.2, patrolMaxX: 9.0 },
      { id: 'atvc_04_e2', archetype: 'launcher_pig', x: 20.5, y: 8.0, patrolMinX: 18.2, patrolMaxX: 22.0 },
      { id: 'atvc_04_e3', archetype: 'mystic_wheel', x: 13.5, y: 11.0, patrolMinX: 11.2, patrolMaxX: 16.0 },
      { id: 'atvc_04_e4', archetype: 'big_jelly', x: 13.5, y: 7.5, patrolMinX: 10.0, patrolMaxX: 17.5 },
      { id: 'atvc_04_e5', archetype: 'salamander', x: 13.5, y: 2.0, patrolMinX: 13.0, patrolMaxX: 14.5 },
    ],
    coins: [
      { id: 'atvc_04_coin_1', x: 7.5, y: 9.5, kind: 'world' },
      { id: 'atvc_04_coin_2', x: 20.5, y: 9.5, kind: 'world' },
      { id: 'atvc_04_coin_chest', x: 14.0, y: 11.6, kind: 'chest' },
      { id: 'atvc_04_coin_combo', x: 14.0, y: 5.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'atvc_04_c1', x: 10.5, y: 5.0, value: 20 },
      { id: 'atvc_04_c2', x: 17.5, y: 5.0, value: 20 },
      { id: 'atvc_04_c3', x: 14.0, y: 12.4, value: 25 },
    ],
    props: [
      {
        id: 'atvc_04_spin_1',
        kind: 'spinning_platform',
        x: 12.8,
        y: 4.5,
        width: 2.5,
        height: 0.5,
        moveDx: 2.5,
        moveDy: 1.0,
        periodSec: 3.2,
      },
      {
        id: 'atvc_04_chest',
        kind: 'chest',
        x: 13.5,
        y: 11.0,
        width: 1.0,
        height: 0.85,
        coinId: 'atvc_04_coin_chest',
        label: 'Crucible Champion Chest',
      },
    ],
  },
);

// ============================================================================
// ATVC 05 — Molten Chimney (32 x 22, risingLava: true)
// Second volcanic rising-lava climb with explosive shortcuts & spinning ledges!
// ============================================================================
const ATVC_05 = buildRoom(
  [
    '################################', // ty=21
    '#..............................#', // ty=20
    '#..............................#', // ty=19
    '#..............................#', // ty=18
    '#......................#########', // ty=17
    '#........------................#', // ty=16
    '#..................----........#', // ty=15
    '#....----......................#', // ty=14
    '#.............####XX####.......#', // ty=13
    '#..............................#', // ty=12
    '#......----..........----......#', // ty=11
    '#..............................#', // ty=10
    '#............------............#', // ty=9
    '#..............................#', // ty=8
    '#....----..............----....#', // ty=7
    '#..............................#', // ty=6
    '#............------............#', // ty=5
    '#..............................#', // ty=4
    '#.......O..............O.......#', // ty=3
    '#.......#..............#.......#', // ty=2
    '################################', // ty=1
    '################################', // ty=0
  ],
  {
    id: 'atvc_05',
    name: 'Volcanic Altar — Molten Chimney',
    biome: 'ATVC',
    mode: 'normal',
    risingLava: true,
    mapX: 11,
    mapY: 0,
    defaultSpawnX: 4.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 3.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'atvc_04',
        targetSpawnX: 24.0,
        targetSpawnY: 2.0,
        label: 'Crucible Arena',
      },
      {
        dir: 'door',
        x: 26.0,
        y: 18.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'atvc_07',
        targetSpawnX: 31.0,
        targetSpawnY: 2.0,
        label: 'Flame Shrine Antechamber',
      },
    ],
    enemies: [
      { id: 'atvc_05_e1', archetype: 'salamander', x: 15.0, y: 6.0, patrolMinX: 13.2, patrolMaxX: 18.0 },
      { id: 'atvc_05_e2', archetype: 'bombalon', x: 16.0, y: 11.5, patrolMinX: 11.0, patrolMaxX: 21.0 },
      { id: 'atvc_05_e3', archetype: 'mini_jelly', x: 12.0, y: 15.5, patrolMinX: 7.0, patrolMaxX: 17.0 },
      { id: 'atvc_05_e4', archetype: 'launcher_pig', x: 11.0, y: 17.0, patrolMinX: 9.2, patrolMaxX: 14.0 },
    ],
    coins: [
      { id: 'atvc_05_coin_1', x: 15.5, y: 10.6, kind: 'world' },
      { id: 'atvc_05_coin_2', x: 6.5, y: 15.8, kind: 'world' },
      { id: 'atvc_05_coin_combo', x: 20.5, y: 17.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'atvc_05_c1', x: 15.5, y: 7.5, value: 20 },
      { id: 'atvc_05_c2', x: 8.5, y: 12.5, value: 20 },
      { id: 'atvc_05_c3', x: 23.0, y: 12.5, value: 20 },
      { id: 'atvc_05_c4', x: 13.0, y: 18.0, value: 25 },
    ],
    props: [
      {
        id: 'atvc_05_spin_1',
        kind: 'spinning_platform',
        x: 15.0,
        y: 11.0,
        width: 2.5,
        height: 0.5,
        moveDx: 3.0,
        moveDy: 1.2,
        periodSec: 3.2,
      },
    ],
  },
);

// ============================================================================
// ATVC 06 — Obsidian Vault (28 x 14, isSecret: true)
// Secret blaststone chamber accessed from Blaststone Foundry's hidden roof!
// ============================================================================
const ATVC_06 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#..........................#', // ty=9
    '#....----..........----....#', // ty=8
    '#............XX............#', // ty=7
    '#..........##XX##..........#', // ty=6
    '#..........................#', // ty=5
    '#..........................#', // ty=4
    '#..........................#', // ty=3
    '#.......O..........O.......#', // ty=2
    '#########LLLL##LLLL#########', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'atvc_06',
    name: 'Volcanic Altar — Obsidian Vault',
    biome: 'ATVC',
    mode: 'normal',
    isSecret: true,
    mapX: 11,
    mapY: 3,
    defaultSpawnX: 3.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 2.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'atvc_03',
        targetSpawnX: 19.5,
        targetSpawnY: 10.0,
        label: 'Blaststone Foundry',
      },
    ],
    enemies: [
      { id: 'atvc_06_e1', archetype: 'mystic_wheel', x: 13.5, y: 11.0, patrolMinX: 11.2, patrolMaxX: 16.0 },
      { id: 'atvc_06_e2', archetype: 'mini_jelly', x: 9.0, y: 10.5, patrolMinX: 5.5, patrolMaxX: 13.0 },
      { id: 'atvc_06_e3', archetype: 'launcher_pig', x: 20.5, y: 9.0, patrolMinX: 19.2, patrolMaxX: 22.0 },
      { id: 'atvc_06_e4', archetype: 'fire_lizard', x: 6.5, y: 9.0, patrolMinX: 5.2, patrolMaxX: 8.2 },
    ],
    coins: [
      { id: 'atvc_06_coin_1', x: 7.0, y: 10.6, kind: 'world' },
      { id: 'atvc_06_coin_2', x: 21.0, y: 10.6, kind: 'world' },
      { id: 'atvc_06_coin_chest', x: 24.0, y: 2.6, kind: 'chest' },
      { id: 'atvc_06_coin_combo', x: 14.0, y: 12.4, kind: 'combo' },
    ],
    crystals: [
      { id: 'atvc_06_c1', x: 11.0, y: 5.0, value: 25 },
      { id: 'atvc_06_c2', x: 17.0, y: 5.0, value: 25 },
      { id: 'atvc_06_c3', x: 14.0, y: 8.5, value: 30 },
    ],
    props: [
      {
        id: 'atvc_06_chest',
        kind: 'chest',
        x: 23.5,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'atvc_06_coin_chest',
        label: 'Obsidian Hoard',
      },
    ],
  },
);

// ============================================================================
// ATVC 07 — Flame Shrine Antechamber (36 x 15, hasTeleporter: true)
// Houses the Fire Form Totem (krunk_fire), Save Shrine, Waystone Teleporter,
// and explosive target run right before the Molten Caldera boss!
// ============================================================================
const ATVC_07 = buildRoom(
  [
    '####################################', // ty=14
    '#..................................#', // ty=13
    '#..................................#', // ty=12
    '#.............--------.............#', // ty=11
    '#..................................#', // ty=10
    '#..................................#', // ty=9
    '#....----....##XX..XX##....----....#', // ty=8
    '#............##########............#', // ty=7
    '#..................................#', // ty=6
    '#..................................#', // ty=5
    '...................................#', // ty=4  tx=0 OPEN
    '...................................#', // ty=3  tx=0 OPEN
    '........O..................O.......#', // ty=2  tx=0 OPEN
    '##########LLLLL######LLLLL##########', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'atvc_07',
    name: 'Volcanic Altar — Flame Shrine Antechamber',
    biome: 'ATVC',
    mode: 'normal',
    mapX: 11,
    mapY: -1,
    defaultSpawnX: 31.0,
    defaultSpawnY: 2.0,
    hasTeleporter: true,
    exits: [
      {
        dir: 'door',
        x: 31.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'atvc_05',
        targetSpawnX: 26.0,
        targetSpawnY: 18.0,
        label: 'Molten Chimney',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'atvc_boss',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Molten Caldera',
      },
    ],
    enemies: [
      { id: 'atvc_07_e1', archetype: 'puncher_pig', x: 17.5, y: 2.0, patrolMinX: 15.5, patrolMaxX: 20.0 },
      { id: 'atvc_07_e2', archetype: 'bombalon', x: 12.0, y: 10.5, patrolMinX: 8.0, patrolMaxX: 16.0 },
      { id: 'atvc_07_e3', archetype: 'mystic_wheel', x: 17.5, y: 12.0, patrolMinX: 14.2, patrolMaxX: 21.0 },
    ],
    coins: [
      { id: 'atvc_07_coin_1', x: 18.0, y: 13.0, kind: 'world' },
      { id: 'atvc_07_coin_2', x: 7.0, y: 10.0, kind: 'world' },
      { id: 'atvc_07_coin_combo', x: 29.0, y: 10.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'atvc_07_c1', x: 12.5, y: 5.5, value: 20 },
      { id: 'atvc_07_c2', x: 23.5, y: 5.5, value: 20 },
      { id: 'atvc_07_c3', x: 18.0, y: 9.8, value: 25 },
    ],
    props: [
      {
        id: 'atvc_07_fire_totem',
        kind: 'form_totem',
        formId: 'krunk_fire',
        x: 17.5,
        y: 8.0,
        width: 1.0,
        height: 1.5,
        label: 'Fire Form Shrine',
      },
      {
        id: 'atvc_07_teleporter',
        kind: 'teleporter',
        x: 27.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Caldera Waystone',
      },
      {
        id: 'atvc_07_save',
        kind: 'save_shrine',
        x: 4.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Altar Threshold Shrine',
      },
    ],
  },
);

// ============================================================================
// ATVC BOSS — Molten Caldera (28 x 14, mode: 'boss', bossId: 'magma_boar_king')
// Boss 2 (20 HP -> unlocks krunk_fire!) connecting westward into Isolated Desert!
// ============================================================================
const ATVC_BOSS = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........................#', // ty=10
    '#...........----...........#', // ty=9
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
    id: 'atvc_boss',
    name: 'Volcanic Altar — Molten Caldera',
    biome: 'ATVC',
    mode: 'boss',
    bossId: 'magma_boar_king',
    mapX: 10,
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
        targetRoomId: 'atvc_07',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Flame Shrine Antechamber',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'dsi_01',
        targetSpawnX: 41.0,
        targetSpawnY: 2.0,
        label: 'Isolated Desert',
      },
    ],
    enemies: [],
    coins: [
      { id: 'boss_magma_boar_king', x: 14.0, y: 10.6, kind: 'boss' },
      { id: 'atvc_boss_coin_2', x: 14.0, y: 6.5, kind: 'world' },
    ],
    crystals: [
      { id: 'atvc_boss_c1', x: 7.5, y: 6.8, value: 20 },
      { id: 'atvc_boss_c2', x: 20.5, y: 6.8, value: 20 },
      { id: 'atvc_boss_c3', x: 14.0, y: 10.8, value: 25 },
    ],
    props: [],
  },
);

export const ATVC_ROOMS: readonly RoomDef[] = [
  ATVC_01,
  ATVC_02,
  ATVC_03,
  ATVC_04,
  ATVC_05,
  ATVC_06,
  ATVC_07,
  ATVC_BOSS,
] as const;
