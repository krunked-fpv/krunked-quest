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
// OPOUSO — Subrosa Haven Hub (56 x 15)
// Spacious sanctuary plaza with all 6 Hub NPCs generously spaced apart,
// 7 rescueable Animal Houses, Waystone Teleporter, Save Shrine, Form Totem,
// and direct portals to Tutorial Lair, Monster's Trail, Desert Shortcut,
// Nightmare Spire, and Captain Barnacle's Ghost Ship Dock!
// ============================================================================
const HUB_HAVEN = buildRoom(
  [
    '########################################################', // ty=14
    '#......................................................#', // ty=13
    '#......................................................#', // ty=12
    '#......................................................#', // ty=11
    '#......................................................#', // ty=10
    '#....----..----------------------------------..----....#', // ty=9  upper sanctuary terrace
    '#......................................................#', // ty=8
    '#......................................................#', // ty=7
    '#......................................................#', // ty=6
    '#....----------------------------------------------....#', // ty=5  mid animal & shrine promenade
    '........................................................', // ty=4  tx=0,55 OPEN
    '........................................................', // ty=3  tx=0,55 OPEN
    '...........O................................O...........', // ty=2  tx=0,55 OPEN; bounce pads tx=11,44
    '########################################################', // ty=1
    '########################################################', // ty=0
  ],
  {
    id: 'hub_haven',
    name: 'Subrosa Haven',
    biome: 'OPOUSO',
    mode: 'normal',
    mapX: 0,
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
        targetRoomId: 'mlair_03',
        targetSpawnX: 33.0,
        targetSpawnY: 2.0,
        label: 'Tutorial Lair',
      },
      {
        dir: 'right',
        x: 55,
        y: 2,
        width: 1,
        height: 3,
        targetRoomId: 'tdm_01',
        targetSpawnX: 2.0,
        targetSpawnY: 2.0,
        label: "Monster's Trail",
      },
      {
        dir: 'door',
        x: 50.0,
        y: 2.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'gship_01',
        targetSpawnX: 3.0,
        targetSpawnY: 2.0,
        label: 'Ghost Ship Dock',
      },
      {
        dir: 'door',
        x: 38.5,
        y: 6.0,
        width: 1.5,
        height: 2.5,
        targetRoomId: 'dsi_boss',
        targetSpawnX: 13.5,
        targetSpawnY: 2.0,
        label: 'Desert Shortcut',
      },
      {
        dir: 'door',
        x: 27.0,
        y: 10.0,
        width: 2.0,
        height: 2.5,
        targetRoomId: 'evil_01',
        targetSpawnX: 4.0,
        targetSpawnY: 2.0,
        label: 'Nightmare Spire Gate',
      },
    ],
    enemies: [],
    coins: [
      { id: 'hub_haven_coin_1', x: 28.0, y: 13.0, kind: 'world' },
      { id: 'hub_haven_coin_2', x: 6.5, y: 11.4, kind: 'world' },
      { id: 'hub_haven_coin_3', x: 49.0, y: 11.4, kind: 'world' },
      { id: 'hub_haven_coin_chest', x: 42.5, y: 10.6, kind: 'chest' },
    ],
    crystals: [
      { id: 'hub_haven_c1', x: 11.5, y: 7.5, value: 10 },
      { id: 'hub_haven_c2', x: 22.0, y: 7.5, value: 10 },
      { id: 'hub_haven_c3', x: 34.0, y: 7.5, value: 10 },
      { id: 'hub_haven_c4', x: 44.5, y: 7.5, value: 10 },
      { id: 'hub_haven_c5', x: 25.0, y: 11.8, value: 15 },
      { id: 'hub_haven_c6', x: 31.0, y: 11.8, value: 15 },
    ],
    props: [
      // Core Hub Infrastructure (lower plaza y=2.0)
      {
        id: 'hub_save_shrine',
        kind: 'save_shrine',
        x: 4.0,
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
      // All 6 Hub NPCs generously spaced (6.0u - 6.5u apart so labels never crowd)
      {
        id: 'npc_vespera',
        kind: 'shop_npc',
        shopId: 'vespera',
        x: 14.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Vespera — Core Upgrades',
      },
      {
        id: 'npc_orla',
        kind: 'shop_npc',
        shopId: 'orla',
        x: 21.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Orla — Form Upgrades & Maps',
      },
      {
        id: 'npc_barnaby',
        kind: 'shop_npc',
        shopId: 'barnaby',
        x: 27.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Barnaby — Relics',
      },
      {
        id: 'npc_garron',
        kind: 'shop_npc',
        shopId: 'garron',
        x: 34.0,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Garron — Boss Rematch',
      },
      {
        id: 'npc_codex',
        kind: 'shop_npc',
        shopId: 'codex',
        x: 40.5,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Codex — Guide Tome',
      },
      {
        id: 'npc_barnacle',
        kind: 'shop_npc',
        shopId: 'barnacle',
        x: 46.8,
        y: 2.0,
        width: 1.0,
        height: 1.25,
        label: 'Capt. Barnacle — Ghost Ship',
      },
      // Mid Promenade (y=6.0): Form Totem, Signpost & 4 Animal Houses
      {
        id: 'hub_animal_1',
        kind: 'animal_house',
        animalName: 'Bramble Pup',
        x: 7.0,
        y: 6.0,
        width: 1.5,
        height: 1.4,
      },
      {
        id: 'hub_animal_2',
        kind: 'animal_house',
        animalName: 'Canopy Finch',
        x: 13.0,
        y: 6.0,
        width: 1.5,
        height: 1.4,
      },
      {
        id: 'hub_animal_3',
        kind: 'animal_house',
        animalName: 'Ember Fox',
        x: 19.0,
        y: 6.0,
        width: 1.5,
        height: 1.4,
      },
      {
        id: 'hub_signpost',
        kind: 'signpost',
        x: 24.5,
        y: 6.0,
        width: 0.9,
        height: 1.0,
        label: "Eastward lies Monster's Trail! Unlock Leaf, Fire, Rock, and Volt Forms across the realm to topple the Nightmare Sovereign.",
      },
      {
        id: 'hub_form_totem',
        kind: 'form_totem',
        formId: 'krunk_basic',
        x: 31.0,
        y: 6.0,
        width: 1.0,
        height: 1.5,
        label: 'Form Totem — Krunk Resonance',
      },
      {
        id: 'hub_animal_4',
        kind: 'animal_house',
        animalName: 'Dune Fennec',
        x: 46.5,
        y: 6.0,
        width: 1.5,
        height: 1.4,
      },
      // Upper Sanctuary Terrace (y=10.0): 3 Animal Houses & Haven Chest
      {
        id: 'hub_animal_5',
        kind: 'animal_house',
        animalName: 'Gear Owl',
        x: 14.0,
        y: 10.0,
        width: 1.5,
        height: 1.4,
      },
      {
        id: 'hub_animal_6',
        kind: 'animal_house',
        animalName: 'Spark Hare',
        x: 20.5,
        y: 10.0,
        width: 1.5,
        height: 1.4,
      },
      {
        id: 'hub_animal_7',
        kind: 'animal_house',
        animalName: 'Moon Cat',
        x: 34.5,
        y: 10.0,
        width: 1.5,
        height: 1.4,
      },
      {
        id: 'hub_chest_1',
        kind: 'chest',
        x: 42.0,
        y: 10.0,
        width: 1.0,
        height: 0.85,
        coinId: 'hub_haven_coin_chest',
        label: 'Haven Belfry Chest',
      },
    ],
  },
);

export const HUB_ROOMS: readonly RoomDef[] = [HUB_HAVEN] as const;
