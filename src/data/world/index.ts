import type {
  HeroFormDef,
  HeroFormId,
  IWorldCatalog,
  RelicDef,
  RelicId,
  RoomDef,
  UpgradeDef,
  UpgradeKey,
} from '../../contracts/index';
import { BOSSES_BY_ID } from '../bosses';
import { ENEMY_ARCHETYPES_BY_ID } from '../enemies';
import { HERO_FORM_DEFS, HERO_FORMS_BY_ID } from '../forms';
import { RELICS, RELICS_BY_ID } from '../relics';
import { UPGRADES, UPGRADES_BY_KEY } from '../upgrades';
import { AP_ROOMS } from './regions/ap';
import { ATVC_ROOMS } from './regions/atvc';
import { DSI_ROOMS } from './regions/dsi';
import { EVIL_ROOMS } from './regions/evil';
import { FLIN_ROOMS } from './regions/flin';
import { GSHIP_ROOMS } from './regions/gship';
import { HUB_ROOMS } from './regions/hub';
import { LAB_ROOMS } from './regions/lab';
import { MLAIR_ROOMS } from './regions/mlair';
import { TDM_ROOMS } from './regions/tdm';
import { TEMP_ROOMS } from './regions/temp';

export { CHAR_TO_TILE, TILE_TO_CHAR, getTileAt, isSolidTile, parseRoomGrid } from './parseGrid';
export type { ParsedRoomGrid } from './parseGrid';
export { WAVE1_ROOM_ORDER, WAVE1_ROOMS } from './slice';

export const WORLD_ROOMS: readonly RoomDef[] = [
  ...MLAIR_ROOMS,
  ...HUB_ROOMS,
  ...TDM_ROOMS,
  ...FLIN_ROOMS,
  ...AP_ROOMS,
  ...ATVC_ROOMS,
  ...DSI_ROOMS,
  ...LAB_ROOMS,
  ...TEMP_ROOMS,
  ...EVIL_ROOMS,
  ...GSHIP_ROOMS,
] as const;

export const WORLD_ROOM_ORDER: readonly string[] = WORLD_ROOMS.map((room) => room.id);

export const START_ROOM_ID = 'mlair_01';
export const HUB_ROOM_ID = 'hub_haven';
export const GHOST_SHIP_ROOM_ID = 'gship_01';

export function createWorldCatalog(): IWorldCatalog {
  const rooms = new Map<string, RoomDef>();
  const coinIds = new Set<string>();

  for (const room of WORLD_ROOMS) {
    rooms.set(room.id, room);
    for (const coin of room.coins) {
      coinIds.add(coin.id);
    }
  }

  return {
    startRoomId: START_ROOM_ID,
    hubRoomId: HUB_ROOM_ID,
    ghostShipRoomId: GHOST_SHIP_ROOM_ID,
    rooms,
    roomOrder: WORLD_ROOM_ORDER,
    upgrades: UPGRADES,
    relics: RELICS,
    forms: HERO_FORM_DEFS,
    enemies: ENEMY_ARCHETYPES_BY_ID,
    bosses: BOSSES_BY_ID,
    totalCoins: coinIds.size,

    getRoom(id: string): RoomDef {
      const room = rooms.get(id);
      if (!room) {
        throw new Error(`WorldCatalog: unknown room '${id}'`);
      }
      return room;
    },

    getUpgrade(key: UpgradeKey): UpgradeDef {
      const upgrade = UPGRADES_BY_KEY.get(key);
      if (!upgrade) {
        throw new Error(`WorldCatalog: unknown upgrade '${key}'`);
      }
      return upgrade;
    },

    getRelic(id: RelicId): RelicDef {
      const relic = RELICS_BY_ID.get(id);
      if (!relic) {
        throw new Error(`WorldCatalog: unknown relic '${id}'`);
      }
      return relic;
    },

    getForm(id: HeroFormId): HeroFormDef {
      const form = HERO_FORMS_BY_ID.get(id);
      if (!form) {
        throw new Error(`WorldCatalog: unknown form '${id}'`);
      }
      return form;
    },
  };
}
