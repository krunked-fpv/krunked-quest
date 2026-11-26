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
// LAB 01 — Piston Entryway (38 x 15)
// Moving platforms, hydraulic crusher, overhead stone smash ceiling (S),
// and industrial automatons guarding the subterranean foundry entrance.
// ============================================================================
const LAB_01 = buildRoom(
  [
    '######################################', // ty=14
    '#....................................#', // ty=13
    '#....................................#', // ty=12
    '#............############............#', // ty=11
    '#............#..........#............#', // ty=10
    '#............####SSSS####............#', // ty=9  Rock Uppercut smash ceiling
    '#....................................#', // ty=8
    '#......----................----......#', // ty=7
    '#....................................#', // ty=6
    '#....................................#', // ty=5
    '.....................................#', // ty=4  tx=0 OPEN
    '.....................................#', // ty=3  tx=0 OPEN
    '.......O......................O......#', // ty=2  tx=0 OPEN
    '##########^^^^^^######^^^^^^##########', // ty=1  spike trenches
    '######################################', // ty=0
  ],
  {
    id: 'lab_01',
    name: 'Forgotten Labyrinth — Piston Entryway',
    biome: 'LAB',
    mode: 'normal',
    mapX: 4,
    mapY: -2,
    defaultSpawnX: 34.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 34.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'dsi_boss',
        targetSpawnX: 3.5,
        targetSpawnY: 2.0,
        label: 'Titan Bonepit',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'lab_02',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Crusher Corridor',
      },
    ],
    enemies: [
      { id: 'lab_01_e1', archetype: 'puncher_pig', x: 18.5, y: 2.0, patrolMinX: 16.5, patrolMaxX: 21.0 },
      { id: 'lab_01_e2', archetype: 'botmerang', x: 13.0, y: 7.5, patrolMinX: 9.0, patrolMaxX: 17.5 },
      { id: 'lab_01_e3', archetype: 'zeppelin', x: 25.0, y: 7.5, patrolMinX: 20.5, patrolMaxX: 29.0 },
    ],
    coins: [
      { id: 'lab_01_coin_1', x: 19.0, y: 10.4, kind: 'world' },
      { id: 'lab_01_coin_2', x: 8.5, y: 9.0, kind: 'world' },
      { id: 'lab_01_coin_combo', x: 29.0, y: 9.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'lab_01_c1', x: 13.0, y: 5.5, value: 20 },
      { id: 'lab_01_c2', x: 25.0, y: 5.5, value: 20 },
      { id: 'lab_01_c3', x: 17.5, y: 10.4, value: 25 },
      { id: 'lab_01_c4', x: 20.5, y: 10.4, value: 25 },
    ],
    props: [
      {
        id: 'lab_01_plat_1',
        kind: 'moving_platform',
        x: 11.5,
        y: 4.5,
        width: 2.5,
        height: 0.5,
        moveDx: 2.5,
        moveDy: 0,
        periodSec: 3.0,
      },
      {
        id: 'lab_01_plat_2',
        kind: 'moving_platform',
        x: 23.5,
        y: 4.5,
        width: 2.5,
        height: 0.5,
        moveDx: -2.5,
        moveDy: 0,
        periodSec: 3.0,
      },
      {
        id: 'lab_01_crusher_1',
        kind: 'crusher',
        x: 17.5,
        y: 5.8,
        width: 2.0,
        height: 1.5,
        moveDx: 0,
        moveDy: 2.0,
        periodSec: 2.8,
      },
      {
        id: 'lab_01_sign',
        kind: 'signpost',
        x: 31.0,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Forgotten Labyrinth: Time hydraulic crushers, flip target switches, and smash overhead basalt blocks!',
      },
    ],
  },
);

