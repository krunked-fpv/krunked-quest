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
// FLIN 01 — Vine Canopy (48 x 16)
// Slippery vine rails (V), wind updrafts (W), rubber bounce blocks (O),
// Volt Node bonus route, and Frog/Plant/Bee combo chain.
// ============================================================================
const FLIN_01 = buildRoom(
  [
    '################################################', // ty=15
    '#..............................................#', // ty=14
    '#..............................................#', // ty=13
    '#..............................................#', // ty=12
    '#.......................WW.....................#', // ty=11
    '#.........#.............WW.............#.......#', // ty=10
    '#.........#V............WW.-------.....#V......#', // ty=9
    '#.........#V............WW.............#V......#', // ty=8
    '#.........#V............WW.............#V......#', // ty=7
    '#.........#V...------...WW..---------..#V......#', // ty=6
    '#.........#V............WW.............#V......#', // ty=5
    '...........V............WW..............V.......', // ty=4  tx=0,47 OPEN
    '...........V............WW..............V.......', // ty=3  tx=0,47 OPEN
    '.............O..........OO...........O..........', // ty=2  tx=0,47 OPEN
    '################################################', // ty=1
    '################################################', // ty=0
  ],
  {
    id: 'flin_01',
    name: 'Infested Forest — Vine Canopy',
    biome: 'FLIN',
    mode: 'normal',
    mapX: 8,
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
        targetRoomId: 'tdm_boss',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Behemoth Gorge',
      },
      {
        dir: 'right',
        x: 47,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'flin_02',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Acid Hollow',
      },
    ],
    enemies: [
      { id: 'flin_01_e1', archetype: 'frog', x: 7.5, y: 2.0, patrolMinX: 5.5, patrolMaxX: 10.5 },
      { id: 'flin_01_e2', archetype: 'carnivorous_plant', x: 17.5, y: 7.0, patrolMinX: 15.5, patrolMaxX: 19.8 },
      { id: 'flin_01_e3', archetype: 'frog', x: 18.0, y: 2.0, patrolMinX: 15.0, patrolMaxX: 22.5 },
      { id: 'flin_01_e4', archetype: 'bee', x: 21.5, y: 9.2, patrolMinX: 19.0, patrolMaxX: 23.5 },
      { id: 'flin_01_e5', archetype: 'bee', x: 30.5, y: 8.5, patrolMinX: 28.0, patrolMaxX: 34.5 },
      { id: 'flin_01_e6', archetype: 'carnivorous_plant', x: 32.5, y: 7.0, patrolMinX: 29.0, patrolMaxX: 35.8 },
    ],
    coins: [
      { id: 'flin_01_coin_1', x: 32.0, y: 12.2, kind: 'world' },
      { id: 'flin_01_coin_2', x: 17.5, y: 11.0, kind: 'world' },
      { id: 'flin_01_coin_combo', x: 43.0, y: 3.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'flin_01_c1', x: 6.5, y: 3.5, value: 15 },
      { id: 'flin_01_c2', x: 11.5, y: 6.5, value: 15 },
      { id: 'flin_01_c3', x: 18.0, y: 8.2, value: 15 },
      { id: 'flin_01_c4', x: 24.5, y: 7.5, value: 20 },
      { id: 'flin_01_c5', x: 30.5, y: 10.6, value: 20 },
      { id: 'flin_01_c6', x: 41.5, y: 6.5, value: 15 },
    ],
    props: [
      {
        id: 'flin_01_sign',
        kind: 'signpost',
        x: 4.0,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Infested Forest: Grip slippery vines, leap off rubber bounce bulbs, and beware bubbling acid pools!',
      },
      {
        id: 'flin_01_volt_1',
        kind: 'volt_node',
        x: 29.0,
        y: 11.8,
        width: 0.8,
        height: 0.8,
        label: 'Canopy Volt Node',
      },
      {
        id: 'flin_01_volt_2',
        kind: 'volt_node',
        x: 35.0,
        y: 11.8,
        width: 0.8,
        height: 0.8,
        label: 'Canopy Volt Node',
      },
    ],
  },
);

