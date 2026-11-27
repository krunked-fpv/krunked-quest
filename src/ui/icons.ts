/**
 * Krunked Quest — Crisp Inline SVG Icon Library
 * Unified vector iconography replacing inconsistent OS emojis across all menus,
 * shops, map overlays, HUD badges, and victory/options screens.
 */

export type IconName =
  | 'crystal'
  | 'coin'
  | 'heart'
  | 'shield'
  | 'lock'
  | 'check'
  | 'swords'
  | 'skull'
  | 'bolt'
  | 'anchor'
  | 'compass'
  | 'home'
  | 'gear'
  | 'volume'
  | 'volumeMute'
  | 'gamepad'
  | 'keyboard'
  | 'touch'
  | 'map'
  | 'play'
  | 'trophy'
  | 'sparkle'
  | 'book'
  | 'close'
  | 'folder'
  | 'palette'
  | 'chevronRight'
  | 'clock'
  | 'flame'
  | 'eye';

const ICON_PATHS: Readonly<Record<IconName, string>> = {
  crystal:
    '<polygon points="12 2 19 10 12 22 5 10" fill="currentColor" opacity="0.24"/><polygon points="12 2 19 10 12 22 5 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><polyline points="5 10 12 13 19 10" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  coin:
    '<circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.22"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.5l1.4 3 3.1.4-2.3 2.1.6 3.1L12 14.6l-2.8 1.5.6-3.1-2.3-2.1 3.1-.4L12 7.5z" fill="currentColor"/>',
  heart:
    '<path d="M12 20.5s-7.5-4.7-9.2-9.2C1.6 8 3.6 4.8 7 4.8c1.9 0 3.7 1 5 2.7 1.3-1.7 3.1-2.7 5-2.7 3.4 0 5.4 3.2 4.2 6.5-1.7 4.5-9.2 9.2-9.2 9.2z" fill="currentColor"/>',
  shield:
    '<path d="M12 2.5L4.5 5.8v5.5c0 4.9 3.2 9.3 7.5 10.7 4.3-1.4 7.5-5.8 7.5-10.7V5.8L12 2.5z" fill="currentColor" opacity="0.22"/><path d="M12 2.5L4.5 5.8v5.5c0 4.9 3.2 9.3 7.5 10.7 4.3-1.4 7.5-5.8 7.5-10.7V5.8L12 2.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  lock:
    '<rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor" opacity="0.2"/><rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  check:
    '<polyline points="4.5 12.5 9.5 17.5 19.5 6.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  swords:
    '<path d="M4.5 4.5l6.5 6.5m-4 4l12.5-10.5M19.5 4.5l-6.5 6.5m4 4L4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M4 17l3 3m13-3l-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  skull:
    '<path d="M12 3C7.2 3 4 6.2 4 10.5c0 2.5 1.3 4.6 3 5.8V19a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 19v-2.7c1.7-1.2 3-3.3 3-5.8C20 6.2 16.8 3 12 3z" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="2"/><circle cx="9.2" cy="10.8" r="1.5" fill="currentColor"/><circle cx="14.8" cy="10.8" r="1.5" fill="currentColor"/><path d="M10 17v3m4-3v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  bolt:
    '<polygon points="13 2 4.5 13.5 11.5 13.5 10.5 22 19.5 10.5 12.5 10.5 13 2" fill="currentColor"/>',
  anchor:
    '<circle cx="12" cy="5.5" r="2.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.7V20m-5-9.5h10M5.5 14c0 3.8 2.9 6.5 6.5 6.5s6.5-2.7 6.5-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  compass:
    '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="15.8 8.2 13.7 13.7 8.2 15.8 10.3 10.3 15.8 8.2" fill="currentColor"/>',
  home:
    '<path d="M3.5 11.2L12 4l8.5 7.2M6 9.5V19.5h4.5v-5h3v5H18V9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  gear:
    '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.8v2.4m0 13.6v2.4M4.8 4.8l1.7 1.7m11 11l1.7 1.7M2.8 12h2.4m13.6 0h2.4M4.8 19.2l1.7-1.7m11-11l1.7-1.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  volume:
    '<polygon points="4 9.5 8.5 9.5 13.5 5 13.5 19 8.5 14.5 4 14.5" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7m2.8-9.5a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  volumeMute:
    '<polygon points="4 9.5 8.5 9.5 13.5 5 13.5 19 8.5 14.5 4 14.5" fill="currentColor"/><path d="M16.5 9l5 6m0-6l-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  gamepad:
    '<rect x="2.5" y="7" width="19" height="10.5" rx="5" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="2"/><path d="M7.5 10v4.5M5.2 12.2h4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="15.8" cy="11.2" r="1.1" fill="currentColor"/><circle cx="18" cy="13.2" r="1.1" fill="currentColor"/>',
  keyboard:
    '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5" fill="currentColor" opacity="0.14" stroke="currentColor" stroke-width="2"/><path d="M6 9.5h2m3 0h2m3 0h2M6 13h2m3 0h2m3 0h2M8 16h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  touch:
    '<rect x="6" y="2.5" width="12" height="19" rx="2.5" fill="currentColor" opacity="0.14" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17.5" r="1.2" fill="currentColor"/>',
  map:
    '<polygon points="3 6 9 4 15 6.5 21 4.5 21 18 15 20 9 17.5 3 19.5" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v13.5M15 6.5V20" stroke="currentColor" stroke-width="1.8"/>',
  play:
    '<polygon points="6.5 4.5 19.5 12 6.5 19.5" fill="currentColor"/>',
  trophy:
    '<path d="M7 4h10v5.5a5 5 0 0 1-10 0V4z" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="2"/><path d="M7 6H4.2a2.5 2.5 0 0 0 0 5H7m10-5h2.8a2.5 2.5 0 0 1 0 5H17M12 14.5V19m-3.5 1h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  sparkle:
    '<path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2-2.2 6.3-2.2-6.3-6.3-2.2 6.3-2.2L12 2.5z" fill="currentColor"/>',
  book:
    '<path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h12.5v16H7a2.5 2.5 0 0 0-2.5 2.5V5.5z" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4.5 19A2.5 2.5 0 0 1 7 16.5h12.5" fill="none" stroke="currentColor" stroke-width="2"/>',
  close:
    '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  folder:
    '<path d="M3 6.5A2 2 0 0 1 5 4.5h4.5l2 2.2H19a2 2 0 0 1 2 2V17.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11z" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  palette:
    '<path d="M12 3a9 9 0 0 0 0 18h1.4a2.2 2.2 0 0 0 1.6-3.7 1.8 1.8 0 0 1 1.3-3h2.2A2.5 2.5 0 0 0 21 11.8C21 6.9 16.9 3 12 3z" fill="currentColor" opacity="0.16" stroke="currentColor" stroke-width="2"/><circle cx="7.8" cy="10.2" r="1.2" fill="currentColor"/><circle cx="11.2" cy="7.5" r="1.2" fill="currentColor"/><circle cx="15.2" cy="8.5" r="1.2" fill="currentColor"/>',
  chevronRight:
    '<polyline points="9 6 15 12 9 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
  clock:
    '<circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2"/><polyline points="12 7 12 12.5 16 14.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  flame:
    '<path d="M12.5 2.5c.8 3.6-2.5 5.4-2.5 8.2 0 1.6 1 2.7 2.2 2.7 1.5 0 2.5-1.3 2.3-3.1 2.4 1.5 3.8 4 3.8 6.4A6.3 6.3 0 0 1 12 22a6.3 6.3 0 0 1-6.3-6.3c0-3.7 2.8-6.8 6.8-13.2z" fill="currentColor"/>',
  eye:
    '<path d="M2.5 12s3.6-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.6 6.5-9.5 6.5S2.5 12 2.5 12z" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2.8" fill="currentColor"/>',
};