// ============================================================================
// LAB 02 — Crusher Corridor (40 x 15)
// Rhythmic hydraulic crushers, moving transport rails, and overhead stone cache!
// ============================================================================
const LAB_02 = buildRoom(
  [
    '########################################', // ty=14
    '#......................................#', // ty=13
    '#......................................#', // ty=12
    '#.............############.............#', // ty=11
    '#.............#..........#.............#', // ty=10
    '#.............###SSSSSS###.............#', // ty=9
    '#......................................#', // ty=8
    '#......----..................----......#', // ty=7
    '#......................................#', // ty=6
    '#......................................#', // ty=5
    '........................................', // ty=4  tx=0,39 OPEN
    '........................................', // ty=3  tx=0,39 OPEN
    '......O..........................O......', // ty=2  tx=0,39 OPEN
    '########################################', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'lab_02',
    name: 'Forgotten Labyrinth — Crusher Corridor',
    biome: 'LAB',
    mode: 'normal',
    mapX: 3,
    mapY: -2,
    defaultSpawnX: 37.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 39,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'lab_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Piston Entryway',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'lab_03',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Switchwork Vault',
      },
    ],
    enemies: [
      { id: 'lab_02_e1', archetype: 'spikeball', x: 14.5, y: 2.0, patrolMinX: 9.0, patrolMaxX: 20.0 },
      { id: 'lab_02_e2', archetype: 'floating_sword', x: 19.5, y: 7.5, patrolMinX: 13.0, patrolMaxX: 27.0 },
      { id: 'lab_02_e3', archetype: 'botmerang', x: 29.0, y: 10.0, patrolMinX: 25.0, patrolMaxX: 34.0 },
    ],
    coins: [
      { id: 'lab_02_coin_1', x: 20.0, y: 10.4, kind: 'world' },
      { id: 'lab_02_coin_2', x: 8.5, y: 9.0, kind: 'world' },
      { id: 'lab_02_coin_combo', x: 31.0, y: 9.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'lab_02_c1', x: 11.5, y: 4.5, value: 20 },
      { id: 'lab_02_c2', x: 20.0, y: 4.5, value: 20 },
      { id: 'lab_02_c3', x: 28.5, y: 4.5, value: 20 },
      { id: 'lab_02_c4', x: 18.0, y: 10.4, value: 25 },
      { id: 'lab_02_c5', x: 22.0, y: 10.4, value: 25 },
    ],
    props: [
      {
        id: 'lab_02_crusher_1',
        kind: 'crusher',
        x: 11.0,
        y: 5.5,
        width: 2.0,
        height: 1.5,
        moveDx: 0,
        moveDy: 2.2,
        periodSec: 2.6,
      },
      {
        id: 'lab_02_crusher_2',
        kind: 'crusher',
        x: 19.0,
        y: 5.5,
        width: 2.0,
        height: 1.5,
        moveDx: 0,
        moveDy: 2.2,
        periodSec: 3.1,
      },
      {
        id: 'lab_02_crusher_3',
        kind: 'crusher',
        x: 27.0,
        y: 5.5,
        width: 2.0,
        height: 1.5,
        moveDx: 0,
        moveDy: 2.2,
        periodSec: 2.6,
      },
      {
        id: 'lab_02_plat_1',
        kind: 'moving_platform',
        x: 18.5,
        y: 7.0,
        width: 3.0,
        height: 0.5,
        moveDx: 5.0,
        moveDy: 0,
        periodSec: 3.6,
      },
    ],
  },
);

