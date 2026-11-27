/**
 * Krunked Quest — Application Composition Root
 */

import '@fontsource/bungee/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-600.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/latin-700.css';

import { GameApp } from './app/GameApp';
import { createAssetPackManager } from './assets/CustomPackLoader';
import { createAudioEngine } from './audio/index';
import { createWorldCatalog } from './data/index';
import { createPixelRenderer } from './render/index';
import { createSimEngine } from './sim/index';

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  const uiRoot = document.getElementById('ui-root');
  const touchRoot = document.getElementById('touch-root');

  if (!canvas || !uiRoot || !touchRoot) {
    throw new Error('Krunked Quest: missing required DOM mount elements (#game-canvas, #ui-root, #touch-root).');
  }

  const app = new GameApp({
    sim: createSimEngine(),
    catalog: createWorldCatalog(),
    renderer: createPixelRenderer(),
    audio: createAudioEngine(),
    assets: createAssetPackManager(),
    canvas,
    uiRoot,
    touchRoot,
  });

  app.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