// ============================================================================
// FLIN 02 — Acid Hollow (42 x 16)
// Bubbling acid pools (A), vine-draped stone columns (V), bounce pads (O),
// secret wall (?) to Venom Grotto (flin_06), and Canopy Ladder to flin_03!
// ============================================================================
const FLIN_02 = buildRoom(
  [
    '##########################################', // ty=15
    '#........................................#', // ty=14
    '#........................................#', // ty=13
    '#........................................#', // ty=12
    '#................----------..............#', // ty=11
    '#........................................#', // ty=10
    '#.......#V......................V#.......#', // ty=9
    '#.......#V......--------........V#.......#', // ty=8
    '#.......#V......................V#.......#', // ty=7
    '#.......#V......................V#.......#', // ty=6
    '#....---#V......................V#---....#', // ty=5
    '........#V......................V#...?....', // ty=4  tx=0,41 OPEN; tx=37 secret wall
    '........#V......................V#...?....', // ty=3  tx=0,41 OPEN
    '.....O..#...O......OO......O....#....?....', // ty=2  tx=0,41 OPEN
    '###########AAAAA########AAAAA#############', // ty=1  acid pools over solid ty=0
    '##########################################', // ty=0
  ],
  {
    id: 'flin_02',
    name: 'Infested Forest — Acid Hollow',
    biome: 'FLIN',
    mode: 'normal',
    mapX: 9,
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
        targetRoomId: 'flin_01',
        targetSpawnX: 45.0,
        targetSpawnY: 2.0,
        label: 'Vine Canopy',
      },
      {
        dir: 'right',
        x: 41,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'flin_06',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Venom Grotto',
      },
      {
        dir: 'door',
        x: 20.0,
        y: 12.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'flin_03',
        targetSpawnX: 4.0,
        targetSpawnY: 2.0,
        label: 'Spore Bounceway',
      },
    ],
    enemies: [
      { id: 'flin_02_e1', archetype: 'toxic_slug', x: 18.0, y: 2.0, patrolMinX: 16.5, patrolMaxX: 22.8 },
      { id: 'flin_02_e2', archetype: 'spitter', x: 19.0, y: 9.0, patrolMinX: 16.5, patrolMaxX: 23.0 },
      { id: 'flin_02_e3', archetype: 'carnivorous_plant', x: 23.5, y: 12.0, patrolMinX: 17.5, patrolMaxX: 25.5 },
      { id: 'flin_02_e4', archetype: 'toxic_slug', x: 35.0, y: 2.0, patrolMinX: 33.8, patrolMaxX: 36.2 },
    ],
    coins: [
      { id: 'flin_02_coin_1', x: 13.5, y: 5.5, kind: 'world' },
      { id: 'flin_02_coin_2', x: 26.5, y: 5.5, kind: 'world' },
      { id: 'flin_02_coin_combo', x: 20.5, y: 10.2, kind: 'combo' },
    ],
    crystals: [
      { id: 'flin_02_c1', x: 13.0, y: 4.5, value: 15 },
      { id: 'flin_02_c2', x: 19.5, y: 4.2, value: 20 },
      { id: 'flin_02_c3', x: 26.5, y: 4.5, value: 15 },
      { id: 'flin_02_c4', x: 18.5, y: 13.2, value: 20 },
      { id: 'flin_02_c5', x: 23.0, y: 13.2, value: 20 },
    ],
    props: [],
  },
);

// ============================================================================
// FLIN 03 — Spore Bounceway (40 x 16)
// Rubber bounce block gauntlet over acid basins & vine drop walls.
// ============================================================================
const FLIN_03 = buildRoom(
  [
    '########################################', // ty=15
    '#......................................#', // ty=14
    '#......................................#', // ty=13
    '#...........-----......-----...........#', // ty=12
    '#......................................#', // ty=11
    '#................#V..V#................#', // ty=10
    '#................#V..V#................#', // ty=9
    '#......----......#V..V#......----......#', // ty=8
    '#................#V..V#................#', // ty=7
    '#................#V..V#................#', // ty=6
    '#......................................#', // ty=5
    '.......................................#', // ty=4  tx=0 OPEN
    '.......................................#', // ty=3  tx=0 OPEN
    '.....O.....O.....O....O.....O.....O....#', // ty=2  tx=0 OPEN
    '#######AAAA###AAAA####AAAA###AAAA#######', // ty=1  acid pits
    '########################################', // ty=0
  ],
  {
    id: 'flin_03',
    name: 'Infested Forest — Spore Bounceway',
    biome: 'FLIN',
    mode: 'normal',
    mapX: 9,
    mapY: 1,
    defaultSpawnX: 3.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 3.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'flin_02',
        targetSpawnX: 20.0,
        targetSpawnY: 12.0,
        label: 'Acid Hollow',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'flin_04',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Fungal Arena',
      },
    ],
    enemies: [
      { id: 'flin_03_e1', archetype: 'guilhofly', x: 10.0, y: 10.5, patrolMinX: 6.5, patrolMaxX: 15.0 },
      { id: 'flin_03_e2', archetype: 'frog', x: 8.5, y: 9.0, patrolMinX: 7.2, patrolMaxX: 10.2 },
      { id: 'flin_03_e3', archetype: 'guilhofly', x: 28.0, y: 10.5, patrolMinX: 24.5, patrolMaxX: 33.5 },
      { id: 'flin_03_e4', archetype: 'toxic_slug', x: 30.5, y: 9.0, patrolMinX: 29.2, patrolMaxX: 32.2 },
      { id: 'flin_03_e5', archetype: 'frog', x: 35.0, y: 2.0, patrolMinX: 33.5, patrolMaxX: 37.5 },
    ],
    coins: [
      { id: 'flin_03_coin_1', x: 14.5, y: 13.6, kind: 'world' },
      { id: 'flin_03_coin_2', x: 25.5, y: 13.6, kind: 'world' },
      { id: 'flin_03_coin_combo', x: 36.5, y: 6.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'flin_03_c1', x: 8.5, y: 5.5, value: 15 },
      { id: 'flin_03_c2', x: 15.0, y: 5.5, value: 15 },
      { id: 'flin_03_c3', x: 20.0, y: 12.0, value: 20 },
      { id: 'flin_03_c4', x: 24.5, y: 5.5, value: 15 },
      { id: 'flin_03_c5', x: 31.0, y: 5.5, value: 15 },
    ],
    props: [],
  },
);