// ============================================================================
// LAB 03 — Switchwork Vault (40 x 15, hasTeleporter: true)
// Target switch & locked target door guarding the central vault and hatch to
// Clockwork Cache (lab_05), plus Waystone Teleporter!
// ============================================================================
const LAB_03 = buildRoom(
  [
    '########################################', // ty=14
    '#......................................#', // ty=13
    '#......................................#', // ty=12
    '#..............----------..............#', // ty=11
    '#......................................#', // ty=10
    '#......----..................----......#', // ty=9
    '#......................................#', // ty=8
    '#............##############............#', // ty=7  central vault roof
    '#............#............#............#', // ty=6
    '#............#............#............#', // ty=5
    '........................................', // ty=4  tx=0,39 OPEN
    '........................................', // ty=3  tx=0,39 OPEN
    '......O..........................O......', // ty=2  tx=0,39 OPEN
    '########################################', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'lab_03',
    name: 'Forgotten Labyrinth — Switchwork Vault',
    biome: 'LAB',
    mode: 'normal',
    mapX: 2,
    mapY: -2,
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
        targetRoomId: 'lab_02',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Crusher Corridor',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'lab_04',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Gearworks Arena',
      },
      {
        dir: 'door',
        x: 19.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'lab_05',
        targetSpawnX: 13.5,
        targetSpawnY: 2.0,
        label: 'Clockwork Cache',
      },
    ],
    enemies: [
      { id: 'lab_03_e1', archetype: 'puncher_pig', x: 19.0, y: 8.0, patrolMinX: 13.5, patrolMaxX: 25.5 },
      { id: 'lab_03_e2', archetype: 'botmerang', x: 10.0, y: 11.0, patrolMinX: 6.5, patrolMaxX: 14.5 },
      { id: 'lab_03_e3', archetype: 'zeppelin', x: 29.5, y: 11.0, patrolMinX: 25.0, patrolMaxX: 34.0 },
    ],
    coins: [
      { id: 'lab_03_coin_1', x: 17.0, y: 3.4, kind: 'world' },
      { id: 'lab_03_coin_2', x: 23.0, y: 3.4, kind: 'world' },
      { id: 'lab_03_coin_combo', x: 20.0, y: 12.8, kind: 'combo' },
    ],
    crystals: [
      { id: 'lab_03_c1', x: 16.0, y: 5.0, value: 20 },
      { id: 'lab_03_c2', x: 24.0, y: 5.0, value: 20 },
      { id: 'lab_03_c3', x: 19.0, y: 12.4, value: 20 },
    ],
    props: [
      {
        id: 'lab_03_teleporter',
        kind: 'teleporter',
        x: 3.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Switchwork Waystone',
      },
      {
        id: 'lab_03_switch_1',
        kind: 'target_switch',
        x: 19.5,
        y: 12.0,
        width: 1.0,
        height: 1.0,
        targetId: 'lab_03_door_1',
        label: 'Vault Gate Switch',
      },
      {
        id: 'lab_03_door_1',
        kind: 'target_door',
        x: 26.0,
        y: 2.0,
        width: 1.0,
        height: 3.0,
        label: 'Vault Bulkhead',
      },
    ],
  },
);

// ============================================================================
// LAB 04 — Gearworks Arena (28 x 14, mode: 'arena')
// Moving platforms & crusher factory combat room with elevated chest!
// ============================================================================
const LAB_04 = buildRoom(
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
    '#........................... ', // ty=4  tx=27 OPEN
    '#........................... ', // ty=3  tx=27 OPEN
    '#.....O..............O......', // ty=2  tx=27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ].map((row) => row.trimEnd()),
  {
    id: 'lab_04',
    name: 'Forgotten Labyrinth — Gearworks Arena',
    biome: 'LAB',
    mode: 'arena',
    mapX: 1,
    mapY: -2,
    defaultSpawnX: 25.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'lab_03',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Switchwork Vault',
      },
      {
        dir: 'door',
        x: 3.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'lab_06',
        targetSpawnX: 31.5,
        targetSpawnY: 2.0,
        label: 'Basalt Shrine',
      },
    ],
    enemies: [
      { id: 'lab_04_e1', archetype: 'spikeball', x: 13.5, y: 2.0, patrolMinX: 8.5, patrolMaxX: 19.5 },
      { id: 'lab_04_e2', archetype: 'botmerang', x: 8.5, y: 9.5, patrolMinX: 4.5, patrolMaxX: 13.0 },
      { id: 'lab_04_e3', archetype: 'floating_sword', x: 19.0, y: 9.5, patrolMinX: 14.5, patrolMaxX: 23.5 },
      { id: 'lab_04_e4', archetype: 'zeppelin', x: 14.0, y: 6.5, patrolMinX: 9.5, patrolMaxX: 18.5 },
    ],
    coins: [
      { id: 'lab_04_coin_1', x: 7.5, y: 9.0, kind: 'world' },
      { id: 'lab_04_coin_2', x: 20.5, y: 9.0, kind: 'world' },
      { id: 'lab_04_coin_chest', x: 14.0, y: 11.6, kind: 'chest' },
      { id: 'lab_04_coin_combo', x: 14.0, y: 4.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'lab_04_c1', x: 10.5, y: 5.0, value: 20 },
      { id: 'lab_04_c2', x: 17.5, y: 5.0, value: 20 },
      { id: 'lab_04_c3', x: 14.0, y: 12.4, value: 25 },
    ],
    props: [
      {
        id: 'lab_04_plat_1',
        kind: 'moving_platform',
        x: 12.8,
        y: 4.5,
        width: 2.5,
        height: 0.5,
        moveDx: 3.0,
        moveDy: 0,
        periodSec: 3.2,
      },
      {
        id: 'lab_04_chest',
        kind: 'chest',
        x: 13.5,
        y: 11.0,
        width: 1.0,
        height: 0.85,
        coinId: 'lab_04_coin_chest',
        label: 'Gearworks Bounty',
      },
    ],
  },
);