/**
 * Creates a crisp inline SVG icon wrapped in a non-shrinking span.
 * Headless/FakeDocument safe (gracefully degrades if innerHTML is unavailable).
 */
export function makeIcon(doc: Document, name: IconName, size = 15, extraClass = ''): HTMLElement {
  const span = doc.createElement('span');
  span.className = extraClass ? `kq-icon ${extraClass}` : 'kq-icon';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" focusable="false" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
  return span;
}

/**
 * Builds the signature Krunked Quest crystalline diamond emblem SVG for Title/Credits/Victory headers.
 */
export function makeLogoCrest(doc: Document): HTMLElement {
  const wrap = doc.createElement('div');
  wrap.className = 'kq-logo-crest';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `<svg viewBox="0 0 64 64" width="54" height="54" focusable="false">
    <defs>
      <linearGradient id="kqGemGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#fff49c"/>
        <stop offset="45%" stop-color="#ff5ec4"/>
        <stop offset="100%" stop-color="#8b33ff"/>
      </linearGradient>
      <linearGradient id="kqRimGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff7ba"/>
        <stop offset="50%" stop-color="#ffd644"/>
        <stop offset="100%" stop-color="#e0741c"/>
      </linearGradient>
    </defs>
    <polygon points="32 3 56 26 32 61 8 26" fill="#160a26" stroke="url(#kqRimGrad)" stroke-width="3" stroke-linejoin="round"/>
    <polygon points="32 9 49 26 32 53 15 26" fill="url(#kqGemGrad)"/>
    <polygon points="32 9 49 26 32 29 15 26" fill="#ffffff" opacity="0.28"/>
    <polygon points="32 16 40 26 32 41 24 26" fill="#5cefff" opacity="0.82"/>
    <circle cx="32" cy="26" r="4" fill="#ffffff"/>
  </svg>`;
  return wrap;
}
