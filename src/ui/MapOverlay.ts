import { BIOME_PALETTES } from '../assets/palettes.js';
import type { BiomeId, RoomDef, RoomExitDef } from '../contracts/index.js';
import { makeIcon } from './icons.js';
import type { OverlayActions, OverlayViewState } from './OverlayManager.js';

type ExitDir = RoomExitDef['dir'];

const DIRECTION_OFFSETS: Readonly<Record<Exclude<ExitDir, 'door'>, readonly [number, number]>> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, 1],
  down: [0, -1],
};

function getBiomeBgColor(biome: BiomeId): string {
  const pal = BIOME_PALETTES[biome];
  return pal ? pal.skyBot : '#2a1847';
}

function getBiomeAccentColor(biome: BiomeId): string {
  const pal = BIOME_PALETTES[biome];
  return pal ? pal.colors[0] : '#ffd84d';
}

function getBiomeLabel(biome: BiomeId): string {
  const pal = BIOME_PALETTES[biome];
  return pal ? pal.label : biome;
}

/** Strips redundant leading "Biome — " prefix inside compact map cells so names stay legible! */
function getCompactCellName(room: RoomDef): string {
  const dashIdx = room.name.indexOf('—');
  if (dashIdx >= 0 && dashIdx < room.name.length - 2) {
    return room.name.slice(dashIdx + 1).trim();
  }
  const hyphenIdx = room.name.indexOf(' - ');
  if (hyphenIdx >= 0 && hyphenIdx < room.name.length - 4) {
    return room.name.slice(hyphenIdx + 3).trim();
  }
  return room.name;
}

function exitDirArrow(dir: ExitDir): string {
  switch (dir) {
    case 'left':
      return '←';
    case 'right':
      return '→';
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'door':
      return '◈';
  }
}

