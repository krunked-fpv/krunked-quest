import { BIOME_PALETTES, HERO_FORM_PALETTES } from '../assets/palettes.js';
import {
  COMBO_PRESETS,
  COMBO_RULES,
  HERO_FORMS,
  type BossDef,
  type HeroFormId,
  type InputDeviceMode,
  type ShopId,
  type UpgradeDef,
} from '../contracts/index.js';
import type { OverlayActions, OverlayViewState } from './OverlayManager.js';

interface ShopTheme {
  readonly npcName: string;
  readonly roleTitle: string;
  readonly subtitle: string;
  readonly greeting: string;
  readonly accent: string;
  readonly badge: string;
}

const SHOP_THEMES: Readonly<Record<ShopId, ShopTheme>> = {
  vespera: {
    npcName: 'Vespera',
    roleTitle: 'Core Upgrade Artisan',
    subtitle: 'Forge extra Heart Orbs, Relic Sockets, and Iron Skin',
    greeting: '"Bring me shimmering crystals and I will temper your spirit for the trials ahead."',
    accent: '#c06bff',
    badge: 'CORE FORGE',
  },
  orla: {
    npcName: 'Orla',
    roleTitle: 'Form Master & Cartographer',
    subtitle: 'Evolve Elemental Form arts and unveil the World Map',
    greeting: '"Every form holds dormant secrets — and a wise traveler maps every hidden exit."',
    accent: '#58e882',
    badge: 'FORM & MAP',
  },
  barnaby: {
    npcName: 'Barnaby',
    roleTitle: 'Relic Bazaar Curio Dealer',
    subtitle: 'Collect 16 mystical Relics and customize your active slots',
    greeting: '"Finest charms in Subrosa Haven! Buy once, swap freely whenever you visit."',
    accent: '#ffd644',
    badge: '16 RELICS',
  },
  garron: {
    npcName: 'Garron',
    roleTitle: 'Arena & Boss Rematch Master',
    subtitle: 'Test your combos against all 8 Guardians & Mini-Bosses',
    greeting: '"Step into the ring, champion! Every Guardian waits for a true challenger."',
    accent: '#ff5468',
    badge: '8 BOSS RUSH',
  },
  barnacle: {
    npcName: 'Captain Barnacle',
    roleTitle: 'Ghost Ship Endless Quartermaster',
    subtitle: 'Board the cursed galleon for escalating wave survival',
    greeting: '"Three tiers of phantom fury await on deck. Hold your combo or walk the plank!"',
    accent: '#57e6ff',
    badge: 'ENDLESS DOCK',
  },
  codex: {
    npcName: 'Codex',
    roleTitle: 'Adventurer Guide Tome',
    subtitle: 'Live controls, Elemental Form arts, and Combo-Heal doctrine',
    greeting: '"Knowledge sharpens speed. Consult this tome whenever switching devices or forms."',
    accent: '#ff70c8',
    badge: 'GUIDE TOME',
  },
};

const FORM_DISPLAY_NAMES: Readonly<Record<HeroFormId, string>> = {
  krunk_basic: 'Base Krunk',
  krunk_fire: 'Fire Krunk',
  krunk_leaf: 'Leaf Krunk',
  krunk_rock: 'Rock Krunk',
  krunk_electric: 'Volt Krunk',
  krunk_shadow: 'Shadow Krunk',
};

const FORM_UNLOCK_HINTS: Readonly<Record<HeroFormId, string>> = {
  krunk_basic: 'Unlocked by default',
  krunk_leaf: 'Defeat Primal Eye (Primal Tree)',
  krunk_fire: 'Defeat Magma Boar King (Volcanic Altar)',
  krunk_rock: 'Defeat Mecha Bull (Forgotten Labyrinth)',
  krunk_electric: 'Defeat Electro Sphinx (Atomic Temple)',
  krunk_shadow: 'Defeat Nightmare Sovereign (Nightmare Spire)',
};

