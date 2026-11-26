import type { RoomDef } from '../../contracts/index';
import { parseRoomGrid } from './parseGrid';

function buildRoom(
  asciiRows: readonly string[],
  meta: Omit<RoomDef, 'widthTiles' | 'heightTiles' | 'tiles'>,
): RoomDef {
  const { widthTiles, heightTiles, tiles } = parseRoomGrid(asciiRows);
  return {
    ...meta,
    widthTiles,
    heightTiles,
    tiles,
  };
}

// ============================================================================
// 1. MLAIR — Tutorial Lair (36 x 13)
// Teaches movement, double-jump, bounce pad, wall-jump chimney, breakable blocks,
// stomp combat, and leads straight east into Subrosa Haven.
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
    name: 'Tutorial Lair',
    biome: 'MLAIR',
    mode: 'normal',
    mapX: 0,
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
        targetRoomId: 'hub_haven',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'To Subrosa Haven',
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
    ],
    crystals: [
      { id: 'mlair_01_c1', x: 7.5, y: 2.5, value: 10 },
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
// 2. OPOUSO — Subrosa Haven Hub (36 x 13)
// Cozy town square housing all 6 Hub NPCs, Waystone Teleporter, Save Shrine,
// and Krunk's Form Totem showcase.
// ============================================================================
const HUB_HAVEN = buildRoom(
  [
    '####################################', // ty=12
    '#..................................#', // ty=11
    '#..................................#', // ty=10
    '#..................................#', // ty=9
    '#................----..............#', // ty=8
    '#..................................#', // ty=7
    '#..................................#', // ty=6
    '#..........----------------........#', // ty=5
    '....................................', // ty=4
    '.......---..................---.....', // ty=3
    '....................................', // ty=2
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'hub_haven',
    name: 'Subrosa Haven',
    biome: 'OPOUSO',
    mode: 'normal',
    mapX: 1,
    mapY: 0,
    defaultSpawnX: 4.0,
    defaultSpawnY: 2.0,
    hasTeleporter: true,
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
        label: 'Tutorial Lair',
      },
      {
        dir: 'right',
        x: 35,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'tdm_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: "Monster's Trail",
      },
    ],
    enemies: [],
    coins: [{ id: 'hub_haven_coin_1', x: 19.0, y: 9.5, kind: 'world' }],
    crystals: [
      { id: 'hub_haven_c1', x: 8.5, y: 4.5, value: 10 },
      { id: 'hub_haven_c2', x: 16.0, y: 6.8, value: 10 },
      { id: 'hub_haven_c3', x: 21.5, y: 6.8, value: 10 },
      { id: 'hub_haven_c4', x: 29.5, y: 4.5, value: 10 },
    ],
    props: [
      {
        id: 'hub_save_shrine',
        kind: 'save_shrine',
        x: 4.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Subrosa Save Shrine',
      },
      {
        id: 'hub_teleporter',
        kind: 'teleporter',
        x: 8.0,
        y: 2.0,
        width: 1.5,
        height: 1.5,
        label: 'Subrosa Waystone',
      },
      {
        id: 'npc_vespera',
        kind: 'shop_npc',
        shopId: 'vespera',
        x: 12.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Vespera — Core Upgrades',
      },
      {
        id: 'npc_orla',
        kind: 'shop_npc',
        shopId: 'orla',
        x: 16.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Orla — Form Upgrades & Maps',
      },
      {
        id: 'npc_barnaby',
        kind: 'shop_npc',
        shopId: 'barnaby',
        x: 21.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Barnaby — Relics',
      },
      {
        id: 'npc_garron',
        kind: 'shop_npc',
        shopId: 'garron',
        x: 25.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Garron — Boss Rematch',
      },
      {
        id: 'npc_barnacle',
        kind: 'shop_npc',
        shopId: 'barnacle',
        x: 30.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Capt. Barnacle — Ghost Ship',
      },
      {
        id: 'npc_codex',
        kind: 'shop_npc',
        shopId: 'codex',
        x: 13.5,
        y: 6.0,
        width: 1.0,
        height: 1.25,
        label: 'Codex — Guide Tome',
      },
      {
        id: 'hub_form_totem',
        kind: 'form_totem',
        formId: 'krunk_basic',
        x: 18.5,
        y: 6.0,
        width: 1.0,
        height: 1.5,
        label: 'Form Totem — Krunk Resonance',
      },
      {
        id: 'hub_signpost',
        kind: 'signpost',
        x: 23.5,
        y: 6.0,
        width: 0.9,
        height: 1.0,
        label: "Eastward lies Monster's Trail, the Infested Forest, and the Primal Eye's Sanctum!",
      },
    ],
  },
);

