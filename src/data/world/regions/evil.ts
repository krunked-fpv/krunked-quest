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
// EVIL 01 — Eclipse Threshold (36 x 15, hasTeleporter: true)
// Grand Citadel foyer connecting Subrosa Haven, Atomic Temple's Sky-Lift,
// and the Nightmare Spire ascent!
// ============================================================================
const EVIL_01 = buildRoom(
  [
    '####################################', // ty=14
    '#..................................#', // ty=13
    '#..................................#', // ty=12
    '#.............--------.............#', // ty=11
    '#........GGGG..........GGGG........#', // ty=10
    '#........GGGG..........GGGG........#', // ty=9
    '#...----.GGGG..------..GGGG.----...#', // ty=8
    '#........GGGG..........GGGG........#', // ty=7
    '#........GGGG..........GGGG........#', // ty=6
    '#........GGGG..........GGGG........#', // ty=5
    '#........GGGG..........GGGG........#', // ty=4
    '#........GGGG..........GGGG........#', // ty=3
    '#......O.GGGG..........GGGG.O......#', // ty=2
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'evil_01',
    name: 'Nightmare Spire — Eclipse Threshold',
    biome: 'EVIL',
    mode: 'normal',
    mapX: 0,
    mapY: 1,
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
        targetRoomId: 'hub_haven',
        targetSpawnX: 27.5,
        targetSpawnY: 10.0,
        label: 'Subrosa Haven',
      },
      {
        dir: 'door',
        x: 30.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'temp_boss',
        targetSpawnX: 4.0,
        targetSpawnY: 2.0,
        label: 'Volt Sanctum Lift',
      },
      {
        dir: 'door',
        x: 17.5,
        y: 12.0,
        width: 1.5,
        height: 2.0,
        targetRoomId: 'evil_02',
        targetSpawnX: 19.0,
        targetSpawnY: 2.0,
        label: 'Bramble & Volt Gauntlet',
      },
    ],
    enemies: [
      { id: 'evil_01_e1', archetype: 'ghost_pig', x: 18.0, y: 2.0, patrolMinX: 13.5, patrolMaxX: 22.5 },
      { id: 'evil_01_e2', archetype: 'bombalon', x: 11.0, y: 9.5, patrolMinX: 7.5, patrolMaxX: 14.5 },
      { id: 'evil_01_e3', archetype: 'atom_eye', x: 25.0, y: 9.5, patrolMinX: 21.5, patrolMaxX: 28.5 },
      { id: 'evil_01_e4', archetype: 'ghost_crow', x: 18.0, y: 7.0, patrolMinX: 14.0, patrolMaxX: 22.0 },
    ],
    coins: [
      { id: 'evil_01_coin_1', x: 6.0, y: 10.0, kind: 'world' },
      { id: 'evil_01_coin_2', x: 30.0, y: 10.0, kind: 'world' },
      { id: 'evil_01_coin_combo', x: 18.0, y: 10.2, kind: 'combo' },
    ],
    crystals: [
      { id: 'evil_01_c1', x: 11.0, y: 6.5, value: 25 },
      { id: 'evil_01_c2', x: 25.0, y: 6.5, value: 25 },
      { id: 'evil_01_c3', x: 18.0, y: 9.6, value: 25 },
    ],
    props: [
      {
        id: 'evil_01_teleporter',
        kind: 'teleporter',
        x: 13.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Eclipse Waystone',
      },
      {
        id: 'evil_01_save',
        kind: 'save_shrine',
        x: 22.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Spire Foyer Shrine',
      },
      {
        id: 'evil_01_volt_1',
        kind: 'volt_node',
        x: 11.0,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Eclipse Volt Node',
      },
      {
        id: 'evil_01_volt_2',
        kind: 'volt_node',
        x: 24.5,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Eclipse Volt Node',
      },
    ],
  },
);

