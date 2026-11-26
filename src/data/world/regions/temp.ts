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
// TEMP 01 — Antigrav Atrium (40 x 15)
// Towering antigravity fields (G) and aerial Volt Target Nodes (volt_node).
// ============================================================================
const TEMP_01 = buildRoom(
  [
    '########################################', // ty=14
    '#......................................#', // ty=13
    '#......................................#', // ty=12
    '#.........GGGGGG........GGGGGG.........#', // ty=11
    '#.........GGGGGG.------.GGGGGG.........#', // ty=10
    '#.........GGGGGG........GGGGGG.........#', // ty=9
    '#.....----GGGGGG........GGGGGG----.....#', // ty=8
    '#.........GGGGGG........GGGGGG.........#', // ty=7
    '#.........GGGGGG........GGGGGG.........#', // ty=6
    '#.........GGGGGG........GGGGGG.........#', // ty=5
    '..........GGGGGG........GGGGGG..........', // ty=4  tx=0,39 OPEN
    '..........GGGGGG........GGGGGG..........', // ty=3  tx=0,39 OPEN
    '.......O..GGGGGG........GGGGGG..O.......', // ty=2  tx=0,39 OPEN
    '########################################', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'temp_01',
    name: 'Atomic Temple — Antigrav Atrium',
    biome: 'TEMP',
    mode: 'normal',
    mapX: -1,
    mapY: -3,
    defaultSpawnX: 37.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 39,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'lab_boss',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Foundry Core',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'temp_02',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Volt Conduit',
      },
    ],
    enemies: [
      { id: 'temp_01_e1', archetype: 'mummy', x: 19.5, y: 2.0, patrolMinX: 16.5, patrolMaxX: 23.0 },
      { id: 'temp_01_e2', archetype: 'atom_eye', x: 13.0, y: 9.5, patrolMinX: 9.5, patrolMaxX: 16.5 },
      { id: 'temp_01_e3', archetype: 'atom_eye', x: 26.5, y: 9.5, patrolMinX: 23.5, patrolMaxX: 30.0 },
      { id: 'temp_01_e4', archetype: 'scavenger', x: 19.5, y: 11.0, patrolMinX: 17.2, patrolMaxX: 22.0 },
    ],
    coins: [
      { id: 'temp_01_coin_1', x: 20.0, y: 12.8, kind: 'world' },
      { id: 'temp_01_coin_2', x: 7.5, y: 10.0, kind: 'world' },
      { id: 'temp_01_coin_combo', x: 32.5, y: 10.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'temp_01_c1', x: 13.0, y: 6.5, value: 20 },
      { id: 'temp_01_c2', x: 26.5, y: 6.5, value: 20 },
      { id: 'temp_01_c3', x: 20.0, y: 8.5, value: 25 },
    ],
    props: [
      {
        id: 'temp_01_volt_1',
        kind: 'volt_node',
        x: 12.5,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Atrium Volt Node',
      },
      {
        id: 'temp_01_volt_2',
        kind: 'volt_node',
        x: 26.5,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Atrium Volt Node',
      },
      {
        id: 'temp_01_sign',
        kind: 'signpost',
        x: 34.0,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Atomic Temple: Soar across antigravity beams and chain Volt Target Nodes toward the Storm Sanctum!',
      },
    ],
  },
);

