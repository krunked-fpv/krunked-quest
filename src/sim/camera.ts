import type { RoomDef, SimState } from '../contracts/index';
import {
  ARENA_ZOOM,
  PHYSICS,
  PPU,
  VIEWPORT_TILES_H,
  VIEWPORT_TILES_W,
} from './constants';

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function getRoomTargetZoom(room: RoomDef): number {
  return room.mode === 'arena' || room.mode === 'boss' ? ARENA_ZOOM : 1.0;
}

function clampToRoom(
  x: number,
  y: number,
  room: RoomDef,
  zoom: number,
): { x: number; y: number } {
  const halfW = (VIEWPORT_TILES_W * 0.5) / zoom;
  const halfH = (VIEWPORT_TILES_H * 0.5) / zoom;

  const clampedX =
    room.widthTiles <= halfW * 2
      ? room.widthTiles * 0.5
      : clamp(x, halfW, room.widthTiles - halfW);

  const clampedY =
    room.heightTiles <= halfH * 2
      ? room.heightTiles * 0.5
      : clamp(y, halfH, room.heightTiles - halfH);

  return { x: clampedX, y: clampedY };
}

export function snapCameraToHero(state: SimState, room: RoomDef): void {
  const cam = state.camera;
  const hero = state.hero;
  const zoom = getRoomTargetZoom(room);
  cam.zoom = zoom;

  const targetX = hero.x + hero.width * 0.5 + hero.facing * PHYSICS.CAM_LOOK_AHEAD;
  const targetY = hero.y + hero.height * 0.5 + 0.5;
  const clamped = clampToRoom(targetX, targetY, room, zoom);

  cam.x = clamped.x;
  cam.y = clamped.y;
  cam.prevX = clamped.x;
  cam.prevY = clamped.y;
  cam.snappedX = Math.round(cam.x * PPU) / PPU;
  cam.snappedY = Math.round(cam.y * PPU) / PPU;
}

export function updateCamera(state: SimState, room: RoomDef, dt: number): void {
  const cam = state.camera;
  const hero = state.hero;

  cam.prevX = cam.x;
  cam.prevY = cam.y;

  const targetZoom = getRoomTargetZoom(room);
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, PHYSICS.CAM_VEL * dt);

  const rawTargetX = hero.x + hero.width * 0.5 + hero.facing * PHYSICS.CAM_LOOK_AHEAD;
  const rawTargetY = hero.y + hero.height * 0.5 + 0.5;
  const target = clampToRoom(rawTargetX, rawTargetY, room, cam.zoom);

  const alpha = Math.min(1, PHYSICS.CAM_VEL * dt);
  cam.x += (target.x - cam.x) * alpha;
  cam.y += (target.y - cam.y) * alpha;

  const finalClamped = clampToRoom(cam.x, cam.y, room, cam.zoom);
  cam.x = finalClamped.x;
  cam.y = finalClamped.y;

  let shakeOffX = 0;
  let shakeOffY = 0;
  if (cam.shakeTimer > 0) {
    cam.shakeTimer = Math.max(0, cam.shakeTimer - dt);
    if (cam.shakeTimer > 0) {
      const decay = Math.min(1, cam.shakeTimer * 4);
      shakeOffX = Math.sin(state.tick * 1.9) * cam.shakeIntensity * decay;
      shakeOffY = Math.cos(state.tick * 2.7) * cam.shakeIntensity * decay;
    } else {
      cam.shakeIntensity = 0;
    }
  }

  cam.snappedX = Math.round((cam.x + shakeOffX) * PPU) / PPU;
  cam.snappedY = Math.round((cam.y + shakeOffY) * PPU) / PPU;
}