// ============================================================================
// EVIL 02 — Bramble & Volt Gauntlet (42 x 16)
// Combines vines (V), bounce pads (O), antigrav (G), Volt Nodes, moving
// platforms, and a cracked western secret wall (?) -> Shadow Reliquary (evil_04)!
// ============================================================================
const EVIL_02 = buildRoom(
  [
    '##########################################', // ty=15
    '#........................................#', // ty=14
    '#........................................#', // ty=13
    '#...........GGGGGG......GGGGGG...........#', // ty=12
    '#......----.GGGGGG.----.GGGGGG.----......#', // ty=11
    '#...........GGGGGG......GGGGGG...........#', // ty=10
    '#....#V.....GGGGGG......GGGGGG.....V#....#', // ty=9
    '#....#V.....GGGGGG......GGGGGG.....V#....#', // ty=8
    '#....#V.....GGGGGG......GGGGGG.....V#....#', // ty=7
    '#....#V............................V#....#', // ty=6
    '#....#V............................V#....#', // ty=5
    '...?......................................', // ty=4  tx=0,41 OPEN; tx=3 secret wall
    '...?......................................', // ty=3  tx=0,41 OPEN
    '...?....O......................O..........', // ty=2  tx=0,41 OPEN
    '##########^^^^^^########^^^^^^############', // ty=1
    '##########################################', // ty=0
  ],
  {
    id: 'evil_02',
    name: 'Nightmare Spire — Bramble & Volt Gauntlet',
    biome: 'EVIL',
    mode: 'normal',
    mapX: 0,
    mapY: 2,
    defaultSpawnX: 19.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 19.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'evil_01',
        targetSpawnX: 17.5,
        targetSpawnY: 12.0,
        label: 'Eclipse Threshold',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'evil_04',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Shadow Reliquary',
      },
      {
        dir: 'right',
        x: 41,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'evil_03',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Antigrav Bastion',
      },
    ],
    enemies: [
      { id: 'evil_02_e1', archetype: 'neural_spider', x: 14.0, y: 10.5, patrolMinX: 10.0, patrolMaxX: 18.0 },
      { id: 'evil_02_e2', archetype: 'floating_sword', x: 27.5, y: 10.5, patrolMinX: 23.0, patrolMaxX: 31.5 },
      { id: 'evil_02_e3', archetype: 'ghost_crow', x: 21.0, y: 13.0, patrolMinX: 16.0, patrolMaxX: 26.0 },
      { id: 'evil_02_e4', archetype: 'ghost_owl', x: 33.5, y: 7.5, patrolMinX: 29.0, patrolMaxX: 38.0 },
    ],
    coins: [
      { id: 'evil_02_coin_1', x: 9.0, y: 12.6, kind: 'world' },
      { id: 'evil_02_coin_2', x: 33.0, y: 12.6, kind: 'world' },
      { id: 'evil_02_coin_combo', x: 21.0, y: 12.8, kind: 'combo' },
    ],
    crystals: [
      { id: 'evil_02_c1', x: 14.5, y: 7.5, value: 25 },
      { id: 'evil_02_c2', x: 27.0, y: 7.5, value: 25 },
      { id: 'evil_02_c3', x: 21.0, y: 13.4, value: 25 },
    ],
    props: [
      {
        id: 'evil_02_plat_1',
        kind: 'moving_platform',
        x: 12.5,
        y: 5.0,
        width: 2.5,
        height: 0.5,
        moveDx: 2.5,
        moveDy: 0,
        periodSec: 3.0,
      },
      {
        id: 'evil_02_plat_2',
        kind: 'moving_platform',
        x: 26.5,
        y: 5.0,
        width: 2.5,
        height: 0.5,
        moveDx: -2.5,
        moveDy: 0,
        periodSec: 3.0,
      },
      {
        id: 'evil_02_volt_1',
        kind: 'volt_node',
        x: 14.5,
        y: 12.8,
        width: 0.8,
        height: 0.8,
        label: 'Gauntlet Node West',
      },
      {
        id: 'evil_02_volt_2',
        kind: 'volt_node',
        x: 26.8,
        y: 12.8,
        width: 0.8,
        height: 0.8,
        label: 'Gauntlet Node East',
      },
    ],
  },
);