// ============================================================================
// TEMP 02 — Volt Conduit (40 x 15)
// Volt Node chain spanning antigrav trench, lift up to Plasma Relay (temp_03),
// and western gateway to Gilded Reactor Vault (temp_05)!
// ============================================================================
const TEMP_02 = buildRoom(
  [
    '########################################', // ty=14
    '#......................................#', // ty=13
    '#......................................#', // ty=12
    '#..............----------..............#', // ty=11
    '#.........GGGGGGGGGGGGGGGGGGGG.........#', // ty=10
    '#.........GGGGGGGGGGGGGGGGGGGG.........#', // ty=9
    '#.....----GGGGGGGGGGGGGGGGGGGG----.....#', // ty=8
    '#.........GGGGGGGGGGGGGGGGGGGG.........#', // ty=7
    '#.........GGGGGGGGGGGGGGGGGGGG.........#', // ty=6
    '#.........GGGGGGGGGGGGGGGGGGGG.........#', // ty=5
    '..........GGGGGGGGGGGGGGGGGGGG..........', // ty=4  tx=0,39 OPEN
    '..........GGGGGGGGGGGGGGGGGGGG..........', // ty=3  tx=0,39 OPEN
    '......O...GGGGGGGGGGGGGGGGGGGG...O......', // ty=2  tx=0,39 OPEN
    '##########^^^^^^########^^^^^^##########', // ty=1
    '########################################', // ty=0
  ],
  {
    id: 'temp_02',
    name: 'Atomic Temple — Volt Conduit',
    biome: 'TEMP',
    mode: 'normal',
    mapX: -2,
    mapY: -3,
    defaultSpawnX: 37.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 39,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'temp_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Antigrav Atrium',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'temp_05',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Gilded Reactor Vault',
      },
      {
        dir: 'door',
        x: 19.5,
        y: 12.0,
        width: 1.5,
        height: 2.0,
        targetRoomId: 'temp_03',
        targetSpawnX: 4.0,
        targetSpawnY: 2.0,
        label: 'Plasma Relay',
      },
    ],
    enemies: [
      { id: 'temp_02_e1', archetype: 'scavenger', x: 19.5, y: 2.0, patrolMinX: 16.5, patrolMaxX: 23.0 },
      { id: 'temp_02_e2', archetype: 'atom_eye', x: 14.0, y: 7.5, patrolMinX: 10.5, patrolMaxX: 18.0 },
      { id: 'temp_02_e3', archetype: 'botmerang', x: 25.5, y: 7.5, patrolMinX: 21.5, patrolMaxX: 29.0 },
    ],
    coins: [
      { id: 'temp_02_coin_1', x: 13.0, y: 9.8, kind: 'world' },
      { id: 'temp_02_coin_2', x: 27.0, y: 9.8, kind: 'world' },
      { id: 'temp_02_coin_combo', x: 20.0, y: 7.2, kind: 'combo' },
    ],
    crystals: [
      { id: 'temp_02_c1', x: 13.0, y: 6.5, value: 20 },
      { id: 'temp_02_c2', x: 20.0, y: 6.5, value: 25 },
      { id: 'temp_02_c3', x: 27.0, y: 6.5, value: 20 },
    ],
    props: [
      {
        id: 'temp_02_volt_1',
        kind: 'volt_node',
        x: 12.0,
        y: 8.5,
        width: 0.8,
        height: 0.8,
        label: 'Conduit Node Alpha',
      },
      {
        id: 'temp_02_volt_2',
        kind: 'volt_node',
        x: 19.6,
        y: 9.2,
        width: 0.8,
        height: 0.8,
        label: 'Conduit Node Beta',
      },
      {
        id: 'temp_02_volt_3',
        kind: 'volt_node',
        x: 27.2,
        y: 8.5,
        width: 0.8,
        height: 0.8,
        label: 'Conduit Node Gamma',
      },
    ],
  },
);

// ============================================================================
// TEMP 03 — Plasma Relay (38 x 15, hasTeleporter: true)
// Alternating antigrav chambers & Volt Nodes with Relay Waystone Teleporter!
// ============================================================================
const TEMP_03 = buildRoom(
  [
    '######################################', // ty=14
    '#....................................#', // ty=13
    '#....................................#', // ty=12
    '#........GGGG....GGGG....GGGG........#', // ty=11
    '#........GGGG----GGGG----GGGG........#', // ty=10
    '#........GGGG....GGGG....GGGG........#', // ty=9
    '#........GGGG....GGGG....GGGG........#', // ty=8
    '#....----GGGG....GGGG....GGGG----....#', // ty=7
    '#........GGGG....GGGG....GGGG........#', // ty=6
    '#........GGGG....GGGG....GGGG........#', // ty=5
    '#........GGGG....GGGG....GGGG.........', // ty=4  tx=37 OPEN
    '#........GGGG....GGGG....GGGG.........', // ty=3  tx=37 OPEN
    '#........GGGG.^^.GGGG.^^.GGGG.........', // ty=2  tx=37 OPEN
    '######################################', // ty=1
    '######################################', // ty=0
  ],
  {
    id: 'temp_03',
    name: 'Atomic Temple — Plasma Relay',
    biome: 'TEMP',
    mode: 'normal',
    mapX: -2,
    mapY: -2,
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
        targetRoomId: 'temp_02',
        targetSpawnX: 19.5,
        targetSpawnY: 12.0,
        label: 'Volt Conduit',
      },
      {
        dir: 'right',
        x: 37,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'temp_04',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Ion Arena',
      },
    ],
    enemies: [
      { id: 'temp_03_e1', archetype: 'atom_eye', x: 14.5, y: 8.5, patrolMinX: 11.0, patrolMaxX: 18.5 },
      { id: 'temp_03_e2', archetype: 'mummy', x: 14.5, y: 11.0, patrolMinX: 13.2, patrolMaxX: 16.2 },
      { id: 'temp_03_e3', archetype: 'scavenger', x: 22.5, y: 11.0, patrolMinX: 21.2, patrolMaxX: 24.2 },
      { id: 'temp_03_e4', archetype: 'atom_eye', x: 27.0, y: 8.5, patrolMinX: 23.0, patrolMaxX: 31.0 },
    ],
    coins: [
      { id: 'temp_03_coin_1', x: 15.0, y: 12.8, kind: 'world' },
      { id: 'temp_03_coin_2', x: 23.0, y: 12.8, kind: 'world' },
      { id: 'temp_03_coin_combo', x: 31.0, y: 9.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'temp_03_c1', x: 11.0, y: 7.5, value: 20 },
      { id: 'temp_03_c2', x: 19.0, y: 7.5, value: 20 },
      { id: 'temp_03_c3', x: 27.0, y: 7.5, value: 20 },
    ],
    props: [
      {
        id: 'temp_03_teleporter',
        kind: 'teleporter',
        x: 6.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Relay Waystone',
      },
      {
        id: 'temp_03_volt_1',
        kind: 'volt_node',
        x: 18.6,
        y: 12.0,
        width: 0.8,
        height: 0.8,
        label: 'Relay Volt Node',
      },
    ],
  },
);