// ============================================================================
// FLIN 04 — Fungal Arena (28 x 14, mode: 'arena', hasTeleporter: true)
// Slippery vine walls & rubber bounce combat arena with Waystone Teleporter.
// ============================================================================
const FLIN_04 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#V........................V#', // ty=10
    '#V.........------.........V#', // ty=9
    '#V........................V#', // ty=8
    '#V........................V#', // ty=7
    '#V........................V#', // ty=6
    '#....-----........-----....#', // ty=5
    '............................', // ty=4  tx=0,27 OPEN
    '............................', // ty=3  tx=0,27 OPEN
    '.....O................O.....', // ty=2  tx=0,27 OPEN
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'flin_04',
    name: 'Infested Forest — Fungal Arena',
    biome: 'FLIN',
    mode: 'arena',
    mapX: 8,
    mapY: 1,
    defaultSpawnX: 25.0,
    defaultSpawnY: 2.0,
    hasTeleporter: true,
    exits: [
      {
        dir: 'right',
        x: 27,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'flin_03',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Spore Bounceway',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'flin_05',
        targetSpawnX: 39.0,
        targetSpawnY: 2.0,
        label: 'Mossy Tangle',
      },
    ],
    enemies: [
      { id: 'flin_04_e1', archetype: 'mushroom_warrior', x: 9.5, y: 2.0, patrolMinX: 7.0, patrolMaxX: 13.5 },
      { id: 'flin_04_e2', archetype: 'carnivorous_plant', x: 18.0, y: 2.0, patrolMinX: 14.5, patrolMaxX: 20.5 },
      { id: 'flin_04_e3', archetype: 'bee', x: 7.5, y: 8.5, patrolMinX: 4.5, patrolMaxX: 11.0 },
      { id: 'flin_04_e4', archetype: 'neural_spider', x: 19.5, y: 8.5, patrolMinX: 16.0, patrolMaxX: 23.0 },
      { id: 'flin_04_e5', archetype: 'mushroom_warrior', x: 13.5, y: 10.0, patrolMinX: 11.2, patrolMaxX: 16.0 },
    ],
    coins: [
      { id: 'flin_04_coin_1', x: 7.5, y: 7.2, kind: 'world' },
      { id: 'flin_04_coin_2', x: 20.5, y: 7.2, kind: 'world' },
      { id: 'flin_04_coin_combo', x: 14.0, y: 11.4, kind: 'combo' },
    ],
    crystals: [
      { id: 'flin_04_c1', x: 6.5, y: 6.5, value: 15 },
      { id: 'flin_04_c2', x: 13.0, y: 11.0, value: 20 },
      { id: 'flin_04_c3', x: 15.0, y: 11.0, value: 20 },
      { id: 'flin_04_c4', x: 21.5, y: 6.5, value: 15 },
    ],
    props: [
      {
        id: 'flin_04_teleporter',
        kind: 'teleporter',
        x: 13.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Fungal Waystone',
      },
    ],
  },
);