// ============================================================================
// LAB 05 — Clockwork Cache (28 x 14, isSecret: true)
// Secret foundry room with StoneOverhead (S) vault, target switch, & chest!
// ============================================================================
const LAB_05 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#..........................#', // ty=9
    '#....####SSSS..SSSS####....#', // ty=8
    '#..........................#', // ty=7
    '#....----..........----....#', // ty=6
    '#..........................#', // ty=5
    '#..........................#', // ty=4
    '#..........................#', // ty=3
    '#.......O..........O.......#', // ty=2
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'lab_05',
    name: 'Forgotten Labyrinth — Clockwork Cache',
    biome: 'LAB',
    mode: 'normal',
    isSecret: true,
    mapX: 2,
    mapY: -3,
    defaultSpawnX: 13.5,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 13.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'lab_03',
        targetSpawnX: 19.5,
        targetSpawnY: 2.0,
        label: 'Switchwork Vault',
      },
    ],
    enemies: [
      { id: 'lab_05_e1', archetype: 'floating_sword', x: 9.0, y: 10.5, patrolMinX: 5.0, patrolMaxX: 14.0 },
      { id: 'lab_05_e2', archetype: 'zeppelin', x: 19.0, y: 10.5, patrolMinX: 14.0, patrolMaxX: 23.0 },
    ],
    coins: [
      { id: 'lab_05_coin_1', x: 7.0, y: 10.5, kind: 'world' },
      { id: 'lab_05_coin_2', x: 21.0, y: 10.5, kind: 'world' },
      { id: 'lab_05_coin_chest', x: 23.5, y: 2.6, kind: 'chest' },
      { id: 'lab_05_coin_combo', x: 14.0, y: 11.8, kind: 'combo' },
    ],
    crystals: [
      { id: 'lab_05_c1', x: 7.0, y: 7.5, value: 25 },
      { id: 'lab_05_c2', x: 21.0, y: 7.5, value: 25 },
      { id: 'lab_05_c3', x: 14.0, y: 12.2, value: 30 },
    ],
    props: [
      {
        id: 'lab_05_plat_1',
        kind: 'moving_platform',
        x: 12.8,
        y: 5.0,
        width: 2.5,
        height: 0.5,
        moveDx: 0,
        moveDy: 2.2,
        periodSec: 3.0,
      },
      {
        id: 'lab_05_chest',
        kind: 'chest',
        x: 23.0,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'lab_05_coin_chest',
        label: 'Clockwork Relic Chest',
      },
    ],
  },
);

