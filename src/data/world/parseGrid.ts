import { TileCode } from '../../contracts/index';

export interface ParsedRoomGrid {
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly tiles: Uint8Array;
}

export const CHAR_TO_TILE: Readonly<Record<string, TileCode>> = {
  '.': TileCode.Empty,
  '#': TileCode.Solid,
  '-': TileCode.OneWay,
  '^': TileCode.Spike,
  B: TileCode.Breakable,
  S: TileCode.StoneOverhead,
  O: TileCode.Bounce,
  V: TileCode.Vine,
  A: TileCode.Acid,
  L: TileCode.Lava,
  Q: TileCode.Quicksand,
  C: TileCode.Crumble,
  X: TileCode.Explosive,
  G: TileCode.Antigrav,
  W: TileCode.WindUp,
  '<': TileCode.WindLeft,
  '>': TileCode.WindRight,
  '?': TileCode.SecretWall,
};

export const TILE_TO_CHAR: Readonly<Record<TileCode, string>> = {
  [TileCode.Empty]: '.',
  [TileCode.Solid]: '#',
  [TileCode.OneWay]: '-',
  [TileCode.Spike]: '^',
  [TileCode.Breakable]: 'B',
  [TileCode.StoneOverhead]: 'S',
  [TileCode.Bounce]: 'O',
  [TileCode.Vine]: 'V',
  [TileCode.Acid]: 'A',
  [TileCode.Lava]: 'L',
  [TileCode.Quicksand]: 'Q',
  [TileCode.Crumble]: 'C',
  [TileCode.Explosive]: 'X',
  [TileCode.Antigrav]: 'G',
  [TileCode.WindUp]: 'W',
  [TileCode.WindLeft]: '<',
  [TileCode.WindRight]: '>',
  [TileCode.SecretWall]: '?',
};

/**
 * Converts top-to-bottom ASCII rows into a Y-UP Uint8Array tile grid
 * where asciiRows[0] maps to ty = heightTiles - 1 (top) and
 * asciiRows[heightTiles - 1] maps to ty = 0 (bottom floor).
 */
export function parseRoomGrid(asciiRows: readonly string[]): ParsedRoomGrid {
  const heightTiles = asciiRows.length;
  if (heightTiles === 0) {
    throw new Error('parseRoomGrid: asciiRows must contain at least one row');
  }

  const widthTiles = asciiRows[0].length;
  if (widthTiles === 0) {
    throw new Error('parseRoomGrid: asciiRows must have non-zero width');
  }

  const tiles = new Uint8Array(widthTiles * heightTiles);

  for (let rowIdx = 0; rowIdx < heightTiles; rowIdx++) {
    const row = asciiRows[rowIdx];
    if (row.length !== widthTiles) {
      throw new Error(
        `parseRoomGrid: row ${rowIdx} has length ${row.length}, expected ${widthTiles}`,
      );
    }

    const ty = heightTiles - 1 - rowIdx;
    const rowOffset = ty * widthTiles;

    for (let tx = 0; tx < widthTiles; tx++) {
      const ch = row[tx];
      const code = CHAR_TO_TILE[ch];
      if (code === undefined) {
        throw new Error(
          `parseRoomGrid: unknown tile character '${ch}' at row ${rowIdx}, col ${tx}`,
        );
      }
      tiles[rowOffset + tx] = code;
    }
  }

  return { widthTiles, heightTiles, tiles };
}

export function getTileAt(
  tiles: Uint8Array,
  widthTiles: number,
  heightTiles: number,
  tx: number,
  ty: number,
): TileCode {
  if (tx < 0 || ty < 0 || tx >= widthTiles || ty >= heightTiles) {
    return TileCode.Solid;
  }
  return tiles[ty * widthTiles + tx] as TileCode;
}

export function isSolidTile(code: TileCode): boolean {
  return (
    code === TileCode.Solid ||
    code === TileCode.Breakable ||
    code === TileCode.StoneOverhead ||
    code === TileCode.Bounce ||
    code === TileCode.Crumble ||
    code === TileCode.Explosive
  );
}