const GHOST_SHIP_TIERS: ReadonlyArray<{
  tier: string;
  waves: string;
  title: string;
  detail: string;
  color: string;
}> = [
  {
    tier: 'TIER 1',
    waves: 'WAVES 1–3',
    title: 'Spectral Boarding',
    detail: 'Phantom crows, owls, and raiders patrol the three-deck galleon. Build early combo heals.',
    color: '#58e882',
  },
  {
    tier: 'TIER 2',
    waves: 'WAVES 4–7',
    title: 'Cursed Gale & Deck Spikes',
    detail: 'Periodic cursed spike eruptions sweep the lower deck while airborne swarms intensify.',
    color: '#ffd644',
  },
  {
    tier: 'TIER 3',
    waves: 'WAVES 8+',
    title: 'Abyssal Maelstrom',
    detail: 'Relentless elite waves, rapid spike cycles, and peak score multipliers for true veterans.',
    color: '#ff5468',
  },
];

function formatDeviceBadge(device: InputDeviceMode): string {
  switch (device) {
    case 'keyboard':
      return 'KEYBOARD';
    case 'gamepad_xbox':
      return 'XBOX CONTROLLER';
    case 'gamepad_ps':
      return 'PLAYSTATION CONTROLLER';
    case 'gamepad_switch':
      return 'SWITCH CONTROLLER';
    case 'gamepad_tesla':
      return 'TESLA / IN-CAR PAD';
    case 'touch':
      return 'AUTO-TOUCH CONTROLS';
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

function makeSection(doc: Document, titleText: string): HTMLElement {
  const sec = doc.createElement('section');
  sec.className = 'kq-section';
  const title = doc.createElement('div');
  title.className = 'kq-section-title';
  title.textContent = titleText;
  sec.appendChild(title);
  return sec;
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

function renderLevelPips(doc: Document, current: number, max: number): HTMLElement {
  const wrap = doc.createElement('span');
  wrap.className = 'kq-level-pips';
  wrap.setAttribute('aria-label', `Level ${current} of ${max}`);
  for (let i = 0; i < max; i++) {
    const pip = doc.createElement('span');
    pip.className = i < current ? 'kq-pip kq-pip-filled' : 'kq-pip';
    wrap.appendChild(pip);
  }
  return wrap;
}

function renderUpgradeCard(
  doc: Document,
  upg: UpgradeDef,
  view: OverlayViewState,
  actions: OverlayActions,
  showFormTag: boolean,
): HTMLElement {
  const curLevel = view.simState.progress.upgradeLevels[upg.key] ?? 0;
  const maxed = curLevel >= upg.maxLevel;
  const price = upg.basePrice + curLevel * upg.priceStep;
  const formLocked =
    upg.requiredForm !== undefined && !view.simState.progress.unlockedForms.includes(upg.requiredForm);
  const canAfford = view.simState.progress.crystals >= price;

  const card = doc.createElement('div');
  let cardCls = 'kq-card';
  if (maxed) cardCls += ' kq-card-equipped';
  else if (formLocked) cardCls += ' kq-card-locked';
  else if (canAfford) cardCls += ' kq-card-affordable';
  card.className = cardCls;

  const info = doc.createElement('div');
  info.className = 'kq-card-info';

  const titleRow = doc.createElement('div');
  titleRow.className = 'kq-card-title';

  const nameSpan = doc.createElement('span');
  nameSpan.textContent = upg.name;
  titleRow.appendChild(nameSpan);

  titleRow.appendChild(renderLevelPips(doc, curLevel, upg.maxLevel));

  const lvlBadge = doc.createElement('span');
  lvlBadge.className = maxed ? 'kq-badge kq-badge-active' : 'kq-badge';
  lvlBadge.textContent = maxed ? 'MAXED' : `LV ${curLevel}/${upg.maxLevel}`;
  titleRow.appendChild(lvlBadge);

  if (showFormTag && upg.requiredForm) {
    const fBadge = doc.createElement('span');
    fBadge.className = formLocked ? 'kq-badge kq-badge-danger' : 'kq-badge kq-badge-ready';
    fBadge.textContent = formLocked
      ? `🔒 ${FORM_DISPLAY_NAMES[upg.requiredForm]}`
      : FORM_DISPLAY_NAMES[upg.requiredForm];
    titleRow.appendChild(fBadge);
  }

  const desc = doc.createElement('div');
  desc.className = 'kq-card-desc';
  desc.textContent = upg.description;
  info.append(titleRow, desc);

  const actionWrap = doc.createElement('div');
  actionWrap.className = 'kq-card-action';

  const btnLabel = maxed
    ? '✓ MAXED'
    : formLocked
      ? '🔒 LOCKED'
      : `BUY ${price}◆`;
  const btnCls = maxed
    ? 'kq-btn kq-btn-sm kq-btn-active'
    : !formLocked && canAfford
      ? 'kq-btn kq-btn-sm kq-btn-primary'
      : 'kq-btn kq-btn-sm';

  const buyBtn = makeButton(doc, btnLabel, btnCls, () => {
    actions.onBuyUpgrade(upg.key);
  });
  buyBtn.disabled = maxed || formLocked || !canAfford;
  actionWrap.appendChild(buyBtn);

  if (!maxed && !formLocked && !canAfford) {
    const need = doc.createElement('div');
    need.className = 'kq-afford-hint';
    need.textContent = `NEED ${price - view.simState.progress.crystals}◆`;
    actionWrap.appendChild(need);
  }

  card.append(info, actionWrap);
  return card;
}

function buildVesperaBody(doc: Document, view: OverlayViewState, actions: OverlayActions): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'kq-shop-body';

  // Current vital stats summary bar
  const extraLife = view.simState.progress.upgradeLevels.ExtraLife ?? 0;
  const itemSlot = view.simState.progress.upgradeLevels.ItemSlot ?? 0;
  const ironSkin = view.simState.progress.upgradeLevels.IronSkin ?? 0;

  const summary = doc.createElement('div');
  summary.className = 'kq-stat-grid kq-stat-grid-3';
  summary.append(
    makeStatItem(doc, 'Max Heart Orbs', `${view.simState.hero.maxHp} (Vital +${extraLife}/5)`),
    makeStatItem(doc, 'Relic Slots', `${1 + itemSlot} / 3`),
    makeStatItem(doc, 'Iron Skin', ironSkin > 0 ? 'ACTIVE (+25% INVULN)' : 'NOT FORGED'),
  );
  wrap.appendChild(summary);

  const upgrades = view.catalog.upgrades.filter((u) => u.shop === 'vespera');
  const list = doc.createElement('div');
  list.className = 'kq-card-list';
  for (const upg of upgrades) {
    list.appendChild(renderUpgradeCard(doc, upg, view, actions, false));
  }
  wrap.appendChild(list);
  return wrap;
}

function buildOrlaBody(doc: Document, view: OverlayViewState, actions: OverlayActions): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'kq-shop-body';

  const orlaUpgrades = view.catalog.upgrades.filter((u) => u.shop === 'orla');
  const mapUpgrades = orlaUpgrades.filter((u) => !u.requiredForm);

  // Group form upgrades in canonical HERO_FORMS order
  for (const formId of HERO_FORMS) {
    const groupItems = orlaUpgrades.filter((u) => u.requiredForm === formId);
    if (groupItems.length === 0) continue;

    const unlocked = view.simState.progress.unlockedForms.includes(formId);
    const palette = HERO_FORM_PALETTES[formId];

    const sec = doc.createElement('section');
    sec.className = unlocked ? 'kq-section' : 'kq-section kq-section-locked';

    const secHead = doc.createElement('div');
    secHead.className = 'kq-group-header';

    const left = doc.createElement('div');
    left.className = 'kq-group-title-wrap';
    const swatch = doc.createElement('span');
    swatch.className = 'kq-swatch';
    swatch.style.backgroundColor = palette[0];
    swatch.style.borderColor = palette[3];
    const title = doc.createElement('span');
    title.className = 'kq-section-title';
    title.textContent = FORM_DISPLAY_NAMES[formId];
    left.append(swatch, title);

    const statusBadge = doc.createElement('span');
    statusBadge.className = unlocked ? 'kq-badge kq-badge-active' : 'kq-badge kq-badge-danger';
    statusBadge.textContent = unlocked ? 'FORM UNLOCKED' : `🔒 LOCKED — ${FORM_UNLOCK_HINTS[formId]}`;

    secHead.append(left, statusBadge);
    sec.appendChild(secHead);

    const list = doc.createElement('div');
    list.className = 'kq-card-list';
    for (const upg of groupItems) {
      list.appendChild(renderUpgradeCard(doc, upg, view, actions, false));
    }
    sec.appendChild(list);
    wrap.appendChild(sec);
  }

  // Cartography & Map Upgrades group
  if (mapUpgrades.length > 0) {
    const mapSec = makeSection(doc, 'Cartography & World Map Tools');
    const list = doc.createElement('div');
    list.className = 'kq-card-list';
    for (const upg of mapUpgrades) {
      list.appendChild(renderUpgradeCard(doc, upg, view, actions, false));
    }
    mapSec.appendChild(list);
    wrap.appendChild(mapSec);
  }

  return wrap;
}

function buildBarnabyBody(doc: Document, view: OverlayViewState, actions: OverlayActions): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'kq-shop-body';

  const maxSlots = 1 + (view.simState.progress.upgradeLevels.ItemSlot ?? 0);
  const equippedIds = view.simState.progress.equippedRelics;
  const ownedIds = view.simState.progress.ownedRelics;

  // Visual Active Relic Slot Bar
  const slotSection = doc.createElement('section');
  slotSection.className = 'kq-section kq-relic-slot-bar';

  const slotHead = doc.createElement('div');
  slotHead.className = 'kq-group-header';
  const slotTitle = doc.createElement('span');
  slotTitle.className = 'kq-section-title';
  slotTitle.textContent = `ACTIVE RELIC SLOTS (${equippedIds.length} / ${maxSlots})`;

  const ownedBadge = doc.createElement('span');
  ownedBadge.className = 'kq-badge kq-badge-gold';
  ownedBadge.textContent = `OWNED ${ownedIds.length} / ${view.catalog.relics.length}`;
  slotHead.append(slotTitle, ownedBadge);
  slotSection.appendChild(slotHead);

  const socketRow = doc.createElement('div');
  socketRow.className = 'kq-relic-sockets';
  for (let i = 0; i < maxSlots; i++) {
    const eqId = equippedIds[i];
    const relicDef = eqId ? view.catalog.relics.find((r) => r.id === eqId) : undefined;
    const socket = doc.createElement('button');
    socket.type = 'button';
    socket.className = relicDef ? 'kq-relic-socket kq-relic-socket-filled' : 'kq-relic-socket';
    if (relicDef) {
      const sw = doc.createElement('span');
      sw.className = 'kq-swatch';
      sw.style.backgroundColor = relicDef.iconColor;
      const lbl = doc.createElement('span');
      lbl.textContent = relicDef.name;
      const x = doc.createElement('span');
      x.className = 'kq-socket-remove';
      x.textContent = '✕';
      socket.append(sw, lbl, x);
      socket.title = `Click to unequip ${relicDef.name}`;
      socket.addEventListener('click', () => {
        actions.onToggleEquipRelic(relicDef.id);
      });
    } else {
      socket.textContent = `SLOT ${i + 1}: EMPTY`;
      socket.disabled = true;
    }
    socketRow.appendChild(socket);
  }
  slotSection.appendChild(socketRow);

  if (maxSlots < 3) {
    const tip = doc.createElement('div');
    tip.className = 'kq-panel-subheading';
    tip.textContent = 'Tip: Purchase Relic Socket upgrades from Vespera to expand up to 3 active slots.';
    slotSection.appendChild(tip);
  }
  wrap.appendChild(slotSection);

  // All 16 Relics list
  const list = doc.createElement('div');
  list.className = 'kq-card-list';

  for (const relic of view.catalog.relics) {
    const owned = ownedIds.includes(relic.id);
    const equipped = equippedIds.includes(relic.id);
    const canAfford = view.simState.progress.crystals >= relic.price;
    const slotsFull = !equipped && equippedIds.length >= maxSlots;

    const card = doc.createElement('div');
    let cls = 'kq-card';
    if (equipped) cls += ' kq-card-equipped';
    else if (!owned && canAfford) cls += ' kq-card-affordable';
    card.className = cls;

    const info = doc.createElement('div');
    info.className = 'kq-card-info';

    const titleRow = doc.createElement('div');
    titleRow.className = 'kq-card-title';
    const swatch = doc.createElement('span');
    swatch.className = 'kq-swatch';
    swatch.style.backgroundColor = relic.iconColor;
    const nameSpan = doc.createElement('span');
    nameSpan.textContent = relic.name;
    titleRow.append(swatch, nameSpan);

    if (equipped) {
      const eq = doc.createElement('span');
      eq.className = 'kq-badge kq-badge-active';
      eq.textContent = '★ EQUIPPED';
      titleRow.appendChild(eq);
    } else if (owned) {
      const ow = doc.createElement('span');
      ow.className = 'kq-badge kq-badge-ready';
      ow.textContent = 'OWNED';
      titleRow.appendChild(ow);
    }

    const desc = doc.createElement('div');
    desc.className = 'kq-card-desc';
    desc.textContent = relic.description;
    info.append(titleRow, desc);

    const actionWrap = doc.createElement('div');
    actionWrap.className = 'kq-card-action';

    if (!owned) {
      const buyBtn = makeButton(
        doc,
        `BUY ${relic.price}◆`,
        canAfford ? 'kq-btn kq-btn-sm kq-btn-primary' : 'kq-btn kq-btn-sm',
        () => {
          actions.onBuyRelic(relic.id);
        },
      );
      buyBtn.disabled = !canAfford;
      actionWrap.appendChild(buyBtn);
      if (!canAfford) {
        const need = doc.createElement('div');
        need.className = 'kq-afford-hint';
        need.textContent = `NEED ${relic.price - view.simState.progress.crystals}◆`;
        actionWrap.appendChild(need);
      }
    } else {
      const eqBtn = makeButton(
        doc,
        equipped ? 'UNEQUIP' : slotsFull ? 'SLOTS FULL' : 'EQUIP',
        equipped
          ? 'kq-btn kq-btn-sm kq-btn-active'
          : slotsFull
            ? 'kq-btn kq-btn-sm'
            : 'kq-btn kq-btn-sm kq-btn-accent',
        () => {
          actions.onToggleEquipRelic(relic.id);
        },
      );
      if (slotsFull) {
        eqBtn.title = 'Unequip a relic above or buy more Relic Sockets from Vespera';
      }
      actionWrap.appendChild(eqBtn);
    }

    card.append(info, actionWrap);
    list.appendChild(card);
  }

  wrap.appendChild(list);
  return wrap;
}