// ============================================================================
// EVIL 03 — Antigrav Bastion (28 x 14, mode: 'arena', hasTeleporter: true)
// High-octane final citadel arena mixing antigrav, Volt Nodes, moving platform,
// and Bastion Waystone Teleporter!
// ============================================================================
const EVIL_03 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#....GGGG..........GGGG....#', // ty=9
    '#....GGGG..........GGGG....#', // ty=8
    '#....GGGG..------..GGGG....#', // ty=7
    '#....GGGG..........GGGG....#', // ty=6
    '#....GGGG..........GGGG....#', // ty=5
    '.....GGGG..........GGGG....#', // ty=4  tx=0 OPEN
    '.....GGGG..........GGGG....#', // ty=3  tx=0 OPEN
    '.....O................O....#', // ty=2  tx=0 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'evil_03',
    name: 'Nightmare Spire — Antigrav Bastion',
    biome: 'EVIL',
    mode: 'arena',
    mapX: 1,
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
        targetRoomId: 'evil_02',
        targetSpawnX: 39.0,
        targetSpawnY: 2.0,
        label: 'Bramble & Volt Gauntlet',
      },
      {
        dir: 'door',
        x: 13.5,
        y: 11.0,
        width: 1.5,
        height: 2.0,
        targetRoomId: 'evil_05',
        targetSpawnX: 4.0,
        targetSpawnY: 2.0,
        label: 'Sovereign Ascent',
      },
    ],
    enemies: [
      { id: 'evil_03_e1', archetype: 'ghost_pig', x: 13.5, y: 2.0, patrolMinX: 8.5, patrolMaxX: 19.5 },
      { id: 'evil_03_e2', archetype: 'mystic_wheel', x: 13.5, y: 8.0, patrolMinX: 11.2, patrolMaxX: 16.0 },
      { id: 'evil_03_e3', archetype: 'launcher_pig', x: 19.5, y: 2.0, patrolMinX: 17.5, patrolMaxX: 20.8 },
      { id: 'evil_03_e4', archetype: 'zeppelin', x: 8.0, y: 9.5, patrolMinX: 4.5, patrolMaxX: 12.5 },
      { id: 'evil_03_e5', archetype: 'atom_eye', x: 19.5, y: 9.5, patrolMinX: 15.0, patrolMaxX: 23.5 },
      { id: 'evil_03_e6', archetype: 'ghost_owl', x: 14.0, y: 5.5, patrolMinX: 9.0, patrolMaxX: 19.0 },
    ],
    coins: [
      { id: 'evil_03_coin_1', x: 7.0, y: 11.2, kind: 'world' },
      { id: 'evil_03_coin_2', x: 21.0, y: 11.2, kind: 'world' },
      { id: 'evil_03_coin_combo', x: 14.0, y: 5.2, kind: 'combo' },
    ],
    crystals: [
      { id: 'evil_03_c1', x: 7.0, y: 7.5, value: 25 },
      { id: 'evil_03_c2', x: 21.0, y: 7.5, value: 25 },
      { id: 'evil_03_c3', x: 14.0, y: 9.5, value: 30 },
    ],
    props: [
      {
        id: 'evil_03_teleporter',
        kind: 'teleporter',
        x: 24.0,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Bastion Waystone',
      },
      {
        id: 'evil_03_plat_1',
        kind: 'moving_platform',
        x: 12.8,
        y: 4.2,
        width: 2.5,
        height: 0.5,
        moveDx: 3.5,
        moveDy: 0,
        periodSec: 3.0,
      },
      {
        id: 'evil_03_volt_1',
        kind: 'volt_node',
        x: 10.5,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Bastion Volt Node',
      },
      {
        id: 'evil_03_volt_2',
        kind: 'volt_node',
        x: 16.8,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Bastion Volt Node',
      },
    ],
  },
);