// ============================================================================
// LAB 06 — Basalt Shrine (36 x 15, hasTeleporter: true)
// Houses the Rock Form Totem (krunk_rock), StoneOverhead (S) ceiling test,
// Save Shrine, and Waystone Teleporter right before Mecha Bull!
// ============================================================================
const LAB_06 = buildRoom(
  [
    '####################################', // ty=14
    '#..................................#', // ty=13
    '#..................................#', // ty=12
    '#............####SSSS####..........#', // ty=11
    '#..................................#', // ty=10
    '#..................................#', // ty=9
    '#.....----....----------....----...#', // ty=8
    '#..................................#', // ty=7
    '#..................................#', // ty=6
    '#..................................#', // ty=5
    '...................................#', // ty=4  tx=0 OPEN
    '...................................#', // ty=3  tx=0 OPEN
    '........O..................O.......#', // ty=2  tx=0 OPEN
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'lab_06',
    name: 'Forgotten Labyrinth — Basalt Shrine',
    biome: 'LAB',
    mode: 'normal',
    mapX: 1,
    mapY: -3,
    defaultSpawnX: 31.5,
    defaultSpawnY: 2.0,
    hasTeleporter: true,
    exits: [
      {
        dir: 'door',
        x: 31.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'lab_04',
        targetSpawnX: 3.0,
        targetSpawnY: 2.0,
        label: 'Gearworks Arena',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'lab_boss',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Foundry Core',
      },
    ],
    enemies: [
      { id: 'lab_06_e1', archetype: 'puncher_pig', x: 18.0, y: 2.0, patrolMinX: 12.0, patrolMaxX: 24.0 },
      { id: 'lab_06_e2', archetype: 'botmerang', x: 12.5, y: 6.5, patrolMinX: 8.5, patrolMaxX: 17.0 },
      { id: 'lab_06_e3', archetype: 'floating_sword', x: 23.5, y: 6.5, patrolMinX: 19.0, patrolMaxX: 27.5 },
    ],
    coins: [
      { id: 'lab_06_coin_1', x: 19.0, y: 12.8, kind: 'world' },
      { id: 'lab_06_coin_2', x: 7.5, y: 10.0, kind: 'world' },
      { id: 'lab_06_coin_combo', x: 30.0, y: 10.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'lab_06_c1', x: 17.5, y: 12.6, value: 25 },
      { id: 'lab_06_c2', x: 20.5, y: 12.6, value: 25 },
      { id: 'lab_06_c3', x: 14.0, y: 4.5, value: 20 },
    ],
    props: [
      {
        id: 'lab_06_rock_totem',
        kind: 'form_totem',
        formId: 'krunk_rock',
        x: 18.5,
        y: 9.0,
        width: 1.0,
        height: 1.5,
        label: 'Rock Form Shrine',
      },
      {
        id: 'lab_06_teleporter',
        kind: 'teleporter',
        x: 27.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Basalt Waystone',
      },
      {
        id: 'lab_06_save',
        kind: 'save_shrine',
        x: 4.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Foundry Threshold Shrine',
      },
    ],
  },
);

// ============================================================================
// LAB BOSS — Foundry Core (28 x 14, mode: 'boss', bossId: 'mecha_bull')
// Boss 3 (20 HP -> unlocks krunk_rock!) connecting westward into Atomic Temple!
// ============================================================================
const LAB_BOSS = buildRoom(
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
    id: 'lab_boss',
    name: 'Forgotten Labyrinth — Foundry Core',
    biome: 'LAB',
    mode: 'boss',
    bossId: 'mecha_bull',
    mapX: 0,
    mapY: -3,
    defaultSpawnX: 25.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'lab_06',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Basalt Shrine',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'temp_01',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Atomic Temple',
      },
    ],
    enemies: [],
    coins: [
      { id: 'boss_mecha_bull', x: 14.0, y: 10.6, kind: 'boss' },
      { id: 'lab_boss_coin_2', x: 14.0, y: 6.5, kind: 'world' },
    ],
    crystals: [
      { id: 'lab_boss_c1', x: 7.5, y: 6.8, value: 20 },
      { id: 'lab_boss_c2', x: 20.5, y: 6.8, value: 20 },
      { id: 'lab_boss_c3', x: 14.0, y: 10.8, value: 25 },
    ],
    props: [],
  },
);

export const LAB_ROOMS: readonly RoomDef[] = [
  LAB_01,
  LAB_02,
  LAB_03,
  LAB_04,
  LAB_05,
  LAB_06,
  LAB_BOSS,
] as const;