// ============================================================================
// TEMP 04 — Ion Arena (28 x 14, mode: 'arena')
// Low-gravity Volt Node combat chamber with elevated Ion Chest!
// ============================================================================
const TEMP_04 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........------..........#', // ty=10
    '#....GGGG..........GGGG....#', // ty=9
    '#....GGGG..........GGGG....#', // ty=8
    '#....GGGG..........GGGG....#', // ty=7
    '#....GGGG.--------.GGGG....#', // ty=6
    '#....GGGG..........GGGG....#', // ty=5
    '.....GGGG..........GGGG....#', // ty=4  tx=0 OPEN
    '.....GGGG..........GGGG....#', // ty=3  tx=0 OPEN
    '.....O................O....#', // ty=2  tx=0 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'temp_04',
    name: 'Atomic Temple — Ion Arena',
    biome: 'TEMP',
    mode: 'arena',
    mapX: -1,
    mapY: -2,
    defaultSpawnX: 2.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'temp_03',
        targetSpawnX: 35.0,
        targetSpawnY: 2.0,
        label: 'Plasma Relay',
      },
      {
        dir: 'door',
        x: 24.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'temp_06',
        targetSpawnX: 31.5,
        targetSpawnY: 2.0,
        label: 'Storm Shrine',
      },
    ],
    enemies: [
      { id: 'temp_04_e1', archetype: 'mummy', x: 13.5, y: 2.0, patrolMinX: 9.0, patrolMaxX: 19.0 },
      { id: 'temp_04_e2', archetype: 'scavenger', x: 13.5, y: 7.0, patrolMinX: 10.5, patrolMaxX: 17.0 },
      { id: 'temp_04_e3', archetype: 'atom_eye', x: 7.5, y: 9.5, patrolMinX: 4.5, patrolMaxX: 12.0 },
      { id: 'temp_04_e4', archetype: 'botmerang', x: 20.0, y: 9.5, patrolMinX: 15.5, patrolMaxX: 23.5 },
    ],
    coins: [
      { id: 'temp_04_coin_1', x: 7.0, y: 11.2, kind: 'world' },
      { id: 'temp_04_coin_2', x: 21.0, y: 11.2, kind: 'world' },
      { id: 'temp_04_coin_chest', x: 14.0, y: 11.6, kind: 'chest' },
      { id: 'temp_04_coin_combo', x: 14.0, y: 4.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'temp_04_c1', x: 7.0, y: 7.5, value: 20 },
      { id: 'temp_04_c2', x: 21.0, y: 7.5, value: 20 },
      { id: 'temp_04_c3', x: 14.0, y: 12.4, value: 25 },
    ],
    props: [
      {
        id: 'temp_04_volt_1',
        kind: 'volt_node',
        x: 10.5,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Ion Node Left',
      },
      {
        id: 'temp_04_volt_2',
        kind: 'volt_node',
        x: 16.8,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Ion Node Right',
      },
      {
        id: 'temp_04_chest',
        kind: 'chest',
        x: 13.5,
        y: 11.0,
        width: 1.0,
        height: 0.85,
        coinId: 'temp_04_coin_chest',
        label: 'Ion Arena Cache',
      },
    ],
  },
);

