import type { Store } from '../store';
import { FileStore, OneDriveStore, GoogleDriveStore } from '../store';
import type { CloudStorageConfig } from '../store';
import type { Session } from './auth';
import { StorageSettingsApi } from './storage-settings';

/**
 * Resolves the correct Store for a given session. Each user may have their
 * own cloud storage config (OneDrive or Google Drive) pointing to a shared
 * folder. If no cloud config exists, falls back to the shared local FileStore.
 *
 * Store instances are cached per userId to avoid re-opening on every request.
 * The cache is bounded — least recently used entries are evicted.
 */
export class StoreResolver {
  private readonly fileStore: Store;
  private readonly storageSettings: StorageSettingsApi;
  private readonly cache: Map<string, Store> = new Map();
  private readonly maxCacheSize = 50;

  constructor(fileStore: Store, storageSettings: StorageSettingsApi) {
    this.fileStore = fileStore;
    this.storageSettings = storageSettings;
  }

  /**
   * Resolve the store for a session. Returns the user's cloud store if
   * configured, otherwise the shared local FileStore.
   */
  async resolve(session: Session): Promise<Store> {
    const cloudConfig = this.storageSettings.loadConfigForUser(session.userId);
    if (!cloudConfig || !cloudConfig.accessToken) {
      // No cloud storage configured for this user — use shared local store.
      return this.fileStore;
    }

    // Check cache first.
    const cached = this.cache.get(session.userId);
    if (cached) return cached;

    // Create a new cloud store for this user.
    const configUpdater = (updated: CloudStorageConfig) => {
      this.storageSettings.saveConfigForUser(session.userId, updated);
    };
    let store: Store;
    if (cloudConfig.provider === 'onedrive') {
      store = new OneDriveStore(cloudConfig, configUpdater);
    } else if (cloudConfig.provider === 'googledrive') {
      store = new GoogleDriveStore(cloudConfig, configUpdater);
    } else {
      return this.fileStore;
    }
    await store.open();

    // Evict LRU if cache is full.
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const evicted = this.cache.get(oldestKey);
        this.cache.delete(oldestKey);
        evicted?.close?.();
      }
    }
    this.cache.set(session.userId, store);
    return store;
  }

  /**
   * Close all cached stores. Called on shutdown.
   */
  async close(): Promise<void> {
    for (const store of this.cache.values()) {
      await store.close();
    }
    this.cache.clear();
  }
}
