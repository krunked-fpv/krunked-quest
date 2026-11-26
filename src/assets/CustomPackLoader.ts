/**
 * Krunked Quest — Dual-Mode Custom Asset Pack Loader
 * Supports local dev middleware auto-detection (/.krunked-quest-assets/manifest.json),
 * browser directory import (showDirectoryPicker + hidden webkitdirectory fallback),
 * persistent IndexedDB caching (krunked_quest_custom_pack_v1), and live hot-swap toggle.
 */

import type {
  BiomeId,
  CustomPackManifest,
  HeroFormId,
  IAssetPackManager,
} from '../contracts/index';
import {
  ALL_REQUIRED_ASSET_KEYS,
  LOGICAL_BIOME_TILESETS,
  LOGICAL_HERO_SHEETS,
  isValidCustomPackManifest,
  resolveLogicalAssetKey,
  validateAssetManifest,
} from './AssetRegistry';

export const CUSTOM_PACK_DB_NAME = 'krunked_quest_custom_pack_v1';
export const CUSTOM_PACK_STORE_NAME = 'custom_pack_assets';
export const CUSTOM_PACK_MANIFEST_KEY = '__manifest__';
export const CUSTOM_PACK_BASE_URL = '/.krunked-quest-assets';
export const CUSTOM_PACK_MANIFEST_URL = `${CUSTOM_PACK_BASE_URL}/manifest.json`;

interface DirectoryFileHandleLike {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
}

interface DirectoryHandleLike {
  readonly kind: 'directory';
  readonly name: string;
  values(): AsyncIterableIterator<DirectoryFileHandleLike | DirectoryHandleLike>;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandleLike>;
}

interface InputWithWebkitDirectory extends HTMLInputElement {
  webkitdirectory: boolean;
}

interface FileWithRelativePath extends File {
  readonly webkitRelativePath: string;
}