// ============================================================================
// 3. TDM — Monster's Trail: Sunlit Ridge (48 x 14)
// Flowing left-to-right combo chain with Bramble Stompers, Winged Brambles,
// Horned Beetle, bounce pad to elevated coin, and sunlit ridge jumps.
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
    '............-----..........----.................', // ty=4
    '...................######.......................', // ty=3
    '.................O.######...^^..#########.......', // ty=2
    '################################################', // ty=1
    '################################################', // ty=0
  ],
  {
    id: 'tdm_01',
    name: "Monster's Trail — Sunlit Ridge",
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
        targetRoomId: 'hub_haven',
        targetSpawnX: 33.0,
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
      {
        id: 'tdm_01_e1',
        archetype: 'goomba',
        x: 7.5,
        y: 2.0,
        patrolMinX: 5.0,
        patrolMaxX: 11.0,
      },
      {
        id: 'tdm_01_e2',
        archetype: 'air_goomba',
        x: 12.5,
        y: 6.5,
        patrolMinX: 10.5,
        patrolMaxX: 15.5,
      },
      {
        id: 'tdm_01_e3',
        archetype: 'goomba',
        x: 14.0,
        y: 2.0,
        patrolMinX: 11.5,
        patrolMaxX: 16.0,
      },
      {
        id: 'tdm_01_e4',
        archetype: 'goomba',
        x: 21.5,
        y: 4.0,
        patrolMinX: 19.5,
        patrolMaxX: 23.8,
      },
      {
        id: 'tdm_01_e5',
        archetype: 'air_goomba',
        x: 28.5,
        y: 6.5,
        patrolMinX: 26.0,
        patrolMaxX: 31.0,
      },
      {
        id: 'tdm_01_e6',
        archetype: 'horned_beetle',
        x: 35.5,
        y: 3.0,
        patrolMinX: 32.5,
        patrolMaxX: 39.8,
      },
      {
        id: 'tdm_01_e7',
        archetype: 'air_goomba',
        x: 42.0,
        y: 5.5,
        patrolMinX: 40.0,
        patrolMaxX: 44.5,
      },
    ],
    coins: [
      { id: 'tdm_01_coin_1', x: 21.5, y: 9.2, kind: 'world' },
      { id: 'tdm_01_coin_combo', x: 44.0, y: 3.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'tdm_01_c1', x: 5.5, y: 2.6, value: 10 },
      { id: 'tdm_01_c2', x: 9.5, y: 4.2, value: 10 },
      { id: 'tdm_01_c3', x: 13.5, y: 5.6, value: 15 },
      { id: 'tdm_01_c4', x: 15.5, y: 5.6, value: 15 },
      { id: 'tdm_01_c5', x: 17.5, y: 5.5, value: 15 },
      { id: 'tdm_01_c6', x: 20.5, y: 8.6, value: 20 },
      { id: 'tdm_01_c7', x: 22.5, y: 8.6, value: 20 },
      { id: 'tdm_01_c8', x: 26.5, y: 5.8, value: 15 },
      { id: 'tdm_01_c9', x: 28.5, y: 5.8, value: 15 },
      { id: 'tdm_01_c10', x: 30.5, y: 5.8, value: 15 },
      { id: 'tdm_01_c11', x: 34.0, y: 4.2, value: 15 },
      { id: 'tdm_01_c12', x: 38.0, y: 4.2, value: 15 },
      { id: 'tdm_01_c13', x: 42.5, y: 3.5, value: 15 },
      { id: 'tdm_01_c14', x: 45.0, y: 2.6, value: 15 },
    ],
    props: [],
  },
);