// ============================================================================
// EVIL 04 — Shadow Reliquary (28 x 14, isSecret: true)
// Secret citadel reliquary behind Bramble & Volt Gauntlet's hidden west wall!
// ============================================================================
const EVIL_04 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#....#V..GGGGGGGGGG..V#....#', // ty=9
    '#....#V..GGGGGGGGGG..V#....#', // ty=8
    '#....#V..GGGGGGGGGG..V#....#', // ty=7
    '#....#V..............V#....#', // ty=6
    '#....#V..............V#....#', // ty=5
    '#........................... ', // ty=4  tx=27 OPEN
    '#........................... ', // ty=3  tx=27 OPEN
    '#.......O..........O........', // ty=2  tx=27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ].map((row) => row.trimEnd()),
  {
    id: 'evil_04',
    name: 'Nightmare Spire — Shadow Reliquary',
    biome: 'EVIL',
    mode: 'normal',
    isSecret: true,
    mapX: -1,
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
        targetRoomId: 'evil_02',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Bramble & Volt Gauntlet',
      },
    ],
    enemies: [
      { id: 'evil_04_e1', archetype: 'ghost_pig', x: 13.5, y: 2.0, patrolMinX: 9.0, patrolMaxX: 18.0 },
      { id: 'evil_04_e2', archetype: 'floating_sword', x: 13.5, y: 8.5, patrolMinX: 9.0, patrolMaxX: 18.0 },
      { id: 'evil_04_e3', archetype: 'ghost_crow', x: 9.5, y: 11.5, patrolMinX: 5.5, patrolMaxX: 13.5 },
      { id: 'evil_04_e4', archetype: 'ghost_owl', x: 18.5, y: 11.5, patrolMinX: 14.5, patrolMaxX: 22.5 },
    ],
    coins: [
      { id: 'evil_04_coin_1', x: 14.0, y: 11.8, kind: 'world' },
      { id: 'evil_04_coin_2', x: 14.0, y: 6.5, kind: 'world' },
      { id: 'evil_04_coin_chest', x: 3.5, y: 2.6, kind: 'chest' },
      { id: 'evil_04_coin_combo', x: 3.5, y: 10.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'evil_04_c1', x: 11.0, y: 8.5, value: 30 },
      { id: 'evil_04_c2', x: 17.0, y: 8.5, value: 30 },
      { id: 'evil_04_c3', x: 14.0, y: 12.4, value: 35 },
    ],
    props: [
      {
        id: 'evil_04_chest',
        kind: 'chest',
        x: 3.0,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'evil_04_coin_chest',
        label: 'Eclipse Reliquary Chest',
      },
      {
        id: 'evil_04_volt_1',
        kind: 'volt_node',
        x: 13.6,
        y: 8.5,
        width: 0.8,
        height: 0.8,
        label: 'Reliquary Node',
      },
    ],
  },
);

