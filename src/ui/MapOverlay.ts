import { BIOME_PALETTES } from '../assets/palettes.js';
import type { BiomeId, RoomDef, RoomExitDef } from '../contracts/index.js';
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
  return pal ? pal.colors[0] : '#ffd644';
}

function getBiomeLabel(biome: BiomeId): string {
  const pal = BIOME_PALETTES[biome];
  return pal ? pal.label : biome;
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

  // Compute per-region coin & exploration totals
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

  // Compute map grid bounds
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
  title.textContent = 'WORLD MAP';
  const sub = doc.createElement('div');
  sub.className = 'kq-panel-subheading';
  sub.textContent = `EXPLORED ${visitedSet.size}/${allRooms.length} ROOMS · COINS ${progress.collectedCoinIds.length}/${view.catalog.totalCoins} · ${regionStats.size} BIOMES`;
  headLeft.append(title, sub);

  const headRight = doc.createElement('div');
  headRight.className = 'kq-map-head-actions';

  // Quick Cartography Upgrades status badges
  const upgStrip = doc.createElement('div');
  upgStrip.className = 'kq-map-upgrades';
  const upgBadges: ReadonlyArray<{ label: string; active: boolean; title: string }> = [
    { label: 'EXITS', active: showExits, title: 'Wayfinder Chart (Orla): highlights unvisited exits' },
    { label: 'SECRETS', active: showSecrets, title: 'Hidden Sanctum Lens (Orla): reveals secret rooms' },
    { label: 'ARENAS', active: showArenas, title: "Challenger's Compass (Orla): badges arenas & bosses" },
  ];
  for (const u of upgBadges) {
    const b = doc.createElement('span');
    b.className = u.active ? 'kq-badge kq-badge-active' : 'kq-badge kq-badge-dim';
    b.textContent = u.active ? `✓ ${u.label}` : `○ ${u.label}`;
    b.title = u.title;
    upgStrip.appendChild(b);
  }

  let zoomLevel: 1 | 0.8 | 1.2 = 1;
  const zoomBtn = doc.createElement('button');
  zoomBtn.type = 'button';
  zoomBtn.className = 'kq-btn kq-btn-sm';
  zoomBtn.textContent = 'ZOOM 100%';

  const centerBtn = doc.createElement('button');
  centerBtn.type = 'button';
  centerBtn.className = 'kq-btn kq-btn-sm';
  centerBtn.textContent = '◎ CENTER';

  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'kq-btn kq-btn-sm kq-btn-primary';
  closeBtn.textContent = 'CLOSE';
  closeBtn.addEventListener('click', () => actions.onCloseMap());

  headRight.append(upgStrip, zoomBtn, centerBtn, closeBtn);
  header.append(headLeft, headRight);
  panel.appendChild(header);

  // Determine which rooms are adjacent to visited rooms (for ViewMapExits hints)
  const unvisitedAdjacentIds = new Set<string>();
  for (const r of allRooms) {
    if (!visitedSet.has(r.id)) continue;
    for (const exit of r.exits) {
      if (!visitedSet.has(exit.targetRoomId) && view.catalog.rooms.has(exit.targetRoomId)) {
        unvisitedAdjacentIds.add(exit.targetRoomId);
      }
    }
  }

  // Interactive pan/scroll viewport
  const gridWrap = doc.createElement('div');
  gridWrap.className = 'kq-map-grid-wrap';
  gridWrap.setAttribute('aria-label', 'Interactive World Map Grid');

  const grid = doc.createElement('div');
  grid.className = 'kq-map-grid';
  const cellW = cols > 10 ? 78 : 92;
  grid.style.gridTemplateColumns = `repeat(${cols}, ${cellW}px)`;

  // Inspector state
  const currentRoom = view.catalog.rooms.get(currentRoomId) ?? allRooms[0] ?? null;
  let inspectedRoom: RoomDef | null = currentRoom;
  let selectedCellEl: HTMLButtonElement | null = null;
  let currentCellEl: HTMLButtonElement | null = null;
  const cellByRoomId = new Map<string, HTMLButtonElement>();

  // Inspector footer elements (created upfront so cell focus/click updates them live)
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
      youTag.textContent = '● CURRENT';
      titleLine.appendChild(youTag);
    }
    if (room.isSecret && (visited || showSecrets)) {
      const secTag = doc.createElement('span');
      secTag.className = 'kq-badge kq-badge-secret';
      secTag.textContent = '★ SECRET';
      titleLine.appendChild(secTag);
    }
    if (room.mode === 'boss' && (visited || showArenas)) {
      const bossDef = room.bossId ? view.catalog.bosses.get(room.bossId) : undefined;
      const defeated = room.bossId ? defeatedBossSet.has(room.bossId) : false;
      const bTag = doc.createElement('span');
      bTag.className = defeated ? 'kq-badge kq-badge-active' : 'kq-badge kq-badge-danger';
      bTag.textContent = defeated
        ? `✓ ${bossDef?.name ?? 'BOSS'} CLEARED`
        : `☠ ${bossDef?.name ?? 'BOSS SANCTUM'}`;
      titleLine.appendChild(bTag);
    } else if (room.mode === 'arena' && (visited || showArenas)) {
      const aTag = doc.createElement('span');
      aTag.className = 'kq-badge kq-badge-ready';
      aTag.textContent = '⚔ COMBAT ARENA';
      titleLine.appendChild(aTag);
    }

    const metaLine = doc.createElement('div');
    metaLine.className = 'kq-map-inspector-meta';

    const roomCoinTxt =
      room.coins.length > 0
        ? `ROOM COINS: ${roomCoinsCollected}/${room.coins.length}`
        : 'ROOM COINS: 0/0';
    const regionCoinTxt = rStats
      ? `REGION COINS: ${rStats.coinsCollected}/${rStats.coinsTotal} (${rStats.roomsVisited}/${rStats.roomsTotal} ROOMS)`
      : '';
    const totalCoinTxt = `WORLD TOTAL: ${progress.collectedCoinIds.length}/${view.catalog.totalCoins}`;

    const parts = [roomCoinTxt, regionCoinTxt, totalCoinTxt].filter(Boolean);
    metaLine.textContent = parts.join('  ·  ');

    leftCol.append(titleLine, metaLine);

    // Exits preview if visited or ViewMapExits active
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
      exitsLine.textContent = `EXITS: ${exitSummaries.join('  |  ')}`;
      leftCol.appendChild(exitsLine);
    }

    inspector.appendChild(leftCol);

    // Right action column in inspector (direct Fast Travel for inspected teleporter room)
    const rightCol = doc.createElement('div');
    rightCol.className = 'kq-map-inspector-actions';
    if (canTp && !isCurrent) {
      const warpBtn = doc.createElement('button');
      warpBtn.type = 'button';
      warpBtn.className = 'kq-btn kq-btn-sm kq-btn-accent';
      warpBtn.textContent = `⚡ WARP TO ${room.name.toUpperCase()}`;
      warpBtn.addEventListener('click', () => {
        actions.onFastTravel(room.id);
      });
      rightCol.appendChild(warpBtn);
    } else if (room.hasTeleporter && !canTp) {
      const lockedTp = doc.createElement('span');
      lockedTp.className = 'kq-badge';
      lockedTp.textContent = '⚡ TELEPORTER UNVISITED';
      rightCol.appendChild(lockedTp);
    }
    inspector.appendChild(rightCol);
  };

  // Build map cells (Y-up: maxY at top row, minY at bottom row)
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
        cell.style.setProperty('--map-biome-accent', '#ffd644');
      } else {
        cell.style.backgroundColor = '#120a20';
      }

      // Fogged unrevealed rooms are non-interactive; revealed or exit-hinted rooms can be inspected
      cell.disabled = !revealed && !exitHinted;
      cell.setAttribute('data-room-id', room.id);
      cell.setAttribute('data-biome', room.biome);

      // Connecting path indicators along cell edges
      if (revealed) {
        const edgeDirs = new Set<ExitDir>();
        const unvisitedEdgeDirs = new Set<ExitDir>();
        for (const ex of room.exits) {
          edgeDirs.add(ex.dir);
          if (!visitedSet.has(ex.targetRoomId)) {
            unvisitedEdgeDirs.add(ex.dir);
          }
        }
        // Also detect visual coordinate adjacency if exit targets adjacent grid cell
        for (const dir of ['left', 'right', 'up', 'down'] as const) {
          const hasExit = edgeDirs.has(dir);
          const [dx, dy] = DIRECTION_OFFSETS[dir];
          const neighbor = roomByCoord.get(`${gx + dx},${gy + dy}`);
          const neighborConnected =
            hasExit ||
            Boolean(
              neighbor &&
                neighbor.exits.some((e) => e.targetRoomId === room.id),
            );
          if (!neighborConnected) continue;

          const conn = doc.createElement('span');
          const isUnvisitedExit = showExits && unvisitedEdgeDirs.has(dir);
          conn.className = isUnvisitedExit
            ? `kq-map-conn kq-map-conn-${dir} kq-map-conn-unvisited`
            : `kq-map-conn kq-map-conn-${dir}`;
          cell.appendChild(conn);
        }
      }

      // Pulsing beacon on current room
      if (isCurrent) {
        const pulse = doc.createElement('span');
        pulse.className = 'kq-map-pulse-dot';
        pulse.setAttribute('aria-hidden', 'true');
        cell.appendChild(pulse);
      }

      // Top row: concise room label
      const nameLine = doc.createElement('div');
      nameLine.className = 'kq-map-cell-name';
      nameLine.textContent = revealed ? room.name : exitHinted ? '? EXIT' : '···';

      // Bottom row: icons (Current, Teleporter, Boss/Arena, Secret, Coins completion, Unvisited Exits)
      const icons = doc.createElement('div');
      icons.className = 'kq-map-icons';
      const tags: string[] = [];
      if (isCurrent) tags.push('●YOU');
      if (canFastTravel) tags.push('⚡');
      if ((visited || showArenas) && room.mode === 'boss') {
        const bossDefeated = room.bossId ? defeatedBossSet.has(room.bossId) : false;
        tags.push(bossDefeated ? '✓☠' : '☠');
      } else if ((visited || showArenas) && room.mode === 'arena') {
        tags.push('⚔');
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
      icons.textContent = tags.join(' ');

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

  // Zoom & Center behavior
  const applyZoom = () => {
    grid.style.transform = zoomLevel === 1 ? '' : `scale(${zoomLevel})`;
    grid.style.transformOrigin = 'top left';
    zoomBtn.textContent = `ZOOM ${Math.round(zoomLevel * 100)}%`;
  };
  zoomBtn.addEventListener('click', () => {
    zoomLevel = zoomLevel === 1 ? 0.8 : zoomLevel === 0.8 ? 1.2 : 1;
    applyZoom();
  });

  const centerOnCell = (targetEl: HTMLElement | null) => {
    if (!targetEl) return;
    if (typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
    }
  };
  centerBtn.addEventListener('click', () => centerOnCell(currentCellEl));

  // Mouse drag-to-pan on the map viewport
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

  // Render initial inspector state for current room
  updateInspector(inspectedRoom);
  panel.appendChild(inspector);

  // Fast Travel Dock: Quick Jump to Subrosa Haven Hub + all unlocked Teleporters
  const tpSec = doc.createElement('section');
  tpSec.className = 'kq-section kq-map-tp-section';

  const tpHeader = doc.createElement('div');
  tpHeader.className = 'kq-map-tp-header';
  const tpTitle = doc.createElement('div');
  tpTitle.className = 'kq-section-title';
  const unlockedTps = progress.unlockedTeleporters.filter((id) => view.catalog.rooms.has(id));
  tpTitle.textContent = `FAST TRAVEL WAYSTONES (${unlockedTps.length} UNLOCKED)`;

  const hubBtn = doc.createElement('button');
  hubBtn.type = 'button';
  hubBtn.className =
    currentRoomId === view.catalog.hubRoomId
      ? 'kq-btn kq-btn-sm kq-btn-active'
      : 'kq-btn kq-btn-sm kq-btn-primary';
  hubBtn.textContent = '⌂ JUMP TO SUBROSA HAVEN HUB';
  hubBtn.disabled = currentRoomId === view.catalog.hubRoomId;
  hubBtn.addEventListener('click', () => {
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
      b.textContent = `⚡ ${r.name} (${r.biome})`;
      b.disabled = isHere;
      b.addEventListener('focus', () => updateInspector(r));
      b.addEventListener('mouseenter', () => updateInspector(r));
      b.addEventListener('click', () => {
        actions.onFastTravel(roomId);
      });
      tpRow.appendChild(b);
    }
  }
  tpSec.appendChild(tpRow);
  panel.appendChild(tpSec);

  // Biome Legend Strip (click a biome chip to scroll map to its first visited/known room)
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
      const targetRoom = allRooms.find((r) => r.biome === biomeId && visitedSet.has(r.id))
        ?? allRooms.find((r) => r.biome === biomeId);
      if (targetRoom) {
        const el = cellByRoomId.get(targetRoom.id) ?? null;
        centerOnCell(el);
        updateInspector(targetRoom);
      }
    });
    biomeBar.appendChild(chip);
  }
  panel.appendChild(biomeBar);

  // Auto-center current room once mounted
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