// ============================================================================
// 4. TDM — Monster's Trail: Canyon Climb (36 x 22)
// Vertical 4-tile wall-jump chimney, Canopy Hornets & Sap Spitters, secret
// wall grotto with breakables and hidden chest coin, and upper rim pocket.
// ============================================================================
const TDM_02 = buildRoom(
  [
    '####################################', // ty=21
    '#.........#........................#', // ty=20
    '#.........#........................#', // ty=19
    '#.........#........................#', // ty=18
    '#.........#.........................', // ty=17  tx=35 OPEN
    '#.........#.........................', // ty=16  tx=35 OPEN
    '###########.........................', // ty=15  tx=0..10 '#' secret cave roof, tx=35 OPEN
    '#.........#....#######BBB###########', // ty=14  tx=10 '#', tx=15..21 '#', tx=22..24 'B', tx=25..35 '#'
    '#.........?--..#.....#...#.........#', // ty=13  tx=10 '?', tx=11..12 '-', tx=15 '#', tx=21 '#', tx=25 '#'
    '#.....BB..?....#.....#...#.........#', // ty=12  tx=6..7 'B', tx=10 '?', tx=15 '#', tx=21 '#', tx=25 '#'
    '###########....#.....#.O.#.........#', // ty=11  tx=0..10 '#', tx=15 '#', tx=21 '#', tx=23 'O', tx=25 '#'
    '#.........#..--#.....#####.........#', // ty=10  tx=10 '#', tx=13..14 '-', tx=15 '#', tx=21..25 '#'
    '#.........#....#...................#', // ty=9
    '#.........#....#...................#', // ty=8
    '#.........#....#...................#', // ty=7
    '#.........#--..#...................#', // ty=6   tx=11..12 '-'
    '#.........#....#...................#', // ty=5
    '...............#...................#', // ty=4   tx=0 OPEN
    '...............#...................#', // ty=3   tx=0 OPEN
    '...............#...................#', // ty=2   tx=0 OPEN
    '####################################', // ty=1
    '####################################', // ty=0
  ],
  {
    id: 'tdm_02',
    name: "Monster's Trail — Canyon Climb",
    biome: 'TDM',
    mode: 'normal',
    mapX: 3,
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
    ],
    enemies: [
      {
        id: 'tdm_02_e1',
        archetype: 'spitter',
        x: 6.5,
        y: 2.0,
        patrolMinX: 4.0,
        patrolMaxX: 9.5,
      },
      {
        id: 'tdm_02_e2',
        archetype: 'bee',
        x: 12.5,
        y: 8.5,
        patrolMinX: 11.2,
        patrolMaxX: 14.0,
      },
      {
        id: 'tdm_02_e3',
        archetype: 'bee',
        x: 12.5,
        y: 12.5,
        patrolMinX: 11.2,
        patrolMaxX: 14.0,
      },
      {
        id: 'tdm_02_e4',
        archetype: 'spitter',
        x: 18.0,
        y: 15.0,
        patrolMinX: 16.0,
        patrolMaxX: 20.5,
      },
      {
        id: 'tdm_02_e5',
        archetype: 'bee',
        x: 26.5,
        y: 17.5,
        patrolMinX: 24.0,
        patrolMaxX: 29.5,
      },
      {
        id: 'tdm_02_e6',
        archetype: 'goomba',
        x: 30.5,
        y: 15.0,
        patrolMinX: 27.5,
        patrolMaxX: 33.0,
      },
    ],
    coins: [
      { id: 'tdm_02_coin_chest', x: 3.5, y: 13.0, kind: 'chest' },
      { id: 'tdm_02_coin_2', x: 23.5, y: 13.0, kind: 'world' },
    ],
    crystals: [
      { id: 'tdm_02_c1', x: 5.0, y: 2.6, value: 10 },
      { id: 'tdm_02_c2', x: 12.0, y: 4.5, value: 15 },
      { id: 'tdm_02_c3', x: 13.5, y: 7.5, value: 15 },
      { id: 'tdm_02_c4', x: 11.5, y: 10.5, value: 15 },
      {
        id: 'tdm_02_c5',
        x: 4.5,
        y: 12.6,
        value: 25,
      },
      {
        id: 'tdm_02_c6',
        x: 8.5,
        y: 12.6,
        value: 25,
      },
      { id: 'tdm_02_c7', x: 16.5, y: 16.2, value: 15 },
      { id: 'tdm_02_c8', x: 22.5, y: 12.5, value: 20 },
      { id: 'tdm_02_c9', x: 24.5, y: 12.5, value: 20 },
      { id: 'tdm_02_c10', x: 28.5, y: 16.5, value: 15 },
      { id: 'tdm_02_c11', x: 32.5, y: 15.6, value: 15 },
    ],
    props: [
      {
        id: 'tdm_02_secret_chest',
        kind: 'chest',
        x: 3.0,
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
// 5. TDM — Monster's Trail: Meadow Arena (28 x 13, mode: 'arena')
// Symmetrical multi-tier combat arena with Horned Beetle, Bog Hopper,
// Cap Knight, Snapbloom, Canopy Hornet, Waystone Teleporter & Combo Coin.
// ============================================================================
const TDM_03 = buildRoom(
  [
    '############################', // ty=12
    '#..........................#', // ty=11
    '#..........................#', // ty=10
    '#..........................#', // ty=9
    '#..........------..........#', // ty=8
    '#..........................#', // ty=7
    '#..........................#', // ty=6
    '#.....-----......-----.....#', // ty=5
    '............................', // ty=4
    '............................', // ty=3
    '......O..............O......', // ty=2
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'tdm_03',
    name: "Monster's Trail — Meadow Arena",
    biome: 'TDM',
    mode: 'arena',
    mapX: 4,
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
        targetRoomId: 'flin_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: 'Infested Forest',
      },
    ],
    enemies: [
      {
        id: 'tdm_03_e1',
        archetype: 'horned_beetle',
        x: 9.0,
        y: 2.0,
        patrolMinX: 7.5,
        patrolMaxX: 13.5,
      },
      {
        id: 'tdm_03_e2',
        archetype: 'frog',
        x: 18.0,
        y: 2.0,
        patrolMinX: 14.0,
        patrolMaxX: 20.0,
      },
      {
        id: 'tdm_03_e3',
        archetype: 'mushroom_warrior',
        x: 8.0,
        y: 6.0,
        patrolMinX: 6.0,
        patrolMaxX: 10.0,
      },
      {
        id: 'tdm_03_e4',
        archetype: 'carnivorous_plant',
        x: 19.0,
        y: 6.0,
        patrolMinX: 17.0,
        patrolMaxX: 21.0,
      },
      {
        id: 'tdm_03_e5',
        archetype: 'frog',
        x: 13.5,
        y: 9.0,
        patrolMinX: 11.0,
        patrolMaxX: 16.0,
      },
      {
        id: 'tdm_03_e6',
        archetype: 'bee',
        x: 13.5,
        y: 5.5,
        patrolMinX: 10.0,
        patrolMaxX: 17.5,
      },
    ],
    coins: [{ id: 'tdm_03_coin_combo', x: 14.0, y: 10.0, kind: 'combo' }],
    crystals: [
      { id: 'tdm_03_c1', x: 6.5, y: 4.5, value: 15 },
      { id: 'tdm_03_c2', x: 8.5, y: 7.2, value: 15 },
      { id: 'tdm_03_c3', x: 12.5, y: 10.2, value: 20 },
      { id: 'tdm_03_c4', x: 15.5, y: 10.2, value: 20 },
      { id: 'tdm_03_c5', x: 19.5, y: 7.2, value: 15 },
      { id: 'tdm_03_c6', x: 21.5, y: 4.5, value: 15 },
      { id: 'tdm_03_c7', x: 11.5, y: 2.8, value: 15 },
      { id: 'tdm_03_c8', x: 16.5, y: 2.8, value: 15 },
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
// 6. FLIN — Infested Forest: Vine Canopy (48 x 16)
// Slippery vine rails, wind updrafts, bounce blocks, Volt Node test run,
// Bee/Plant/Frog combo chain, and Save Shrine before the Canopy Sanctum.
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
    '...........V............WW..............V.......', // ty=4  tx=0, tx=47 OPEN
    '...........V............WW..............V.......', // ty=3  tx=0, tx=47 OPEN
    '.............O..........OO...........O..........', // ty=2  tx=0, tx=47 OPEN
    '################################################', // ty=1
    '################################################', // ty=0
  ],
  {
    id: 'flin_01',
    name: 'Infested Forest — Vine Canopy',
    biome: 'FLIN',
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
        targetRoomId: 'tdm_03',
        targetSpawnX: 25.0,
        targetSpawnY: 2.0,
        label: 'Meadow Arena',
      },
      {
        dir: 'right',
        x: 47,
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
      {
        id: 'flin_01_e1',
        archetype: 'frog',
        x: 7.5,
        y: 2.0,
        patrolMinX: 5.5,
        patrolMaxX: 10.5,
      },
      {
        id: 'flin_01_e2',
        archetype: 'carnivorous_plant',
        x: 17.5,
        y: 7.0,
        patrolMinX: 15.5,
        patrolMaxX: 19.8,
      },
      {
        id: 'flin_01_e3',
        archetype: 'frog',
        x: 18.0,
        y: 2.0,
        patrolMinX: 15.0,
        patrolMaxX: 22.5,
      },
      {
        id: 'flin_01_e4',
        archetype: 'bee',
        x: 21.5,
        y: 9.2,
        patrolMinX: 19.0,
        patrolMaxX: 23.5,
      },
      {
        id: 'flin_01_e5',
        archetype: 'bee',
        x: 30.5,
        y: 8.5,
        patrolMinX: 28.0,
        patrolMaxX: 34.5,
      },
      {
        id: 'flin_01_e6',
        archetype: 'carnivorous_plant',
        x: 32.5,
        y: 7.0,
        patrolMinX: 29.0,
        patrolMaxX: 35.8,
      },
      {
        id: 'flin_01_e7',
        archetype: 'bee',
        x: 36.5,
        y: 8.5,
        patrolMinX: 34.5,
        patrolMaxX: 37.9,
      },
    ],
    coins: [
      { id: 'flin_01_coin_1', x: 32.0, y: 12.2, kind: 'world' },
      { id: 'flin_01_coin_combo', x: 41.5, y: 3.5, kind: 'combo' },
    ],
    crystals: [
      { id: 'flin_01_c1', x: 6.5, y: 3.5, value: 15 },
      { id: 'flin_01_c2', x: 11.5, y: 5.5, value: 15 },
      { id: 'flin_01_c3', x: 11.5, y: 7.5, value: 15 },
      { id: 'flin_01_c4', x: 16.5, y: 8.2, value: 15 },
      { id: 'flin_01_c5', x: 19.0, y: 8.2, value: 15 },
      { id: 'flin_01_c6', x: 24.5, y: 6.0, value: 20 },
      { id: 'flin_01_c7', x: 25.5, y: 8.5, value: 20 },
      { id: 'flin_01_c8', x: 28.5, y: 10.6, value: 20 },
      { id: 'flin_01_c9', x: 30.5, y: 10.6, value: 20 },
      { id: 'flin_01_c10', x: 32.5, y: 10.6, value: 20 },
      { id: 'flin_01_c11', x: 31.0, y: 3.0, value: 15 },
      { id: 'flin_01_c12', x: 34.5, y: 3.0, value: 15 },
      { id: 'flin_01_c13', x: 40.5, y: 6.5, value: 15 },
      { id: 'flin_01_c14', x: 45.0, y: 2.8, value: 15 },
    ],
    props: [
      {
        id: 'flin_01_sign',
        kind: 'signpost',
        x: 4.0,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Infested Forest: Grip slippery vines, ride wind updrafts, and chain foes to the Canopy Sanctum!',
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
      {
        id: 'flin_01_save_shrine',
        kind: 'save_shrine',
        x: 43.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Sanctum Threshold Shrine',
      },
    ],
  },
);

// ============================================================================
// 7. AP — Primal Tree: Canopy Sanctum (26 x 14, mode: 'boss', bossId: 'primal_eye')
// Atmospheric boss sanctum with two elevated one-way ledges, high dive perch,
// bounce corners, and the 20 HP Primal Eye unlocking Leaf Form!
// ============================================================================
const AP_BOSS = buildRoom(
  [
    '##########################', // ty=13
    '#........................#', // ty=12
    '#........................#', // ty=11
    '#........................#', // ty=10
    '#..........----..........#', // ty=9
    '#........................#', // ty=8
    '#........................#', // ty=7
    '#........................#', // ty=6
    '#....-----......-----....#', // ty=5
    '.........................#', // ty=4  tx=0 OPEN
    '.........................#', // ty=3  tx=0 OPEN
    '....O................O...#', // ty=2  tx=0 OPEN, tx=4 'O', tx=21 'O'
    '##########################', // ty=1
    '##########################', // ty=0
  ],
  {
    id: 'ap_boss',
    name: 'Primal Tree — Canopy Sanctum',
    biome: 'AP',
    mode: 'boss',
    bossId: 'primal_eye',
    mapX: 6,
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
        targetSpawnX: 44.5,
        targetSpawnY: 2.0,
        label: 'Infested Forest',
      },
    ],
    enemies: [],
    coins: [{ id: 'ap_boss_coin_1', x: 13.0, y: 10.5, kind: 'boss' }],
    crystals: [
      { id: 'ap_boss_c1', x: 6.5, y: 6.8, value: 20 },
      { id: 'ap_boss_c2', x: 8.5, y: 6.8, value: 20 },
      { id: 'ap_boss_c3', x: 17.5, y: 6.8, value: 20 },
      { id: 'ap_boss_c4', x: 19.5, y: 6.8, value: 20 },
    ],
    props: [],
  },
);