// ============================================================================
// EVIL 05 — Sovereign Ascent (40 x 16, hasTeleporter: true)
// Ultimate spire gauntlet combining vines, bounce blocks, antigrav, Volt Nodes,
// moving platforms, Save Shrine, and Throne Waystone before Boss 5 & Boss 6!
// ============================================================================
const EVIL_05 = buildRoom(
  [
    '########################################', // ty=15
    '#......................................#', // ty=14
    '#......................................#', // ty=13
    '#..........GGGG..........GGGG..........#', // ty=12
    '#.....----.GGGG..------..GGGG.----.....#', // ty=11
    '#..........GGGG..........GGGG..........#', // ty=10
    '#.......#V.GGGG..........GGGG.V#.......#', // ty=9
    '#.......#V.GGGG..........GGGG.V#.......#', // ty=8
    '#.......#V.GGGG..........GGGG.V#.......#', // ty=7
    '#.......#V....................V#.......#', // ty=6
    '#.......#V....................V#.......#', // ty=5
    '#.......................................', // ty=4  tx=39 OPEN
    '#.......................................', // ty=3  tx=39 OPEN
    '#........O..........O..........O........', // ty=2  tx=39 OPEN
    '##########^^^^^^########^^^^^^##########', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'evil_05',
    name: 'Nightmare Spire — Sovereign Ascent',
    biome: 'EVIL',
    mode: 'normal',
    mapX: 1,
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
        targetRoomId: 'evil_03',
        targetSpawnX: 13.5,
        targetSpawnY: 11.0,
        label: 'Antigrav Bastion',
      },
      {
        dir: 'right',
        x: 39,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'evil_duel',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Hall of Mirrors',
      },
    ],
    enemies: [
      { id: 'evil_05_e1', archetype: 'ghost_pig', x: 17.5, y: 2.0, patrolMinX: 16.5, patrolMaxX: 19.0 },
      { id: 'evil_05_e2', archetype: 'eagle_cannon', x: 14.0, y: 10.5, patrolMinX: 10.0, patrolMaxX: 18.0 },
      { id: 'evil_05_e3', archetype: 'floating_sword', x: 26.0, y: 10.5, patrolMinX: 22.0, patrolMaxX: 30.0 },
      { id: 'evil_05_e4', archetype: 'zeppelin', x: 20.0, y: 13.5, patrolMinX: 15.0, patrolMaxX: 25.0 },
      { id: 'evil_05_e5', archetype: 'atom_eye', x: 12.5, y: 6.5, patrolMinX: 9.5, patrolMaxX: 16.5 },
      { id: 'evil_05_e6', archetype: 'ghost_owl', x: 27.5, y: 6.5, patrolMinX: 23.5, patrolMaxX: 30.5 },
    ],
    coins: [
      { id: 'evil_05_coin_1', x: 20.0, y: 12.8, kind: 'world' },
      { id: 'evil_05_coin_2', x: 8.0, y: 12.6, kind: 'world' },
      { id: 'evil_05_coin_combo', x: 32.0, y: 12.6, kind: 'combo' },
    ],
    crystals: [
      { id: 'evil_05_c1', x: 13.0, y: 8.5, value: 25 },
      { id: 'evil_05_c2', x: 27.0, y: 8.5, value: 25 },
      { id: 'evil_05_c3', x: 20.0, y: 13.2, value: 30 },
    ],
    props: [
      {
        id: 'evil_05_teleporter',
        kind: 'teleporter',
        x: 32.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Throne Waystone',
      },
      {
        id: 'evil_05_save',
        kind: 'save_shrine',
        x: 36.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Sovereign Threshold Shrine',
      },
      {
        id: 'evil_05_plat_1',
        kind: 'moving_platform',
        x: 18.5,
        y: 6.0,
        width: 3.0,
        height: 0.5,
        moveDx: 4.5,
        moveDy: 0,
        periodSec: 3.2,
      },
      {
        id: 'evil_05_volt_1',
        kind: 'volt_node',
        x: 13.0,
        y: 12.8,
        width: 0.8,
        height: 0.8,
        label: 'Ascent Volt Node West',
      },
      {
        id: 'evil_05_volt_2',
        kind: 'volt_node',
        x: 26.2,
        y: 12.8,
        width: 0.8,
        height: 0.8,
        label: 'Ascent Volt Node East',
      },
    ],
  },
);

