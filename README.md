# Krunked Quest

A crisp **576×324** 16-bit neo-retro Metroidvania action-platformer built in pure TypeScript with a deterministic **60 Hz** simulation engine, decoupled **30 / 60 / 120 FPS** pixel-snapped renderer, procedural pixel-art atlas, Web Audio chiptune soundtrack, and full multi-device controls (**Keyboard + Xbox / PlayStation / Switch / Tesla Gamepads + Auto-Activating Transparent Multi-Touch**).

## Features

- **Precision 60 Hz Acrobatic Physics**: Variable-height jump hold, coyote time (`0.10s`), jump & dash buffers, wall-slide, wall-jump, wall-dash, ground-dash, air-stomp `1.5×` enemy bounce chains, and slippery vine rails.
- **5+1 Elemental Forms**: Base, Fire (Flame Rocket Dash), Leaf (Leaf Glide + Wind Updrafts), Rock (Stone Uppercut + Rock Shield), Volt (Volt Dive & Target Blink), and unlockable Shadow Form.
- **Combo-Heal Engine**: Chaining enemy kills and crystal pickups fills the radial combo meter; reaching 95% auto-heals `+1 HP`, and clearing every foe in a room triggers `0.05×` hitstop and awards a **Combo Coin**.
- **64-Room Interconnected World across 11 Biomes**: Tutorial Lair, Subrosa Haven Hub (with Vespera, Orla, Barnaby, Garron, Captain Barnacle, Codex, and rescueable animal houses), Monster's Trail, Infested Forest, Primal Tree, Volcanic Altar, Isolated Desert, Forgotten Labyrinth, Atomic Temple, Nightmare Spire, and Ghost Ship Endless Arena.
- **18 Core/Form Upgrades, 16 Equippable Relics, 200 Collectible Coins, 6 Multi-Phase Bosses & 2 Mini-Bosses**, plus **Ghost Ship Endless**, **Arena/Boss Rush**, and **Time Attack** modes.
- **Dual-Mode Visual Packs**: Runs out-of-the-box with the 100% original Built-In Krunked Pixel Pack, and supports optional user-loaded local Custom Packs via IndexedDB or `.krunked-quest-assets/`.
- **Full Multi-Device Input**: Keyboard, W3C Gamepad API (Xbox, PlayStation, Switch Pro, and Tesla Chromium USB/BT controllers with raw axis/POV fallback and dual-motor haptics), and transparent multi-touch controls that stay hidden on desktop until touched.

## Quick Start

```bash
npm install
npm run play
```

## Scripts

- `npm run dev` — Start Vite dev server on `http://127.0.0.1:5173`
- `npm run play` — Start Vite server on `http://127.0.0.1:4173`
- `npm run typecheck` — Run strict TypeScript typechecking
- `npm run test` — Run Vitest unit & input/mechanic test suites
- `npm run verify` — Run asset hygiene, unit tests, and deterministic 64-room simulation soak
- `npm run build` — Build standalone production bundle into `dist/`