// ============================================================================
// TEMP 05 — Gilded Reactor Vault (28 x 14, isSecret: true)
// Secret bonus treasure vault featuring an optional coin_door (30 coins)
// sealing the inner Gilded Chest alcove! Never gates the critical path!
// ============================================================================
const TEMP_05 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#...........----...........#', // ty=10
    '#.......GGGGGGGGGGGG.......#', // ty=9
    '#.......GGGGGGGGGGGG.......#', // ty=8
    '#.......GGGGGGGGGGGG.......#', // ty=7
    '#..........########........#', // ty=6  optional coin-door chamber roof
    '#..........#...............#', // ty=5
    '#..........#................', // ty=4  tx=27 OPEN
    '#..........#................', // ty=3  tx=27 OPEN
    '#..O........................', // ty=2  tx=27 OPEN; coin_door at x=11, y=2..4
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'temp_05',
    name: 'Atomic Temple — Gilded Reactor Vault',
    biome: 'TEMP',
    mode: 'normal',
    isSecret: true,
    mapX: -3,
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
        targetRoomId: 'temp_02',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Volt Conduit',
      },
    ],
    enemies: [
      { id: 'temp_05_e1', archetype: 'mummy', x: 16.5, y: 2.0, patrolMinX: 13.0, patrolMaxX: 21.5 },
      { id: 'temp_05_e2', archetype: 'scavenger', x: 14.5, y: 7.0, patrolMinX: 11.5, patrolMaxX: 18.0 },
      { id: 'temp_05_e3', archetype: 'atom_eye', x: 14.0, y: 11.5, patrolMinX: 9.0, patrolMaxX: 19.0 },
    ],
    coins: [
      { id: 'temp_05_coin_1', x: 14.0, y: 11.6, kind: 'world' },
      { id: 'temp_05_coin_2', x: 8.5, y: 3.2, kind: 'world' },
      { id: 'temp_05_coin_chest', x: 6.5, y: 2.6, kind: 'chest' },
      { id: 'temp_05_coin_combo', x: 21.5, y: 9.2, kind: 'combo' },
    ],
    crystals: [
      { id: 'temp_05_c1', x: 7.5, y: 4.5, value: 30 },
      { id: 'temp_05_c2', x: 14.0, y: 9.0, value: 25 },
      { id: 'temp_05_c3', x: 20.0, y: 9.0, value: 25 },
    ],
    props: [
      {
        id: 'temp_05_coin_door',
        kind: 'coin_door',
        x: 11.0,
        y: 2.0,
        width: 1.0,
        height: 3.0,
        requiredCoins: 30,
        label: '30-Coin Reactor Seal',
      },
      {
        id: 'temp_05_chest',
        kind: 'chest',
        x: 6.0,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'temp_05_coin_chest',
        label: 'Gilded Reactor Hoard',
      },
      {
        id: 'temp_05_volt_1',
        kind: 'volt_node',
        x: 13.6,
        y: 9.5,
        width: 0.8,
        height: 0.8,
        label: 'Vault Relay Node',
      },
    ],
  },
);