// ============================================================================
// FLIN 05 — Mossy Tangle (42 x 16)
// Twin vine chimneys over acid pools, hidden chest perch, and upper exit
// climbing toward Rootway Gate (flin_07).
// ============================================================================
const FLIN_05 = buildRoom(
  [
    '##########################################', // ty=15
    '#........................................#', // ty=14
    '#........................................#', // ty=13
    '#...---------................--------....#', // ty=12
    '#...............#V......V#...............#', // ty=11
    '#...............#V......V#...............#', // ty=10
    '#...............#V..--..V#...............#', // ty=9
    '#......----.....#V......V#.....----......#', // ty=8
    '#...............#V......V#...............#', // ty=7
    '#...............#V......V#...............#', // ty=6
    '#...............#V......V#...............#', // ty=5
    '#.........................................', // ty=4  tx=41 OPEN
    '#.........................................', // ty=3  tx=41 OPEN
    '#.......O............O...........O........', // ty=2  tx=41 OPEN
    '###########AAAAA###########AAAAA##########', // ty=1  acid basins
    '##########################################', // ty=0
  ],
  {
    id: 'flin_05',
    name: 'Infested Forest — Mossy Tangle',
    biome: 'FLIN',
    mode: 'normal',
    mapX: 7,
    mapY: 1,
    defaultSpawnX: 39.0,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'right',
        x: 41,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'flin_04',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Fungal Arena',
      },
      {
        dir: 'door',
        x: 6.0,
        y: 13.0,
        width: 1.5,
        height: 2.0,
        targetRoomId: 'flin_07',
        targetSpawnX: 32.0,
        targetSpawnY: 2.0,
        label: 'Rootway Gate',
      },
    ],
    enemies: [
      { id: 'flin_05_e1', archetype: 'toxic_slug', x: 18.0, y: 2.0, patrolMinX: 16.5, patrolMaxX: 19.8 },
      { id: 'flin_05_e2', archetype: 'spitter', x: 8.5, y: 9.0, patrolMinX: 7.2, patrolMaxX: 10.2 },
      { id: 'flin_05_e3', archetype: 'frog', x: 32.5, y: 9.0, patrolMinX: 31.2, patrolMaxX: 34.2 },
      { id: 'flin_05_e4', archetype: 'mushroom_warrior', x: 33.0, y: 13.0, patrolMinX: 29.5, patrolMaxX: 36.2 },
    ],
    coins: [
      { id: 'flin_05_coin_1', x: 21.0, y: 11.2, kind: 'world' },
      { id: 'flin_05_coin_2', x: 13.5, y: 5.5, kind: 'world' },
      { id: 'flin_05_coin_chest', x: 35.5, y: 13.6, kind: 'chest' },
      { id: 'flin_05_coin_combo', x: 29.0, y: 5.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'flin_05_c1', x: 19.0, y: 6.5, value: 15 },
      { id: 'flin_05_c2', x: 22.5, y: 6.5, value: 15 },
      { id: 'flin_05_c3', x: 9.0, y: 14.0, value: 20 },
      { id: 'flin_05_c4', x: 32.0, y: 14.0, value: 20 },
    ],
    props: [
      {
        id: 'flin_05_chest',
        kind: 'chest',
        x: 35.0,
        y: 13.0,
        width: 1.0,
        height: 0.85,
        coinId: 'flin_05_coin_chest',
        label: 'Tangle Canopy Cache',
      },
    ],
  },
);

// ============================================================================
// FLIN 06 — Venom Grotto (28 x 14, isSecret: true)
// Secret acid & vine treasure cavern behind Acid Hollow's cracked east wall!
// ============================================================================
const FLIN_06 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#...........----...........#', // ty=10
    '#..........................#', // ty=9
    '#....----..........----....#', // ty=8
    '#............#V............#', // ty=7
    '#............#V............#', // ty=6
    '#............#V............#', // ty=5
    '.............#V............#', // ty=4  tx=0 OPEN
    '.............#V............#', // ty=3  tx=0 OPEN
    '......O.............O......#', // ty=2  tx=0 OPEN
    '#########AAAA##AAAA#########', // ty=1  acid channels
    '############################', // ty=0
  ],
  {
    id: 'flin_06',
    name: 'Infested Forest — Venom Grotto',
    biome: 'FLIN',
    mode: 'normal',
    isSecret: true,
    mapX: 10,
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
        targetRoomId: 'flin_02',
        targetSpawnX: 39.0,
        targetSpawnY: 2.0,
        label: 'Acid Hollow',
      },
    ],
    enemies: [
      { id: 'flin_06_e1', archetype: 'toxic_slug', x: 6.5, y: 9.0, patrolMinX: 5.2, patrolMaxX: 8.2 },
      { id: 'flin_06_e2', archetype: 'neural_spider', x: 18.0, y: 7.5, patrolMinX: 15.5, patrolMaxX: 22.0 },
    ],
    coins: [
      { id: 'flin_06_coin_1', x: 14.0, y: 11.6, kind: 'world' },
      { id: 'flin_06_coin_2', x: 21.0, y: 9.6, kind: 'world' },
      { id: 'flin_06_coin_chest', x: 24.5, y: 2.6, kind: 'chest' },
      { id: 'flin_06_coin_combo', x: 7.0, y: 11.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'flin_06_c1', x: 11.0, y: 4.5, value: 25 },
      { id: 'flin_06_c2', x: 17.0, y: 4.5, value: 25 },
      { id: 'flin_06_c3', x: 14.0, y: 12.2, value: 30 },
    ],
    props: [
      {
        id: 'flin_06_chest',
        kind: 'chest',
        x: 24.0,
        y: 2.0,
        width: 1.0,
        height: 0.85,
        coinId: 'flin_06_coin_chest',
        label: 'Venom Grotto Hoard',
      },
    ],
  },
);