function buildGarronBody(doc: Document, view: OverlayViewState, actions: OverlayActions): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'kq-shop-body';

  const bosses: BossDef[] = Array.from(view.catalog.bosses.values());
  const defeatedSet = new Set(view.simState.progress.defeatedBosses);
  const defeatedCount = bosses.filter((b) => defeatedSet.has(b.id)).length;

  const summary = doc.createElement('div');
  summary.className = 'kq-stat-grid kq-stat-grid-3';
  summary.append(
    makeStatItem(doc, 'Guardians Defeated', `${defeatedCount} / ${bosses.length}`),
    makeStatItem(doc, 'Active Form', FORM_DISPLAY_NAMES[view.simState.hero.form]),
    makeStatItem(doc, 'Boss Combo Timer', `${COMBO_PRESETS.boss.maxTimer.toFixed(1)}s`),
  );
  wrap.appendChild(summary);

  const list = doc.createElement('div');
  list.className = 'kq-card-list';

  for (let i = 0; i < bosses.length; i++) {
    const boss = bosses[i];
    const defeated = defeatedSet.has(boss.id);
    const biomePal = BIOME_PALETTES[boss.biome];

    const card = doc.createElement('div');
    card.className = defeated ? 'kq-card kq-card-equipped' : 'kq-card';

    const info = doc.createElement('div');
    info.className = 'kq-card-info';

    const titleRow = doc.createElement('div');
    titleRow.className = 'kq-card-title';

    const idxTag = doc.createElement('span');
    idxTag.className = 'kq-badge';
    idxTag.textContent = `#${i + 1}`;

    const nameEl = doc.createElement('span');
    nameEl.textContent = boss.name;

    const hpBadge = doc.createElement('span');
    hpBadge.className = 'kq-badge kq-badge-gold';
    hpBadge.textContent = `${boss.maxHp} HP`;

    const biomeBadge = doc.createElement('span');
    biomeBadge.className = 'kq-biome-chip';
    biomeBadge.style.backgroundColor = biomePal?.skyBot ?? '#2a1847';
    biomeBadge.style.borderColor = biomePal?.colors[0] ?? '#ffd644';
    biomeBadge.textContent = `${boss.biome} · ${biomePal?.label ?? boss.biome}`;

    const tierBadge = doc.createElement('span');
    tierBadge.className = boss.isMiniBoss ? 'kq-badge' : 'kq-badge kq-badge-secret';
    tierBadge.textContent = boss.isMiniBoss ? 'MINI-BOSS' : 'GUARDIAN';

    titleRow.append(idxTag, nameEl, hpBadge, biomeBadge, tierBadge);

    if (defeated) {
      const defBadge = doc.createElement('span');
      defBadge.className = 'kq-badge kq-badge-active';
      defBadge.textContent = '✓ DEFEATED';
      titleRow.appendChild(defBadge);
    }

    const desc = doc.createElement('div');
    desc.className = 'kq-card-desc';
    const unlockTxt = boss.unlockForm
      ? ` · Unlocks ${FORM_DISPLAY_NAMES[boss.unlockForm]}`
      : '';
    desc.textContent = `${boss.subtitle} · Reward: ${boss.crystalReward}◆ + ${boss.coinReward}★${unlockTxt}`;
    info.append(titleRow, desc);

    const fightBtn = makeButton(
      doc,
      defeated ? '⚔ REMATCH' : '⚔ CHALLENGE',
      defeated ? 'kq-btn kq-btn-sm kq-btn-accent' : 'kq-btn kq-btn-sm kq-btn-primary',
      () => {
        actions.onChallengeBoss(boss.id);
      },
    );

    card.append(info, fightBtn);
    list.appendChild(card);
  }

  wrap.appendChild(list);
  return wrap;
}