// ============================================================================
// TEMP 06 — Storm Shrine (36 x 15, hasTeleporter: true)
// Houses the Volt Form Totem (krunk_electric), aerial Volt Node chain,
// Antigrav columns, Save Shrine, and Waystone Teleporter before Electro Sphinx!
// ============================================================================
const TEMP_06 = buildRoom(
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
    '.........GGGG..........GGGG........#', // ty=4  tx=0 OPEN
    '.........GGGG..........GGGG........#', // ty=3  tx=0 OPEN
    '.........GGGG..........GGGG........#', // ty=2  tx=0 OPEN
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'temp_06',
    name: 'Atomic Temple — Storm Shrine',
    biome: 'TEMP',
    mode: 'normal',
    mapX: -1,
    mapY: -1,
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
        targetRoomId: 'temp_04',
        targetSpawnX: 24.0,
        targetSpawnY: 2.0,
        label: 'Ion Arena',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'temp_boss',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Volt Sanctum',
      },
    ],
    enemies: [
      { id: 'temp_06_e1', archetype: 'mummy', x: 18.0, y: 2.0, patrolMinX: 13.5, patrolMaxX: 22.5 },
      { id: 'temp_06_e2', archetype: 'atom_eye', x: 18.0, y: 12.5, patrolMinX: 13.0, patrolMaxX: 23.0 },
    ],
    coins: [
      { id: 'temp_06_coin_1', x: 18.0, y: 12.8, kind: 'world' },
      { id: 'temp_06_coin_2', x: 6.0, y: 10.0, kind: 'world' },
      { id: 'temp_06_coin_combo', x: 30.0, y: 10.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'temp_06_c1', x: 11.0, y: 7.5, value: 20 },
      { id: 'temp_06_c2', x: 25.0, y: 7.5, value: 20 },
      { id: 'temp_06_c3', x: 18.0, y: 10.8, value: 25 },
    ],
    props: [
      {
        id: 'temp_06_volt_totem',
        kind: 'form_totem',
        formId: 'krunk_electric',
        x: 17.5,
        y: 9.0,
        width: 1.0,
        height: 1.5,
        label: 'Volt Form Shrine',
      },
      {
        id: 'temp_06_volt_1',
        kind: 'volt_node',
        x: 11.0,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Shrine Volt Node West',
      },
      {
        id: 'temp_06_volt_2',
        kind: 'volt_node',
        x: 24.5,
        y: 11.5,
        width: 0.8,
        height: 0.8,
        label: 'Shrine Volt Node East',
      },
      {
        id: 'temp_06_teleporter',
        kind: 'teleporter',
        x: 27.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Storm Waystone',
      },
      {
        id: 'temp_06_save',
        kind: 'save_shrine',
        x: 4.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Sanctum Threshold Shrine',
      },
    ],
  },
);

// ============================================================================
// TEMP BOSS — Volt Sanctum (28 x 14, mode: 'boss', bossId: 'electro_sphinx')
// Boss 4 (20 HP -> unlocks krunk_electric!) with antigrav flanks, Volt Nodes,
// and Eclipse Sky-Lift ascending straight into Nightmare Spire (evil_01)!
// ============================================================================
const TEMP_BOSS = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........................#', // ty=10
    '#..........------..........#', // ty=9
    '#...GGG..............GGG...#', // ty=8
    '#...GGG..............GGG...#', // ty=7
    '#...GGG..............GGG...#', // ty=6
    '#...GGG----......----GGG...#', // ty=5
    '#...GGG..............GGG....', // ty=4  tx=27 OPEN
    '#...GGG..............GGG....', // ty=3  tx=27 OPEN
    '#....O................O.....', // ty=2  tx=27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'temp_boss',
    name: 'Atomic Temple — Volt Sanctum',
    biome: 'TEMP',
    mode: 'boss',
    bossId: 'electro_sphinx',
    mapX: -2,
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
        targetRoomId: 'temp_06',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Storm Shrine',
      },
      {
        dir: 'door',
        x: 3.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'evil_01',
        targetSpawnX: 30.5,
        targetSpawnY: 2.0,
        label: 'Nightmare Spire Lift',
      },
    ],
    enemies: [],
    coins: [
      { id: 'boss_electro_sphinx', x: 14.0, y: 10.6, kind: 'boss' },
      { id: 'temp_boss_coin_2', x: 14.0, y: 6.5, kind: 'world' },
    ],
    crystals: [
      { id: 'temp_boss_c1', x: 8.5, y: 6.8, value: 20 },
      { id: 'temp_boss_c2', x: 19.5, y: 6.8, value: 20 },
      { id: 'temp_boss_c3', x: 14.0, y: 10.8, value: 25 },
    ],
    props: [
      {
        id: 'temp_boss_volt_1',
        kind: 'volt_node',
        x: 8.5,
        y: 11.0,
        width: 0.8,
        height: 0.8,
        label: 'Sanctum Volt Anchor',
      },
      {
        id: 'temp_boss_volt_2',
        kind: 'volt_node',
        x: 18.7,
        y: 11.0,
        width: 0.8,
        height: 0.8,
        label: 'Sanctum Volt Anchor',
      },
    ],
  },
);

export const TEMP_ROOMS: readonly RoomDef[] = [
  TEMP_01,
  TEMP_02,
  TEMP_03,
  TEMP_04,
  TEMP_05,
  TEMP_06,
  TEMP_BOSS,
] as const;