// ============================================================================
// EVIL DUEL — Hall of Mirrors (28 x 14, mode: 'boss', bossId: 'shadow_doppelganger')
// Boss 5 (30 HP) — Dark mirror rival duel guarding the Eclipse Throne!
// ============================================================================
const EVIL_DUEL = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........................#', // ty=10
    '#..........------..........#', // ty=9
    '#.........GGGGGGGG.........#', // ty=8
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
    id: 'evil_duel',
    name: 'Nightmare Spire — Hall of Mirrors',
    biome: 'EVIL',
    mode: 'boss',
    bossId: 'shadow_doppelganger',
    mapX: 2,
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
        targetRoomId: 'evil_05',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Sovereign Ascent',
      },
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'evil_boss',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Eclipse Throne',
      },
    ],
    enemies: [],
    coins: [
      { id: 'boss_shadow_doppelganger', x: 14.0, y: 10.6, kind: 'boss' },
      { id: 'evil_duel_coin_2', x: 14.0, y: 6.5, kind: 'world' },
    ],
    crystals: [
      { id: 'evil_duel_c1', x: 7.5, y: 6.8, value: 25 },
      { id: 'evil_duel_c2', x: 20.5, y: 6.8, value: 25 },
      { id: 'evil_duel_c3', x: 14.0, y: 11.0, value: 30 },
    ],
    props: [
      {
        id: 'evil_duel_volt_1',
        kind: 'volt_node',
        x: 8.5,
        y: 10.8,
        width: 0.8,
        height: 0.8,
        label: 'Mirror Volt Node',
      },
      {
        id: 'evil_duel_volt_2',
        kind: 'volt_node',
        x: 18.7,
        y: 10.8,
        width: 0.8,
        height: 0.8,
        label: 'Mirror Volt Node',
      },
    ],
  },
);

// ============================================================================
// EVIL BOSS — Eclipse Throne (30 x 15, mode: 'boss', bossId: 'nightmare_sovereign')
// Final Boss 6 (30 HP -> unlocks krunk_shadow & Victory!)
// ============================================================================
const EVIL_BOSS = buildRoom(
  [
    '##############################', // ty=14
    '#............................#', // ty=13
    '#............................#', // ty=12
    '#............................#', // ty=11
    '#...........------...........#', // ty=10
    '#...GGG................GGG...#', // ty=9
    '#...GGG................GGG...#', // ty=8
    '#...GGG................GGG...#', // ty=7
    '#...GGG.----......----.GGG...#', // ty=6
    '#............................#', // ty=5
    '.............................#', // ty=4  tx=0 OPEN
    '.............................#', // ty=3  tx=0 OPEN
    '.....O..................O....#', // ty=2  tx=0 OPEN
    '##############################', // ty=1
    '##############################', // ty=0
  ],
  {
    id: 'evil_boss',
    name: 'Nightmare Spire — Eclipse Throne',
    biome: 'EVIL',
    mode: 'boss',
    bossId: 'nightmare_sovereign',
    mapX: 3,
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
        targetRoomId: 'evil_duel',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Hall of Mirrors',
      },
      {
        dir: 'door',
        x: 25.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'hub_haven',
        targetSpawnX: 27.5,
        targetSpawnY: 10.0,
        label: 'Return to Subrosa Haven',
      },
    ],
    enemies: [],
    coins: [
      { id: 'boss_nightmare_sovereign', x: 15.0, y: 11.8, kind: 'boss' },
      { id: 'evil_boss_coin_2', x: 9.5, y: 8.0, kind: 'world' },
      { id: 'evil_boss_coin_3', x: 20.5, y: 8.0, kind: 'world' },
    ],
    crystals: [
      { id: 'evil_boss_c1', x: 9.5, y: 7.4, value: 30 },
      { id: 'evil_boss_c2', x: 20.5, y: 7.4, value: 30 },
      { id: 'evil_boss_c3', x: 15.0, y: 11.6, value: 40 },
    ],
    props: [
      {
        id: 'evil_boss_volt_1',
        kind: 'volt_node',
        x: 9.5,
        y: 11.6,
        width: 0.8,
        height: 0.8,
        label: 'Throne Volt Anchor',
      },
      {
        id: 'evil_boss_volt_2',
        kind: 'volt_node',
        x: 19.7,
        y: 11.6,
        width: 0.8,
        height: 0.8,
        label: 'Throne Volt Anchor',
      },
    ],
  },
);

export const EVIL_ROOMS: readonly RoomDef[] = [
  EVIL_01,
  EVIL_02,
  EVIL_03,
  EVIL_04,
  EVIL_05,
  EVIL_DUEL,
  EVIL_BOSS,
] as const;