function buildBarnacleBody(doc: Document, view: OverlayViewState, actions: OverlayActions): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'kq-shop-body';

  const stats = doc.createElement('div');
  stats.className = 'kq-stat-grid kq-stat-grid-3';
  stats.append(
    makeStatItem(doc, 'Best Wave', String(view.simState.progress.ghostShipBestWave)),
    makeStatItem(doc, 'High Score', String(view.simState.progress.ghostShipHighScore)),
    makeStatItem(doc, 'Arena Combo Timer', `${COMBO_PRESETS.arena.maxTimer.toFixed(1)}s`),
  );
  wrap.appendChild(stats);

  // 3-Tier Hazard Briefing
  const briefSec = makeSection(doc, '3-Tier Cursed Galleon Hazard Briefing');
  const tierGrid = doc.createElement('div');
  tierGrid.className = 'kq-tier-grid';

  for (const t of GHOST_SHIP_TIERS) {
    const box = doc.createElement('div');
    box.className = 'kq-tier-card';
    box.style.borderLeftColor = t.color;

    const head = doc.createElement('div');
    head.className = 'kq-tier-head';
    const tag = doc.createElement('span');
    tag.className = 'kq-badge';
    tag.style.borderColor = t.color;
    tag.style.color = t.color;
    tag.textContent = `${t.tier} · ${t.waves}`;
    const ttl = doc.createElement('strong');
    ttl.textContent = t.title;
    head.append(tag, ttl);

    const det = doc.createElement('div');
    det.className = 'kq-card-desc';
    det.textContent = t.detail;

    box.append(head, det);
    tierGrid.appendChild(box);
  }
  briefSec.appendChild(tierGrid);
  wrap.appendChild(briefSec);

  const launchWrap = doc.createElement('div');
  launchWrap.className = 'kq-shop-cta';
  const sailBtn = makeButton(
    doc,
    '⚓ SET SAIL — LAUNCH GHOST SHIP ENDLESS',
    'kq-btn kq-btn-primary',
    () => {
      actions.onStartGhostShip();
    },
  );
  launchWrap.appendChild(sailBtn);
  wrap.appendChild(launchWrap);

  return wrap;
}

