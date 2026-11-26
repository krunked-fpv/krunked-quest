import { BIOME_PALETTES, HERO_FORM_PALETTES } from '../assets/palettes.js';
import { HERO_FORMS, SIM_HZ } from '../contracts/index.js';
import type { OverlayActions, OverlayViewState } from './OverlayManager.js';

export type ClearRank = 'S' | 'A' | 'B' | 'C';

export function formatTicksAsTime(ticks: number): string {
  const totalSec = Math.max(0, ticks / SIM_HZ);
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const centis = Math.floor((totalSec - Math.floor(totalSec)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

export function computeCompletionPercent(view: OverlayViewState): number {
  const p = view.simState.progress;
  const totalCoins = Math.max(1, view.catalog.totalCoins);
  const totalBosses = Math.max(1, view.catalog.bosses.size);
  const totalForms = Math.max(1, HERO_FORMS.length);
  const totalRooms = Math.max(1, view.catalog.rooms.size);
  const totalRelics = Math.max(1, view.catalog.relics.length);

  let maxUpgradeLevels = 0;
  let ownedUpgradeLevels = 0;
  for (const upg of view.catalog.upgrades) {
    maxUpgradeLevels += upg.maxLevel;
    ownedUpgradeLevels += Math.min(upg.maxLevel, p.upgradeLevels[upg.key] ?? 0);
  }

  const coinFrac = Math.min(1, p.collectedCoinIds.length / totalCoins);
  const bossFrac = Math.min(1, p.defeatedBosses.length / totalBosses);
  const formFrac = Math.min(1, p.unlockedForms.length / totalForms);
  const roomFrac = Math.min(1, p.visitedRooms.length / totalRooms);
  const relicFrac = Math.min(1, p.ownedRelics.length / totalRelics);
  const upgFrac = maxUpgradeLevels > 0 ? Math.min(1, ownedUpgradeLevels / maxUpgradeLevels) : 0;

  const weighted =
    coinFrac * 0.30 +
    bossFrac * 0.25 +
    formFrac * 0.15 +
    roomFrac * 0.12 +
    upgFrac * 0.10 +
    relicFrac * 0.08;

  return Math.max(0, Math.min(100, Math.round(weighted * 100)));
}

export function computeTimeAttackRank(ticks: number): ClearRank {
  const sec = Math.max(0, ticks / SIM_HZ);
  if (sec <= 300) return 'S'; // <= 05:00.00
  if (sec <= 600) return 'A'; // <= 10:00.00
  if (sec <= 1080) return 'B'; // <= 18:00.00
  return 'C';
}

function rankSubtitle(rank: ClearRank): string {
  switch (rank) {
    case 'S':
      return 'SUPREME SPEEDRUNNER';
    case 'A':
      return 'ELITE CHAMPION';
    case 'B':
      return 'SEASONED EXPLORER';
    case 'C':
      return 'QUEST CONQUEROR';
  }
}

function makeButton(
  doc: Document,
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const b = doc.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function makeStatItem(doc: Document, label: string, value: string): HTMLElement {
  const box = doc.createElement('div');
  box.className = 'kq-stat-item';
  const l = doc.createElement('span');
  l.className = 'kq-stat-label';
  l.textContent = label;
  const v = doc.createElement('span');
  v.className = 'kq-stat-value';
  v.textContent = value;
  box.append(l, v);
  return box;
}

export function buildVictoryPanel(
  doc: Document,
  view: OverlayViewState,
  actions: OverlayActions,
): HTMLElement {
  const panel = doc.createElement('div');
  panel.className = 'kq-panel kq-panel-victory';

  const progress = view.simState.progress;
  const completionPct = computeCompletionPercent(view);
  const splitTicks =
    view.simState.mode === 'time_attack' && view.simState.timeAttackTicks > 0
      ? view.simState.timeAttackTicks
      : view.simState.tick;
  const rank = computeTimeAttackRank(splitTicks);

  // Header & Rank Medallion
  const heroBanner = doc.createElement('div');
  heroBanner.className = 'kq-victory-banner';

  const titleGroup = doc.createElement('div');
  const h2 = doc.createElement('h2');
  h2.className = 'kq-logo';
  h2.textContent = 'VICTORY!';
  const sub = doc.createElement('div');
  sub.className = 'kq-subtitle';
  sub.textContent =
    view.simState.mode === 'time_attack'
      ? 'TIME ATTACK COMPLETE'
      : view.simState.mode === 'boss_rush'
        ? 'GUARDIAN VANQUISHED'
        : 'ECLIPSE SHATTERED — QUEST TRIUMPHANT';
  titleGroup.append(h2, sub);

  const rankBox = doc.createElement('div');
  rankBox.className = `kq-rank-medallion kq-rank-${rank.toLowerCase()}`;
  const rankLabel = doc.createElement('span');
  rankLabel.className = 'kq-rank-caption';
  rankLabel.textContent = 'RANK';
  const rankLetter = doc.createElement('span');
  rankLetter.className = 'kq-rank-letter';
  rankLetter.textContent = rank;
  const rankSub = doc.createElement('span');
  rankSub.className = 'kq-rank-sub';
  rankSub.textContent = rankSubtitle(rank);
  rankBox.append(rankLabel, rankLetter, rankSub);

  heroBanner.append(titleGroup, rankBox);
  panel.appendChild(heroBanner);

  // Completion Bar
  const compWrap = doc.createElement('div');
  compWrap.className = 'kq-completion-wrap';
  const compHead = doc.createElement('div');
  compHead.className = 'kq-completion-head';
  const compLbl = doc.createElement('span');
  compLbl.textContent = 'WORLD COMPLETION';
  const compVal = doc.createElement('strong');
  compVal.textContent = `${completionPct}%`;
  compHead.append(compLbl, compVal);

  const compBar = doc.createElement('div');
  compBar.className = 'kq-completion-bar';
  const compFill = doc.createElement('div');
  compFill.className = 'kq-completion-fill';
  compFill.style.width = `${completionPct}%`;
  compBar.appendChild(compFill);
  compWrap.append(compHead, compBar);
  panel.appendChild(compWrap);

  // Stats Grid
  const stats = doc.createElement('div');
  stats.className = 'kq-stat-grid kq-stat-grid-3';

  const bestSplitTxt =
    progress.bestTimeAttackTicks !== null
      ? ` (BEST ${formatTicksAsTime(progress.bestTimeAttackTicks)})`
      : '';

  stats.append(
    makeStatItem(doc, 'Golden Coins', `${progress.collectedCoinIds.length} / ${view.catalog.totalCoins}`),
    makeStatItem(doc, 'Bosses Defeated', `${progress.defeatedBosses.length} / ${view.catalog.bosses.size}`),
    makeStatItem(doc, 'Elemental Forms', `${progress.unlockedForms.length} / ${HERO_FORMS.length}`),
    makeStatItem(doc, 'Split Time', `${formatTicksAsTime(splitTicks)}${bestSplitTxt}`),
    makeStatItem(doc, 'Rooms Explored', `${progress.visitedRooms.length} / ${view.catalog.rooms.size}`),
    makeStatItem(doc, 'Crystal Hoard', `◆ ${progress.crystals}`),
  );
  panel.appendChild(stats);

  // Unlocked Forms Ribbon
  const formStrip = doc.createElement('div');
  formStrip.className = 'kq-victory-forms';
  for (const formId of HERO_FORMS) {
    const unlocked = progress.unlockedForms.includes(formId);
    const pill = doc.createElement('span');
    pill.className = unlocked ? 'kq-badge kq-badge-active' : 'kq-badge kq-badge-dim';
    const sw = doc.createElement('span');
    sw.className = 'kq-swatch';
    sw.style.backgroundColor = HERO_FORM_PALETTES[formId][0];
    const formDef = view.catalog.forms.find((f) => f.id === formId);
    pill.append(sw, doc.createTextNode(formDef?.name ?? formId));
    formStrip.appendChild(pill);
  }
  panel.appendChild(formStrip);

  // Actions: New Game+, Continue Exploring, Credits, Title
  const btnGrid = doc.createElement('div');
  btnGrid.className = 'kq-victory-actions';

  btnGrid.appendChild(
    makeButton(doc, '★ NEW GAME+ (KEEP FORMS)', 'kq-btn kq-btn-primary', () => {
      // Carry forward unlocked forms, upgrades, relics, and crystals into a fresh lap from Tutorial Lair
      view.simState.victoryTriggered = false;
      view.simState.gameOverTriggered = false;
      view.simState.hero.hp = view.simState.hero.maxHp;
      view.simState.timeAttackTicks = 0;
      view.simState.mode = 'story';
      actions.onForceSave();
      actions.onWarpRoom(view.catalog.startRoomId);
    }),
  );

  btnGrid.appendChild(
    makeButton(doc, 'CONTINUE EXPLORING (HUB)', 'kq-btn kq-btn-accent', () => {
      actions.onReturnToHub();
    }),
  );

  btnGrid.appendChild(
    makeButton(doc, 'CREDITS', 'kq-btn', () => {
      actions.onOpenCredits();
    }),
  );

  btnGrid.appendChild(
    makeButton(doc, 'TITLE SCREEN', 'kq-btn', () => {
      actions.onReturnToTitle();
    }),
  );

  panel.appendChild(btnGrid);
  return panel;
}

export function buildGameOverPanel(
  doc: Document,
  view: OverlayViewState,
  actions: OverlayActions,
): HTMLElement {
  const panel = doc.createElement('div');
  panel.className = 'kq-panel kq-panel-title kq-panel-gameover';

  const isGhostShip = view.simState.mode === 'ghost_ship';
  const room = view.catalog.rooms.get(view.simState.roomId);
  const biomePal = room ? BIOME_PALETTES[room.biome] : undefined;
  const hasMagicCoin = view.simState.progress.equippedRelics.includes('magic_coin');

  const h2 = doc.createElement('h2');
  h2.className = 'kq-gameover-heading';
  h2.textContent = isGhostShip ? 'VOYAGE ENDED' : 'DEFEATED';
  panel.appendChild(h2);

  const sub = doc.createElement('div');
  sub.className = 'kq-panel-subheading';
  sub.textContent = isGhostShip
    ? 'The cursed tide claimed the galleon — rally your combo and sail again!'
    : hasMagicCoin
      ? 'Magic Coin protected your crystal pouch from defeat penalty.'
      : 'Rise again, champion — master your stomp and form chains!';
  panel.appendChild(sub);

  const stats = doc.createElement('div');
  stats.className = 'kq-stat-grid';
  if (isGhostShip) {
    stats.append(
      makeStatItem(doc, 'Wave Reached', String(view.simState.ghostShip.wave)),
      makeStatItem(doc, 'Voyage Score', String(view.simState.ghostShip.score)),
      makeStatItem(doc, 'Best Wave', String(view.simState.progress.ghostShipBestWave)),
      makeStatItem(doc, 'High Score', String(view.simState.progress.ghostShipHighScore)),
    );
  } else {
    stats.append(
      makeStatItem(doc, 'Fallen Location', room ? `${room.name} (${biomePal?.label ?? room.biome})` : view.simState.roomId),
      makeStatItem(doc, 'Crystals', `◆ ${view.simState.progress.crystals}`),
      makeStatItem(doc, 'Golden Coins', `${view.simState.progress.collectedCoinIds.length} / ${view.catalog.totalCoins}`),
      makeStatItem(doc, 'Bosses Cleared', `${view.simState.progress.defeatedBosses.length} / ${view.catalog.bosses.size}`),
    );
  }
  panel.appendChild(stats);

  const list = doc.createElement('div');
  list.className = 'kq-menu-list';
  list.appendChild(
    makeButton(
      doc,
      isGhostShip ? '⚓ SAIL AGAIN' : 'RETRY ROOM',
      'kq-btn kq-btn-primary',
      () => actions.onRetryGameOver(),
    ),
  );
  list.appendChild(
    makeButton(doc, 'RETURN TO HUB', 'kq-btn kq-btn-accent', () => actions.onReturnToHub()),
  );
  list.appendChild(
    makeButton(doc, 'TITLE SCREEN', 'kq-btn kq-btn-danger', () => actions.onReturnToTitle()),
  );
  panel.appendChild(list);

  return panel;
}

export function buildCreditsPanel(
  doc: Document,
  view: OverlayViewState,
  actions: OverlayActions,
): HTMLElement {
  const panel = doc.createElement('div');
  panel.className = 'kq-panel kq-panel-wide kq-panel-credits';

  const logoWrap = doc.createElement('div');
  logoWrap.className = 'kq-logo-wrap';

  const h2 = doc.createElement('h2');
  h2.className = 'kq-logo';
  h2.textContent = 'KRUNKED QUEST';

  const sub = doc.createElement('div');
  sub.className = 'kq-subtitle';
  sub.textContent = 'OFFICIAL CREDITS & ADVENTURE ARCHIVE';

  logoWrap.append(h2, sub);
  panel.appendChild(logoWrap);

  const scroll = doc.createElement('div');
  scroll.className = 'kq-panel-scroll';

  const creditBlocks: ReadonlyArray<{ heading: string; entries: readonly string[] }> = [
    {
      heading: 'CORE ENGINE & DETERMINISTIC SIMULATION',
      entries: [
        '60Hz Fixed-Timestep Platformer Physics — Krunked Quest Core Engineering',
        'Swept AABB Collision, Combo-Heal & 6-Form Combat — Simulation Architects',
        '8 Multi-Phase Guardians & Ghost Ship Endless Director — Combat Design Team',
      ],
    },
    {
      heading: 'WORLD DESIGN, PIXEL CRAFT & AUDIO',
      entries: [
        '64-Room Interconnected Metroidvania across 11 Biomes — Worldsmith Guild',
        '16-Bit Neo-Retro Pixel Atlas, Biome Atmosphere & Boss Art — Pixelcraft Studio',
        'Procedural WebAudio Chiptune Tracks & Foley Synth — Synthwave Sound Lab',
      ],
    },
    {
      heading: 'MULTI-DEVICE CONTROLS & META INTERFACE',
      entries: [
        'Keyboard, Xbox / PlayStation / Switch / Tesla Gamepad & Auto-Touch — Input Team',
        'Interactive World Map, Subrosa Haven Shops & Playtest QA Tools — Meta UI Team',
        'Thank you for adventuring across Subrosa Haven and conquering Krunked Quest!',
      ],
    },
  ];

  for (const block of creditBlocks) {
    const sec = doc.createElement('section');
    sec.className = 'kq-section kq-credits-block';
    const title = doc.createElement('div');
    title.className = 'kq-section-title';
    title.textContent = block.heading;
    sec.appendChild(title);
    for (const line of block.entries) {
      const p = doc.createElement('div');
      p.className = 'kq-credits-line';
      p.textContent = line;
      sec.appendChild(p);
    }
    scroll.appendChild(sec);
  }

  // Final Adventure Record
  const compPct = computeCompletionPercent(view);
  const record = doc.createElement('div');
  record.className = 'kq-stat-grid kq-stat-grid-3';
  record.append(
    makeStatItem(doc, 'Completion', `${compPct}%`),
    makeStatItem(doc, 'Golden Coins', `${view.simState.progress.collectedCoinIds.length} / ${view.catalog.totalCoins}`),
    makeStatItem(doc, 'Bosses Cleared', `${view.simState.progress.defeatedBosses.length} / ${view.catalog.bosses.size}`),
    makeStatItem(doc, 'Forms Unlocked', `${view.simState.progress.unlockedForms.length} / ${HERO_FORMS.length}`),
    makeStatItem(doc, 'Ghost Ship Best', `WAVE ${view.simState.progress.ghostShipBestWave}`),
    makeStatItem(
      doc,
      'Best Time Attack',
      view.simState.progress.bestTimeAttackTicks !== null
        ? formatTicksAsTime(view.simState.progress.bestTimeAttackTicks)
        : '—',
    ),
  );
  scroll.appendChild(record);
  panel.appendChild(scroll);

  const actionsRow = doc.createElement('div');
  actionsRow.className = 'kq-credits-actions';
  actionsRow.append(
    makeButton(doc, 'RETURN TO TITLE', 'kq-btn kq-btn-primary', () => actions.onReturnToTitle()),
    makeButton(doc, 'BACK TO SUBROSA HAVEN', 'kq-btn', () => actions.onReturnToHub()),
  );
  panel.appendChild(actionsRow);

  return panel;
}
