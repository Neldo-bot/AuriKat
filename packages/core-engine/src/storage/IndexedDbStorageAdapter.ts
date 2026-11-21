/**
 * IStoragePort & IndexedDbStorageAdapter (TECH-02 / COPPA 2025)
 * Avoids fragile localStorage-only storage, supports navigator.storage.persist(),
 * tracks retention TTL (no indefinite retention), and provides 1-click full wipe.
 */

export interface IStoragePort {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T, ttlDays?: number): Promise<void>;
  removeItem(key: string): Promise<void>;
  wipeAll(): Promise<void>;
  requestPersistence(): Promise<boolean>;
}

interface StoredRecord<T> {
  key: string;
  value: T;
  updatedAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_DAYS = 60; // COPPA 2025 written retention limit (never indefinite)

export class IndexedDbStorageAdapter implements IStoragePort {
  private readonly dbName: string;
  private readonly storeName = 'aurikat_kv';
  private readonly memoryFallback = new Map<string, StoredRecord<unknown>>();

  constructor(dbName: string) {
    this.dbName = dbName;
  }

  private hasIndexedDb(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  public async getItem<T>(key: string): Promise<T | null> {
    const now = Date.now();
    if (!this.hasIndexedDb()) {
      const hit = this.memoryFallback.get(key) as StoredRecord<T> | undefined;
      if (!hit) return null;
      if (hit.expiresAt < now) {
        this.memoryFallback.delete(key);
        return null;
      }
      return hit.value;
    }

    try {
      const db = await this.openDb();
      const rec = await new Promise<StoredRecord<T> | undefined>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get(key);
        req.onsuccess = () => resolve(req.result as StoredRecord<T> | undefined);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (!rec) return null;
      if (rec.expiresAt < now) {
        await this.removeItem(key);
        return null;
      }
      return rec.value;
    } catch {
      const hit = this.memoryFallback.get(key) as StoredRecord<T> | undefined;
      return hit && hit.expiresAt >= now ? hit.value : null;
    }
  }

  public async setItem<T>(key: string, value: T, ttlDays = DEFAULT_TTL_DAYS): Promise<void> {
    const now = Date.now();
    const record: StoredRecord<T> = {
      key,
      value,
      updatedAt: now,
      expiresAt: now + ttlDays * 24 * 60 * 60 * 1000,
    };
    this.memoryFallback.set(key, record);

    if (!this.hasIndexedDb()) return;
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // Fallback remains populated in memory
    }
  }

  public async removeItem(key: string): Promise<void> {
    this.memoryFallback.delete(key);
    if (!this.hasIndexedDb()) return;
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // Ignore deletion errors
    }
  }

  public async wipeAll(): Promise<void> {
    this.memoryFallback.clear();
    if (!this.hasIndexedDb()) return;
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        tx.objectStore(this.storeName).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // Ignore wipe errors
    }
  }

  public async requestPersistence(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
      try {
        return await navigator.storage.persist();
      } catch {
        return false;
      }
    }
    return false;
  }
}