function buildCodexBody(doc: Document, view: OverlayViewState): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'kq-shop-body';

  // 1. Live Device-Matched Controls
  const ctrlSec = makeSection(doc, `Live Controls — ${formatDeviceBadge(view.activeDevice)}`);
  const ctrlGrid = doc.createElement('div');
  ctrlGrid.className = 'kq-glyph-grid';

  const moveLabel =
    view.activeDevice === 'keyboard'
      ? 'ARROWS / WASD'
      : view.activeDevice === 'touch'
        ? 'SLIDE D-PAD'
        : 'LEFT STICK / D-PAD';

  const rows: ReadonlyArray<[string, string]> = [
    ['Move / Aim', moveLabel],
    ['Jump / Double Jump', view.glyphs.jump],
    ['Dash / Form Ability', view.glyphs.dash],
    ['Air Stomp', view.glyphs.stomp],
    ['Switch Elemental Form', view.glyphs.form],
    ['Interact / Talk', view.glyphs.interact],
    ['World Map', view.glyphs.map],
    ['Pause / Back', view.glyphs.pause],
  ];

  for (const [label, glyph] of rows) {
    const item = doc.createElement('div');
    item.className = 'kq-glyph-item';
    const l = doc.createElement('span');
    l.className = 'kq-glyph-label';
    l.textContent = label;
    const cap = doc.createElement('span');
    cap.className = 'kq-keycap';
    cap.textContent = glyph;
    item.append(l, cap);
    ctrlGrid.appendChild(item);
  }
  ctrlSec.appendChild(ctrlGrid);
  wrap.appendChild(ctrlSec);

  // 2. All 6 Elemental Form Abilities
  const formSec = makeSection(doc, `Elemental Forms (${view.simState.progress.unlockedForms.length} / ${HERO_FORMS.length})`);
  const formList = doc.createElement('div');
  formList.className = 'kq-card-list';
  for (const form of view.catalog.forms) {
    const unlocked = view.simState.progress.unlockedForms.includes(form.id);
    const active = view.simState.hero.form === form.id;
    const card = doc.createElement('div');
    card.className = active
      ? 'kq-card kq-card-equipped'
      : unlocked
        ? 'kq-card'
        : 'kq-card kq-card-locked';

    const info = doc.createElement('div');
    info.className = 'kq-card-info';

    const titleRow = doc.createElement('div');
    titleRow.className = 'kq-card-title';

    const palStrip = doc.createElement('span');
    palStrip.className = 'kq-pal-strip';
    for (let i = 0; i < 4; i++) {
      const dot = doc.createElement('span');
      dot.className = 'kq-pal-dot';
      dot.style.backgroundColor = form.palette[i];
      palStrip.appendChild(dot);
    }

    const nm = doc.createElement('span');
    nm.textContent = `${form.name} — ${form.abilityName}`;

    const st = doc.createElement('span');
    st.className = active
      ? 'kq-badge kq-badge-gold'
      : unlocked
        ? 'kq-badge kq-badge-active'
        : 'kq-badge kq-badge-danger';
    st.textContent = active ? 'ACTIVE' : unlocked ? 'UNLOCKED' : '🔒 LOCKED';

    titleRow.append(palStrip, nm, st);

    const desc = doc.createElement('div');
    desc.className = 'kq-card-desc';
    desc.textContent = unlocked
      ? form.description
      : `${form.description} (${FORM_UNLOCK_HINTS[form.id]})`;

    info.append(titleRow, desc);
    card.appendChild(info);
    formList.appendChild(card);
  }
  formSec.appendChild(formList);
  wrap.appendChild(formSec);

  // 3. Combo-Heal & Scoring Rules
  const comboSec = makeSection(doc, 'Combo-Heal & Momentum Rules');
  const ruleList = doc.createElement('div');
  ruleList.className = 'kq-rules-list';

  const healPct = Math.round(COMBO_RULES.HEAL_THRESHOLD * 100);
  const rules: ReadonlyArray<string> = [
    `COMBO GAUGE TIMERS: Normal Rooms ${COMBO_PRESETS.normal.maxTimer.toFixed(1)}s · Combat Arenas ${COMBO_PRESETS.arena.maxTimer.toFixed(1)}s · Boss Fights ${COMBO_PRESETS.boss.maxTimer.toFixed(1)}s.`,
    `AUTO COMBO-HEAL: Filling the Combo Gauge to ≥${healPct}% automatically restores +1 Heart Orb, recharges Basalt Aegis (Rock Shield), and resets gauge smoothly.`,
    `DECAY PAUSE: Combo decay freezes during dashes, form abilities, and Maniac Crystal hit-windows so aggressive chaining stays alive.`,
    `MAX ROOM COMBO: Clearing every foe in a room in one unbroken chain triggers dramatic slow-motion and awards a bonus Golden Coin (+1 Heart with Vampiric Amulet)!`,
    `CRYSTAL SCALING: Every +${COMBO_RULES.CRYSTAL_PER_COMBO_STEP} combo hits boosts crystal drops; rapid hits within ${COMBO_RULES.MINI_COMBO_WINDOW.toFixed(2)}s score Mini-Combo bursts.`,
  ];

  for (const r of rules) {
    const p = doc.createElement('div');
    p.className = 'kq-rule-item';
    p.textContent = r;
    ruleList.appendChild(p);
  }
  comboSec.appendChild(ruleList);
  wrap.appendChild(comboSec);

  // 4. Quest Progress Ledger
  const progSec = makeSection(doc, 'Quest Progress Ledger');
  const progGrid = doc.createElement('div');
  progGrid.className = 'kq-stat-grid kq-stat-grid-3';
  progGrid.append(
    makeStatItem(doc, 'Golden Coins', `${view.simState.progress.collectedCoinIds.length} / ${view.catalog.totalCoins}`),
    makeStatItem(doc, 'Bosses Defeated', `${view.simState.progress.defeatedBosses.length} / ${view.catalog.bosses.size}`),
    makeStatItem(doc, 'Rooms Explored', `${view.simState.progress.visitedRooms.length} / ${view.catalog.rooms.size}`),
    makeStatItem(doc, 'Waystones', String(view.simState.progress.unlockedTeleporters.length)),
    makeStatItem(doc, 'Relics Owned', `${view.simState.progress.ownedRelics.length} / ${view.catalog.relics.length}`),
    makeStatItem(doc, 'Rescued Animals', `${view.simState.progress.rescuedAnimals.length} / 7`),
  );
  progSec.appendChild(progGrid);
  wrap.appendChild(progSec);

  return wrap;
}