function normalizeRelativePath(rawPath: string): string {
  return rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function getBaseName(rawPath: string): string {
  const norm = normalizeRelativePath(rawPath);
  const idx = norm.lastIndexOf('/');
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

function openPackDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(CUSTOM_PACK_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CUSTOM_PACK_STORE_NAME)) {
          db.createObjectStore(CUSTOM_PACK_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(db: IDBDatabase, key: string): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(CUSTOM_PACK_STORE_NAME, 'readonly');
      const store = tx.objectStore(CUSTOM_PACK_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbReplacePack(
  manifest: CustomPackManifest,
  blobs: ReadonlyMap<string, Blob>,
): Promise<void> {
  const db = await openPackDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(CUSTOM_PACK_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CUSTOM_PACK_STORE_NAME);
      store.clear();
      store.put(manifest, CUSTOM_PACK_MANIFEST_KEY);
      for (const [assetKey, blob] of blobs) {
        store.put(blob, `asset:${assetKey}`);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
  if (typeof Image === 'undefined') {
    return null;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function collectFilesFromDirectoryHandle(
  dirHandle: DirectoryHandleLike,
  prefix = '',
): Promise<Map<string, File>> {
  const files = new Map<string, File>();
  for await (const entry of dirHandle.values()) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      files.set(normalizeRelativePath(relPath), file);
    } else if (entry.kind === 'directory') {
      const nested = await collectFilesFromDirectoryHandle(entry, relPath);
      for (const [k, v] of nested) {
        files.set(k, v);
      }
    }
  }
  return files;
}

function collectFilesFromFallbackInput(): Promise<Map<string, File> | null> {
  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const input = document.createElement('input') as InputWithWebkitDirectory;
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';

    let settled = false;
    const cleanup = () => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };
    const finish = (result: Map<string, File> | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    input.addEventListener('change', () => {
      const list = input.files;
      if (!list || list.length === 0) {
        finish(null);
        return;
      }
      const files = new Map<string, File>();
      for (let i = 0; i < list.length; i += 1) {
        const file = list[i] as FileWithRelativePath;
        const rawRel = normalizeRelativePath(file.webkitRelativePath || file.name);
        // Strip top-level chosen folder name so paths align with manifest.json entries
        const firstSlash = rawRel.indexOf('/');
        const stripped = firstSlash >= 0 ? rawRel.slice(firstSlash + 1) : rawRel;
        files.set(stripped, file);
      }
      finish(files);
    });

    input.addEventListener('cancel', () => finish(null));

    document.body.appendChild(input);
    input.click();
  });
}

declare const __KRUNKED_DEV_MIDDLEWARE__: boolean | undefined;

class CustomAssetPackManager implements IAssetPackManager {
  private _available = false;
  private _desiredEnabled = false;
  private _manifest: CustomPackManifest | null = null;
  private readonly _images = new Map<string, HTMLImageElement>();
  private readonly _objectUrls: string[] = [];

  get customPackAvailable(): boolean {
    return this._available;
  }

  get customPackEnabled(): boolean {
    return this._desiredEnabled && this._available;
  }

  get manifest(): CustomPackManifest | null {
    return this._manifest;
  }

  private clearLoadedImages(): void {
    this._images.clear();
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      for (const url of this._objectUrls) {
        URL.revokeObjectURL(url);
      }
    }
    this._objectUrls.length = 0;
  }

  async init(): Promise<void> {
    const loadedLocal = await this.tryLoadFromLocalMiddleware();
    if (loadedLocal) {
      return;
    }
    await this.tryLoadFromIndexedDb();
  }

  private async tryLoadFromLocalMiddleware(): Promise<boolean> {
    if (typeof __KRUNKED_DEV_MIDDLEWARE__ !== 'undefined' && !__KRUNKED_DEV_MIDDLEWARE__) {
      return false;
    }
    if (typeof fetch === 'undefined') {
      return false;
    }
    try {
      const res = await fetch(CUSTOM_PACK_MANIFEST_URL, { cache: 'no-cache' });
      if (!res.ok) {
        return false;
      }
      const json: unknown = await res.json();
      if (!isValidCustomPackManifest(json)) {
        return false;
      }

      const entries = Object.values(json.entries);
      const nextImages = new Map<string, HTMLImageElement>();

      // In browser contexts decode all pack images in parallel; in headless/Node contexts keep manifest availability.
      if (typeof Image !== 'undefined') {
        const results = await Promise.all(
          entries.map(async (entry) => {
            const url = `${CUSTOM_PACK_BASE_URL}/${normalizeRelativePath(entry.path)}`;
            const img = await loadImageFromUrl(url);
            return [entry.key, img] as const;
          }),
        );
        for (const [key, img] of results) {
          if (img) {
            nextImages.set(key, img);
          }
        }
      }

      this.clearLoadedImages();
      for (const [key, img] of nextImages) {
        this._images.set(key, img);
      }
      this._manifest = json;
      this._available = true;
      return true;
    } catch {
      return false;
    }
  }

  private async tryLoadFromIndexedDb(): Promise<boolean> {
    const db = await openPackDb();
    if (!db) {
      return false;
    }
    try {
      const storedManifest = await idbGet<unknown>(db, CUSTOM_PACK_MANIFEST_KEY);
      if (!isValidCustomPackManifest(storedManifest)) {
        return false;
      }

      const nextImages = new Map<string, HTMLImageElement>();
      const nextUrls: string[] = [];
      const entries = Object.values(storedManifest.entries);

      if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
        const results = await Promise.all(
          entries.map(async (entry) => {
            const blob = await idbGet<Blob>(db, `asset:${entry.key}`);
            if (!blob) return [entry.key, null, null] as const;
            const url = URL.createObjectURL(blob);
            const img = await loadImageFromUrl(url);
            if (!img) {
              URL.revokeObjectURL(url);
              return [entry.key, null, null] as const;
            }
            return [entry.key, img, url] as const;
          }),
        );
        for (const [key, img, url] of results) {
          if (img && url) {
            nextImages.set(key, img);
            nextUrls.push(url);
          }
        }
      }

      this.clearLoadedImages();
      for (const [key, img] of nextImages) {
        this._images.set(key, img);
      }
      this._objectUrls.push(...nextUrls);
      this._manifest = storedManifest;
      this._available = true;
      return true;
    } catch {
      return false;
    } finally {
      db.close();
    }
  }

  setUseCustomPack(enabled: boolean): void {
    this._desiredEnabled = Boolean(enabled);
  }

  async loadFromDirectoryPicker(): Promise<{ ok: boolean; count: number; message: string }> {
    if (typeof window === 'undefined') {
      return {
        ok: false,
        count: 0,
        message: 'Directory picker is only available in a browser environment.',
      };
    }

    let pickedFiles: Map<string, File> | null = null;
    try {
      const pickerWin = window as WindowWithDirectoryPicker;
      if (typeof pickerWin.showDirectoryPicker === 'function') {
        const dirHandle = await pickerWin.showDirectoryPicker({ mode: 'read' });
        pickedFiles = await collectFilesFromDirectoryHandle(dirHandle);
      } else {
        pickedFiles = await collectFilesFromFallbackInput();
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, count: 0, message: 'Custom pack selection cancelled.' };
      }
      return {
        ok: false,
        count: 0,
        message: `Unable to open directory picker: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!pickedFiles || pickedFiles.size === 0) {
      return { ok: false, count: 0, message: 'No files selected.' };
    }

    const manifestFile =
      pickedFiles.get('manifest.json') ??
      Array.from(pickedFiles.entries()).find(([rel]) => getBaseName(rel).toLowerCase() === 'manifest.json')?.[1];

    if (!manifestFile) {
      return {
        ok: false,
        count: 0,
        message: 'Selected folder does not contain a valid manifest.json file.',
      };
    }

    let parsedManifest: unknown;
    try {
      parsedManifest = JSON.parse(await manifestFile.text());
    } catch {
      return { ok: false, count: 0, message: 'manifest.json contains invalid JSON.' };
    }

    const validation = validateAssetManifest(parsedManifest);
    if (!validation.valid) {
      return {
        ok: false,
        count: 0,
        message: `Invalid pack manifest: ${validation.errors.join(' ')}`,
      };
    }

    const validManifest = parsedManifest as CustomPackManifest;
    const byBasename = new Map<string, File>();
    for (const [rel, file] of pickedFiles) {
      const base = getBaseName(rel).toLowerCase();
      if (!byBasename.has(base)) {
        byBasename.set(base, file);
      }
    }

    const blobsToStore = new Map<string, Blob>();
    const nextImages = new Map<string, HTMLImageElement>();
    const nextUrls: string[] = [];

    for (const entry of Object.values(validManifest.entries)) {
      const normalized = normalizeRelativePath(entry.path);
      const matchedFile =
        pickedFiles.get(normalized) ?? byBasename.get(getBaseName(normalized).toLowerCase());
      if (!matchedFile) {
        continue;
      }
      blobsToStore.set(entry.key, matchedFile);
      if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
        const url = URL.createObjectURL(matchedFile);
        const img = await loadImageFromUrl(url);
        if (img) {
          nextImages.set(entry.key, img);
          nextUrls.push(url);
        } else {
          URL.revokeObjectURL(url);
        }
      }
    }

    if (blobsToStore.size === 0) {
      return {
        ok: false,
        count: 0,
        message: 'manifest.json was found, but no referenced sprite PNG files matched in the folder.',
      };
    }

    await idbReplacePack(validManifest, blobsToStore);

    this.clearLoadedImages();
    for (const [key, img] of nextImages) {
      this._images.set(key, img);
    }
    this._objectUrls.push(...nextUrls);
    this._manifest = validManifest;
    this._available = true;
    this._desiredEnabled = true;

    return {
      ok: true,
      count: blobsToStore.size,
      message: `Loaded custom asset pack (${blobsToStore.size} sprites cached in IndexedDB).`,
    };
  }

  getSprite(key: string): HTMLCanvasElement | HTMLImageElement | null {
    if (!this.customPackEnabled) {
      return null;
    }
    const direct = this._images.get(key);
    const img = direct ?? (() => {
      const canonical = resolveLogicalAssetKey(key);
      return canonical ? this._images.get(canonical) : undefined;
    })();
    if (!img) {
      return null;
    }
    if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
      if (!img.complete || img.naturalWidth === 0) {
        return null;
      }
    }
    return img;
  }

  getBiomeTileset(biome: BiomeId): HTMLCanvasElement | HTMLImageElement | null {
    return this.getSprite(LOGICAL_BIOME_TILESETS[biome]);
  }

  getHeroSheet(form: HeroFormId): HTMLCanvasElement | HTMLImageElement | null {
    return this.getSprite(LOGICAL_HERO_SHEETS[form]);
  }

  getAllRegisteredKeys(): string[] {
    return [...ALL_REQUIRED_ASSET_KEYS];
  }
}

export function createAssetPackManager(): IAssetPackManager {
  return new CustomAssetPackManager();
}