// ============================================================================
// 8. GSHIP — Ghost Ship: Endless Deck (28 x 14, mode: 'arena')
// Haunted high-seas wave survival arena accessible immediately in Wave 1!
// ============================================================================
const GSHIP_01 = buildRoom(
  [
    '############################', // ty=13
    '#..........................#', // ty=12
    '#..........................#', // ty=11
    '#..........................#', // ty=10
    '#..........................#', // ty=9
    '#..........------..........#', // ty=8
    '#..........................#', // ty=7
    '#..........................#', // ty=6
    '#....-----........-----....#', // ty=5
    '#..........................#', // ty=4
    '#..........................#', // ty=3
    '#....O................O....#', // ty=2
    '############################', // ty=1
    '############################', // ty=0
  ],
  {
    id: 'gship_01',
    name: 'Ghost Ship — Endless Deck',
    biome: 'GSHIP',
    mode: 'arena',
    mapX: 1,
    mapY: -1,
    defaultSpawnX: 13.5,
    defaultSpawnY: 2.0,
    exits: [
      {
        dir: 'door',
        x: 2.0,
        y: 2.0,
        width: 1.5,
        height: 2.0,
        targetRoomId: 'hub_haven',
        targetSpawnX: 29.0,
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
        patrolMaxX: 13.0,
      },
      {
        id: 'gship_01_e2',
        archetype: 'ghost_owl',
        x: 18.5,
        y: 8.5,
        patrolMinX: 14.5,
        patrolMaxX: 22.5,
      },
      {
        id: 'gship_01_e3',
        archetype: 'ghost_pig',
        x: 14.0,
        y: 2.0,
        patrolMinX: 8.0,
        patrolMaxX: 19.5,
      },
    ],
    coins: [{ id: 'gship_01_coin_combo', x: 14.0, y: 10.0, kind: 'combo' }],
    crystals: [
      { id: 'gship_01_c1', x: 6.5, y: 6.8, value: 20 },
      { id: 'gship_01_c2', x: 8.5, y: 6.8, value: 20 },
      { id: 'gship_01_c3', x: 13.0, y: 9.8, value: 25 },
      { id: 'gship_01_c4', x: 15.0, y: 9.8, value: 25 },
      { id: 'gship_01_c5', x: 19.5, y: 6.8, value: 20 },
      { id: 'gship_01_c6', x: 21.5, y: 6.8, value: 20 },
    ],
    props: [
      {
        id: 'gship_sign',
        kind: 'signpost',
        x: 4.0,
        y: 2.0,
        width: 0.9,
        height: 1.0,
        label: 'Ghost Ship Endless Deck — Chain spectral corsairs across escalating waves!',
      },
      {
        id: 'gship_volt_1',
        kind: 'volt_node',
        x: 10.0,
        y: 10.5,
        width: 0.8,
        height: 0.8,
        label: 'Rigging Lantern',
      },
      {
        id: 'gship_volt_2',
        kind: 'volt_node',
        x: 17.2,
        y: 10.5,
        width: 0.8,
        height: 0.8,
        label: 'Rigging Lantern',
      },
    ],
  },
);

export const WAVE1_ROOMS: readonly RoomDef[] = [
  MLAIR_01,
  HUB_HAVEN,
  TDM_01,
  TDM_02,
  TDM_03,
  FLIN_01,
  AP_BOSS,
  GSHIP_01,
] as const;

export const WAVE1_ROOM_ORDER: readonly string[] = WAVE1_ROOMS.map((room) => room.id);