export function buildShopPanel(
  doc: Document,
  view: OverlayViewState,
  actions: OverlayActions,
): HTMLElement {
  const shopId: ShopId = view.activeShop ?? 'codex';
  const theme = SHOP_THEMES[shopId];

  const panel = doc.createElement('div');
  panel.className = 'kq-panel kq-panel-wide kq-panel-shop';
  panel.style.setProperty('--shop-accent', theme.accent);
  panel.setAttribute('data-shop', shopId);

  // Bespoke NPC Header
  const header = doc.createElement('div');
  header.className = 'kq-panel-header kq-shop-header';

  const leftHead = doc.createElement('div');
  const titleLine = doc.createElement('div');
  titleLine.className = 'kq-shop-title-row';

  const h2 = doc.createElement('h2');
  h2.className = 'kq-panel-heading';
  h2.textContent = `${theme.npcName} — ${theme.roleTitle}`;

  const tag = doc.createElement('span');
  tag.className = 'kq-badge';
  tag.style.borderColor = theme.accent;
  tag.style.color = theme.accent;
  tag.textContent = theme.badge;

  titleLine.append(h2, tag);

  const sub = doc.createElement('div');
  sub.className = 'kq-panel-subheading';
  sub.textContent = theme.subtitle;

  const quote = doc.createElement('div');
  quote.className = 'kq-shop-quote';
  quote.textContent = theme.greeting;

  leftHead.append(titleLine, sub, quote);

  const rightHead = doc.createElement('div');
  rightHead.className = 'kq-shop-balance';

  const purse = doc.createElement('span');
  purse.className = 'kq-crystal-pill';
  purse.textContent = `◆ ${view.simState.progress.crystals}`;

  const closeBtn = makeButton(doc, 'CLOSE', 'kq-btn kq-btn-sm kq-btn-primary', () => {
    actions.onCloseShop();
  });
  rightHead.append(purse, closeBtn);

  header.append(leftHead, rightHead);
  panel.appendChild(header);

  const scroll = doc.createElement('div');
  scroll.className = 'kq-panel-scroll';

  switch (shopId) {
    case 'vespera':
      scroll.appendChild(buildVesperaBody(doc, view, actions));
      break;
    case 'orla':
      scroll.appendChild(buildOrlaBody(doc, view, actions));
      break;
    case 'barnaby':
      scroll.appendChild(buildBarnabyBody(doc, view, actions));
      break;
    case 'garron':
      scroll.appendChild(buildGarronBody(doc, view, actions));
      break;
    case 'barnacle':
      scroll.appendChild(buildBarnacleBody(doc, view, actions));
      break;
    case 'codex':
    default:
      scroll.appendChild(buildCodexBody(doc, view));
      break;
  }

  panel.appendChild(scroll);

  const footer = doc.createElement('div');
  footer.className = 'kq-footer-hint';
  footer.textContent = `${formatDeviceBadge(view.activeDevice)} · NAVIGATE ↑↓←→ · CONFIRM ${view.glyphs.jump} · CLOSE ${view.glyphs.pause}`;
  panel.appendChild(footer);

  return panel;
}