// ============================================================================
// FLIN 07 — Rootway Gate (36 x 14, hasTeleporter: true)
// Forest summit threshold leading westward into the Primal Tree (ap_01)!
// ============================================================================
const FLIN_07 = buildRoom(
  [
    '####################################', // ty=13
    '#..................................#', // ty=12
    '#..................................#', // ty=11
    '#............----------............#', // ty=10
    '#..................................#', // ty=9
    '#.....#V....................V#.....#', // ty=8
    '#.....#V......--------......V#.....#', // ty=7
    '#.....#V....................V#.....#', // ty=6
    '#.....#V....................V#.....#', // ty=5
    '...................................#', // ty=4  tx=0 OPEN
    '...................................#', // ty=3  tx=0 OPEN
    '.........O..............O..........#', // ty=2  tx=0 OPEN
    '############AAAA##AAAA##############', // ty=1  acid trench
    '####################################', // ty=0
  ],
  {
    id: 'flin_07',
    name: 'Infested Forest — Rootway Gate',
    biome: 'FLIN',
    mode: 'normal',
    mapX: 7,
    mapY: 2,
    defaultSpawnX: 32.0,
    defaultSpawnY: 2.0,
    hasTeleporter: true,
    exits: [
      {
        dir: 'door',
        x: 31.5,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'flin_05',
        targetSpawnX: 6.0,
        targetSpawnY: 13.0,
        label: 'Mossy Tangle',
      },
      {
        dir: 'left',
        x: 0,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'ap_01',
        targetSpawnX: 37.0,
        targetSpawnY: 2.0,
        label: 'Primal Tree',
      },
    ],
    enemies: [
      { id: 'flin_07_e1', archetype: 'carnivorous_plant', x: 17.5, y: 8.0, patrolMinX: 14.5, patrolMaxX: 21.0 },
      { id: 'flin_07_e2', archetype: 'guilhofly', x: 13.0, y: 9.5, patrolMinX: 9.0, patrolMaxX: 17.0 },
      { id: 'flin_07_e3', archetype: 'neural_spider', x: 23.0, y: 9.5, patrolMinX: 19.0, patrolMaxX: 27.0 },
    ],
    coins: [
      { id: 'flin_07_coin_1', x: 18.0, y: 11.6, kind: 'world' },
      { id: 'flin_07_coin_2', x: 10.0, y: 6.0, kind: 'world' },
      { id: 'flin_07_coin_combo', x: 26.0, y: 6.0, kind: 'combo' },
    ],
    crystals: [
      { id: 'flin_07_c1', x: 14.0, y: 4.5, value: 15 },
      { id: 'flin_07_c2', x: 20.0, y: 4.5, value: 15 },
      { id: 'flin_07_c3', x: 16.0, y: 11.4, value: 20 },
      { id: 'flin_07_c4', x: 20.0, y: 11.4, value: 20 },
    ],
    props: [
      {
        id: 'flin_07_teleporter',
        kind: 'teleporter',
        x: 27.5,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Rootway Waystone',
      },
      {
        id: 'flin_07_save',
        kind: 'save_shrine',
        x: 4.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Primal Root Shrine',
      },
    ],
  },
);

export const FLIN_ROOMS: readonly RoomDef[] = [
  FLIN_01,
  FLIN_02,
  FLIN_03,
  FLIN_04,
  FLIN_05,
  FLIN_06,
  FLIN_07,
] as const;