export function buildMapPanel(
  doc: Document,
  view: OverlayViewState,
  actions: OverlayActions,
): HTMLElement {
  const panel = doc.createElement('div');
  panel.className = 'kq-panel kq-panel-map';

  const progress = view.simState.progress;
  const currentRoomId = view.simState.roomId;
  const visitedSet = new Set<string>(progress.visitedRooms);
  visitedSet.add(currentRoomId);
  const tpSet = new Set<string>(progress.unlockedTeleporters);
  const collectedCoinsSet = new Set<string>(progress.collectedCoinIds);
  const defeatedBossSet = new Set<string>(progress.defeatedBosses);

  const showExits = (progress.upgradeLevels.ViewMapExits ?? 0) > 0;
  const showSecrets = (progress.upgradeLevels.ViewSecretAreas ?? 0) > 0;
  const showArenas = (progress.upgradeLevels.ViewMapArenas ?? 0) > 0;

  const allRooms = Array.from(view.catalog.rooms.values());

  const regionStats = new Map<
    BiomeId,
    { roomsTotal: number; roomsVisited: number; coinsTotal: number; coinsCollected: number }
  >();
  for (const room of allRooms) {
    let st = regionStats.get(room.biome);
    if (!st) {
      st = { roomsTotal: 0, roomsVisited: 0, coinsTotal: 0, coinsCollected: 0 };
      regionStats.set(room.biome, st);
    }
    st.roomsTotal++;
    if (visitedSet.has(room.id)) st.roomsVisited++;
    st.coinsTotal += room.coins.length;
    for (const c of room.coins) {
      if (collectedCoinsSet.has(c.id)) st.coinsCollected++;
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const roomByCoord = new Map<string, RoomDef>();
  for (const r of allRooms) {
    minX = Math.min(minX, r.mapX);
    maxX = Math.max(maxX, r.mapX);
    minY = Math.min(minY, r.mapY);
    maxY = Math.max(maxY, r.mapY);
    roomByCoord.set(`${r.mapX},${r.mapY}`, r);
  }
  if (!Number.isFinite(minX)) {
    minX = maxX = minY = maxY = 0;
  }

  const cols = Math.max(1, maxX - minX + 1);

  // Header
  const header = doc.createElement('div');
  header.className = 'kq-panel-header';

  const headLeft = doc.createElement('div');
  const title = doc.createElement('h2');
  title.className = 'kq-panel-heading';
  title.append(makeIcon(doc, 'map', 19), doc.createTextNode('WORLD MAP'));
  const sub = doc.createElement('div');
  sub.className = 'kq-panel-subheading';
  sub.textContent = `Explored ${visitedSet.size}/${allRooms.length} Rooms · Coins ${progress.collectedCoinIds.length}/${view.catalog.totalCoins} · ${regionStats.size} Biomes`;
  headLeft.append(title, sub);

  const headRight = doc.createElement('div');
  headRight.className = 'kq-map-head-actions';

  const upgStrip = doc.createElement('div');
  upgStrip.className = 'kq-map-upgrades';
  const upgBadges: ReadonlyArray<{ label: string; active: boolean; title: string }> = [
    { label: 'Exits', active: showExits, title: 'Wayfinder Chart (Orla): highlights unvisited exits' },
    { label: 'Secrets', active: showSecrets, title: 'Hidden Sanctum Lens (Orla): reveals secret rooms' },
    { label: 'Arenas', active: showArenas, title: "Challenger's Compass (Orla): badges arenas & bosses" },
  ];
  for (const u of upgBadges) {
    const b = doc.createElement('span');
    b.className = u.active ? 'kq-badge kq-badge-active' : 'kq-badge kq-badge-dim';
    b.append(makeIcon(doc, u.active ? 'check' : 'lock', 11), doc.createTextNode(u.label));
    b.title = u.title;
    upgStrip.appendChild(b);
  }

  let zoomLevel: 1 | 0.8 | 1.2 = 1;
  const zoomBtn = doc.createElement('button');
  zoomBtn.type = 'button';
  zoomBtn.className = 'kq-btn kq-btn-sm';
  zoomBtn.textContent = '100%';

  const centerBtn = doc.createElement('button');
  centerBtn.type = 'button';
  centerBtn.className = 'kq-btn kq-btn-sm';
  centerBtn.append(makeIcon(doc, 'compass', 13), doc.createTextNode('Center'));

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kq-btn kq-btn-sm kq-btn-primary';
  closeBtn.append(makeIcon(doc, 'close', 13), doc.createTextNode('Close'));
  closeBtn.addEventListener('click', () => {
    actions.onUiSfx?.('back');
    actions.onCloseMap();
  });

  headRight.append(upgStrip, zoomBtn, centerBtn, closeBtn);
  header.append(headLeft, headRight);
  panel.appendChild(header);

  const unvisitedAdjacentIds = new Set<string>();
  for (const r of allRooms) {
    if (!visitedSet.has(r.id)) continue;
    for (const exit of r.exits) {
      if (!visitedSet.has(exit.targetRoomId) && view.catalog.rooms.has(exit.targetRoomId)) {
        unvisitedAdjacentIds.add(exit.targetRoomId);
      }
    }
  }

  const gridWrap = doc.createElement('div');
  gridWrap.className = 'kq-map-grid-wrap';
  gridWrap.setAttribute('aria-label', 'Interactive World Map Grid');

  const grid = doc.createElement('div');
  grid.className = 'kq-map-grid';
  const cellW = cols > 10 ? 110 : 122;
  grid.style.gridTemplateColumns = `repeat(${cols}, ${cellW}px)`;

  const currentRoom = view.catalog.rooms.get(currentRoomId) ?? allRooms[0] ?? null;
  let inspectedRoom: RoomDef | null = currentRoom;
  let selectedCellEl: HTMLButtonElement | null = null;
  let currentCellEl: HTMLButtonElement | null = null;
  const cellByRoomId = new Map<string, HTMLButtonElement>();

  const inspector = doc.createElement('div');
  inspector.className = 'kq-map-inspector';

  const updateInspector = (room: RoomDef | null) => {
    inspectedRoom = room;
    inspector.innerHTML = '';
    if (!room) return;

    const visited = visitedSet.has(room.id);
    const isCurrent = room.id === currentRoomId;
    const canTp = tpSet.has(room.id);
    const revealed =
      visited ||
      (Boolean(room.isSecret) && showSecrets) ||
      (room.mode !== 'normal' && showArenas);
    const rStats = regionStats.get(room.biome);

    let roomCoinsCollected = 0;
    for (const c of room.coins) {
      if (collectedCoinsSet.has(c.id)) roomCoinsCollected++;
    }

    const leftCol = doc.createElement('div');
    leftCol.className = 'kq-map-inspector-main';

    const titleLine = doc.createElement('div');
    titleLine.className = 'kq-map-inspector-title';

    const biomeChip = doc.createElement('span');
    biomeChip.className = 'kq-biome-chip';
    biomeChip.style.backgroundColor = getBiomeBgColor(room.biome);
    biomeChip.style.borderColor = getBiomeAccentColor(room.biome);
    biomeChip.textContent = `${room.biome} · ${getBiomeLabel(room.biome)}`;

    const nameEl = doc.createElement('strong');
    nameEl.textContent = revealed ? room.name : 'Uncharted Chamber';

    titleLine.append(nameEl, biomeChip);

    if (isCurrent) {
      const youTag = doc.createElement('span');
      youTag.className = 'kq-badge kq-badge-gold';
      youTag.append(makeIcon(doc, 'compass', 11), doc.createTextNode('Current'));
      titleLine.appendChild(youTag);
    }
    if (room.isSecret && (visited || showSecrets)) {
      const secTag = doc.createElement('span');
      secTag.className = 'kq-badge kq-badge-secret';
      secTag.append(makeIcon(doc, 'sparkle', 11), doc.createTextNode('Secret'));
      titleLine.appendChild(secTag);
    }
    if (room.mode === 'boss' && (visited || showArenas)) {
      const bossDef = room.bossId ? view.catalog.bosses.get(room.bossId) : undefined;
      const defeated = room.bossId ? defeatedBossSet.has(room.bossId) : false;
      const bTag = doc.createElement('span');
      bTag.className = defeated ? 'kq-badge kq-badge-active' : 'kq-badge kq-badge-danger';
      bTag.append(
        makeIcon(doc, defeated ? 'check' : 'skull', 11),
        doc.createTextNode(defeated ? `${bossDef?.name ?? 'Boss'} Cleared` : bossDef?.name ?? 'Boss Sanctum'),
      );
      titleLine.appendChild(bTag);
    } else if (room.mode === 'arena' && (visited || showArenas)) {
      const aTag = doc.createElement('span');
      aTag.className = 'kq-badge kq-badge-ready';
      aTag.append(makeIcon(doc, 'swords', 11), doc.createTextNode('Combat Arena'));
      titleLine.appendChild(aTag);
    }

    const metaLine = doc.createElement('div');
    metaLine.className = 'kq-map-inspector-meta';

    const roomCoinTxt = `Room Coins: ${roomCoinsCollected}/${room.coins.length}`;
    const regionCoinTxt = rStats
      ? `Region: ${rStats.coinsCollected}/${rStats.coinsTotal} Coins (${rStats.roomsVisited}/${rStats.roomsTotal} Rooms)`
      : '';
    const totalCoinTxt = `World: ${progress.collectedCoinIds.length}/${view.catalog.totalCoins}`;
    metaLine.textContent = [roomCoinTxt, regionCoinTxt, totalCoinTxt].filter(Boolean).join('  ·  ');

    leftCol.append(titleLine, metaLine);

    if (revealed && room.exits.length > 0) {
      const exitsLine = doc.createElement('div');
      exitsLine.className = 'kq-map-inspector-exits';
      const exitSummaries = room.exits.map((ex) => {
        const target = view.catalog.rooms.get(ex.targetRoomId);
        const targetVisited = visitedSet.has(ex.targetRoomId);
        const label = targetVisited
          ? target?.name ?? ex.targetRoomId
          : showExits
            ? `Unvisited (${target?.biome ?? '?'})`
            : '???';
        return `${exitDirArrow(ex.dir)} ${label}`;
      });
      exitsLine.textContent = `Exits: ${exitSummaries.join('  |  ')}`;
      leftCol.appendChild(exitsLine);
    }

    inspector.appendChild(leftCol);

    const rightCol = doc.createElement('div');
    rightCol.className = 'kq-map-inspector-actions';
    if (canTp && !isCurrent) {
      const warpBtn = doc.createElement('button');
      warpBtn.type = 'button';
      warpBtn.className = 'kq-btn kq-btn-sm kq-btn-accent';
      warpBtn.append(makeIcon(doc, 'bolt', 13), doc.createTextNode(`Warp to ${getCompactCellName(room)}`));
      warpBtn.addEventListener('click', () => {
        actions.onUiSfx?.('confirm');
        actions.onFastTravel(room.id);
      });
      rightCol.appendChild(warpBtn);
    } else if (room.hasTeleporter && !canTp) {
      const lockedTp = doc.createElement('span');
      lockedTp.className = 'kq-badge';
      lockedTp.append(makeIcon(doc, 'bolt', 11), doc.createTextNode('Waystone Unvisited'));
      rightCol.appendChild(lockedTp);
    }
    inspector.appendChild(rightCol);
  };

  for (let gy = maxY; gy >= minY; gy--) {
    for (let gx = minX; gx <= maxX; gx++) {
      const room = roomByCoord.get(`${gx},${gy}`);
      if (!room) {
        const spacer = doc.createElement('div');
        spacer.className = 'kq-map-spacer';
        grid.appendChild(spacer);
        continue;
      }

      const visited = visitedSet.has(room.id);
      const isCurrent = room.id === currentRoomId;
      const canFastTravel = tpSet.has(room.id);
      const secretRevealed = Boolean(room.isSecret) && showSecrets;
      const arenaRevealed = room.mode !== 'normal' && showArenas;
      const exitHinted = !visited && showExits && unvisitedAdjacentIds.has(room.id);
      const revealed = visited || secretRevealed || arenaRevealed;

      const cell = doc.createElement('button');
      cell.type = 'button';
      let cls = 'kq-map-cell';
      if (isCurrent) cls += ' kq-map-cell-current';
      if (canFastTravel) cls += ' kq-map-cell-teleporter';
      if (room.isSecret && (visited || showSecrets)) cls += ' kq-map-cell-secret';
      if (room.mode === 'boss' && (visited || showArenas)) cls += ' kq-map-cell-boss';
      else if (room.mode === 'arena' && (visited || showArenas)) cls += ' kq-map-cell-arena';
      if (!revealed && exitHinted) cls += ' kq-map-cell-exit-hint';
      else if (!revealed) cls += ' kq-map-cell-unvisited';
      cell.className = cls;

      const biomeBg = getBiomeBgColor(room.biome);
      const biomeAccent = getBiomeAccentColor(room.biome);
      if (revealed) {
        cell.style.backgroundColor = biomeBg;
        cell.style.setProperty('--map-biome-accent', biomeAccent);
      } else if (exitHinted) {
        cell.style.backgroundColor = '#1c1233';
        cell.style.setProperty('--map-biome-accent', '#ffd84d');
      } else {
        cell.style.backgroundColor = '#120a20';
      }

      cell.disabled = !revealed && !exitHinted;
      cell.setAttribute('data-room-id', room.id);
      cell.setAttribute('data-biome', room.biome);

      if (revealed) {
        const edgeDirs = new Set<ExitDir>();
        const unvisitedEdgeDirs = new Set<ExitDir>();
        for (const ex of room.exits) {
          edgeDirs.add(ex.dir);
          if (!visitedSet.has(ex.targetRoomId)) {
            unvisitedEdgeDirs.add(ex.dir);
          }
        }
        for (const dir of ['left', 'right', 'up', 'down'] as const) {
          const hasExit = edgeDirs.has(dir);
          const [dx, dy] = DIRECTION_OFFSETS[dir];
          const neighbor = roomByCoord.get(`${gx + dx},${gy + dy}`);
          const neighborConnected =
            hasExit ||
            Boolean(neighbor && neighbor.exits.some((e) => e.targetRoomId === room.id));
          if (!neighborConnected) continue;

          const conn = doc.createElement('span');
          const isUnvisitedExit = showExits && unvisitedEdgeDirs.has(dir);
          conn.className = isUnvisitedExit
            ? `kq-map-conn kq-map-conn-${dir} kq-map-conn-unvisited`
            : `kq-map-conn kq-map-conn-${dir}`;
          cell.appendChild(conn);
        }
      }

      if (isCurrent) {
        const pulse = doc.createElement('span');
        pulse.className = 'kq-map-pulse-dot';
        pulse.setAttribute('aria-hidden', 'true');
        cell.appendChild(pulse);
      }

      const nameLine = doc.createElement('div');
      nameLine.className = 'kq-map-cell-name';
      nameLine.textContent = revealed ? getCompactCellName(room) : exitHinted ? '? Passage' : '···';

      const icons = doc.createElement('div');
      icons.className = 'kq-map-icons';
      const tags: string[] = [];
      if (isCurrent) tags.push('YOU');
      if (canFastTravel) tags.push('WARP');
      if ((visited || showArenas) && room.mode === 'boss') {
        const bossDefeated = room.bossId ? defeatedBossSet.has(room.bossId) : false;
        tags.push(bossDefeated ? '✓BOSS' : 'BOSS');
      } else if ((visited || showArenas) && room.mode === 'arena') {
        tags.push('ARENA');
      }
      if ((visited || showSecrets) && room.isSecret) {
        tags.push('★');
      }
      if (visited && room.coins.length > 0) {
        let rc = 0;
        for (const c of room.coins) {
          if (collectedCoinsSet.has(c.id)) rc++;
        }
        tags.push(rc >= room.coins.length ? '★ALL' : `${rc}/${room.coins.length}`);
      }
      if (showExits && revealed) {
        const unvisitedDirs = room.exits
          .filter((e) => !visitedSet.has(e.targetRoomId))
          .map((e) => exitDirArrow(e.dir));
        if (unvisitedDirs.length > 0) {
          tags.push(unvisitedDirs.join(''));
        }
      }
      icons.textContent = tags.join(' · ');

      cell.append(nameLine, icons);

      if (revealed || exitHinted) {
        cell.title = revealed
          ? canFastTravel
            ? `${room.name} (${room.biome}) — Click to Fast Travel`
            : `${room.name} (${room.biome})`
          : `Unexplored passage (${room.biome})`;

        const selectThisCell = () => {
          if (selectedCellEl) selectedCellEl.classList.remove('kq-map-cell-selected');
          selectedCellEl = cell;
          cell.classList.add('kq-map-cell-selected');
          updateInspector(room);
        };

        cell.addEventListener('mouseenter', selectThisCell);
        cell.addEventListener('focus', selectThisCell);
        cell.addEventListener('click', () => {
          selectThisCell();
          if (canFastTravel && !isCurrent) {
            actions.onUiSfx?.('confirm');
            actions.onFastTravel(room.id);
          }
        });
      }

      if (isCurrent) {
        currentCellEl = cell;
        selectedCellEl = cell;
        cell.classList.add('kq-map-cell-selected');
      }

      cellByRoomId.set(room.id, cell);
      grid.appendChild(cell);
    }
  }

  gridWrap.appendChild(grid);
  panel.appendChild(gridWrap);

  const applyZoom = () => {
    grid.style.transform = zoomLevel === 1 ? '' : `scale(${zoomLevel})`;
    grid.style.transformOrigin = 'top left';
    zoomBtn.textContent = `${Math.round(zoomLevel * 100)}%`;
  };
  zoomBtn.addEventListener('click', () => {
    actions.onUiSfx?.('tab');
    zoomLevel = zoomLevel === 1 ? 0.8 : zoomLevel === 0.8 ? 1.2 : 1;
    applyZoom();
  });

  const centerOnCell = (targetEl: HTMLElement | null) => {
    if (!targetEl) return;
    if (typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
  };
  centerBtn.addEventListener('click', () => {
    actions.onUiSfx?.('tab');
    centerOnCell(currentCellEl);
  });

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let scrollStartLeft = 0;
  let scrollStartTop = 0;

  gridWrap.addEventListener('pointerdown', (ev: PointerEvent) => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    const target = ev.target as HTMLElement | null;
    if (target && target.closest('button:not(:disabled)')) return;
    isDragging = true;
    dragStartX = ev.clientX;
    dragStartY = ev.clientY;
    scrollStartLeft = gridWrap.scrollLeft;
    scrollStartTop = gridWrap.scrollTop;
    gridWrap.classList.add('is-dragging');
  });

  gridWrap.addEventListener('pointermove', (ev: PointerEvent) => {
    if (!isDragging) return;
    gridWrap.scrollLeft = scrollStartLeft - (ev.clientX - dragStartX);
    gridWrap.scrollTop = scrollStartTop - (ev.clientY - dragStartY);
  });

  const stopDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    gridWrap.classList.remove('is-dragging');
  };
  gridWrap.addEventListener('pointerup', stopDrag);
  gridWrap.addEventListener('pointerleave', stopDrag);

  updateInspector(inspectedRoom);
  panel.appendChild(inspector);

  const tpSec = doc.createElement('section');
  tpSec.className = 'kq-section kq-map-tp-section';

  const tpHeader = doc.createElement('div');
  tpHeader.className = 'kq-map-tp-header';
  const tpTitle = doc.createElement('div');
  tpTitle.className = 'kq-section-title';
  const unlockedTps = progress.unlockedTeleporters.filter((id) => view.catalog.rooms.has(id));
  tpTitle.append(
    makeIcon(doc, 'bolt', 13),
    doc.createTextNode(`Fast Travel Waystones (${unlockedTps.length} Unlocked)`),
  );

  const hubBtn = doc.createElement('button');
  hubBtn.type = 'button';
  hubBtn.className =
    currentRoomId === view.catalog.hubRoomId
      ? 'kq-btn kq-btn-sm kq-btn-active'
      : 'kq-btn kq-btn-sm kq-btn-primary';
  hubBtn.append(makeIcon(doc, 'home', 13), doc.createTextNode('Jump to Subrosa Haven'));
  hubBtn.disabled = currentRoomId === view.catalog.hubRoomId;
  hubBtn.addEventListener('click', () => {
    actions.onUiSfx?.('confirm');
    actions.onReturnToHub();
  });

  tpHeader.append(tpTitle, hubBtn);
  tpSec.appendChild(tpHeader);

  const tpRow = doc.createElement('div');
  tpRow.className = 'kq-map-tp-list';
  if (unlockedTps.length === 0) {
    const emptyHint = doc.createElement('span');
    emptyHint.className = 'kq-panel-subheading';
    emptyHint.textContent = 'Activate Waystone Teleporters across biomes to unlock instant travel.';
    tpRow.appendChild(emptyHint);
  } else {
    for (const roomId of unlockedTps) {
      const r = view.catalog.rooms.get(roomId);
      if (!r) continue;
      const isHere = roomId === currentRoomId;
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = isHere ? 'kq-btn kq-btn-sm kq-btn-active' : 'kq-btn kq-btn-sm kq-btn-accent';
      b.append(makeIcon(doc, 'bolt', 12), doc.createTextNode(`${r.name} (${r.biome})`));
      b.disabled = isHere;
      b.addEventListener('focus', () => updateInspector(r));
      b.addEventListener('mouseenter', () => updateInspector(r));
      b.addEventListener('click', () => {
        actions.onUiSfx?.('confirm');
        actions.onFastTravel(roomId);
      });
      tpRow.appendChild(b);
    }
  }
  tpSec.appendChild(tpRow);
  panel.appendChild(tpSec);

  const biomeBar = doc.createElement('div');
  biomeBar.className = 'kq-map-biome-legend';
  for (const [biomeId, st] of regionStats.entries()) {
    const chip = doc.createElement('button');
    chip.type = 'button';
    chip.className = 'kq-biome-legend-btn';
    chip.style.borderColor = getBiomeAccentColor(biomeId);

    const sw = doc.createElement('span');
    sw.className = 'kq-swatch';
    sw.style.backgroundColor = getBiomeBgColor(biomeId);
    sw.style.borderColor = getBiomeAccentColor(biomeId);

    const lbl = doc.createElement('span');
    lbl.textContent = `${biomeId} ${st.roomsVisited}/${st.roomsTotal}`;

    chip.title = `${getBiomeLabel(biomeId)}: ${st.roomsVisited}/${st.roomsTotal} rooms · ${st.coinsCollected}/${st.coinsTotal} coins`;
    chip.append(sw, lbl);

    chip.addEventListener('click', () => {
      const targetRoom =
        allRooms.find((r) => r.biome === biomeId && visitedSet.has(r.id)) ??
        allRooms.find((r) => r.biome === biomeId);
      if (targetRoom) {
        actions.onUiSfx?.('move');
        const el = cellByRoomId.get(targetRoom.id) ?? null;
        centerOnCell(el);
        updateInspector(targetRoom);
      }
    });
    biomeBar.appendChild(chip);
  }
  panel.appendChild(biomeBar);

  if (typeof requestAnimationFrame === 'function' && currentCellEl) {
    const target = currentCellEl;
    requestAnimationFrame(() => {
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'center', inline: 'center' });
      }
    });
  }

  return panel;
}
