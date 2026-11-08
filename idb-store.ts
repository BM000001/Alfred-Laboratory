import type { AnyEntity } from "../domain/entities.js";
import { validateEntity } from "../domain/validation.js";
import type { EntityStore } from "./repository.js";

const DB_NAME = "alfred";
const DB_VERSION = 1;
const STORE_NAME = "entities";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("kind", "kind", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("falha ao abrir o banco local"));
  });
}

/**
 * Armazenamento em IndexedDB. Lê e valida cada registro ao sair do banco:
 * dados corrompidos ou de versão desconhecida são descartados, não propagados.
 */
export class IdbStore implements EntityStore {
  private readonly dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = openDatabase();
  }

  private async run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.dbPromise;
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      let result: T | undefined;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result as T);
      transaction.onerror = () => reject(transaction.error ?? new Error("erro de transação"));
      transaction.onabort = () => reject(transaction.error ?? new Error("transação abortada"));
    });
  }

  async put(entity: AnyEntity): Promise<void> {
    await this.run("readwrite", (store) => store.put(entity));
  }

  async get(id: string): Promise<AnyEntity | undefined> {
    const raw: unknown = await this.run("readonly", (store) => store.get(id));
    if (raw === undefined) return undefined;
    const result = validateEntity(raw);
    return result.ok ? result.value : undefined;
  }

  async all(): Promise<AnyEntity[]> {
    const raw = await this.run<unknown[]>("readonly", (store) => store.getAll());
    const valid: AnyEntity[] = [];
    for (const item of raw) {
      const result = validateEntity(item);
      if (result.ok) valid.push(result.value);
    }
    return valid;
  }
}

/**
 * Pede ao navegador que não apague os dados sob pressão de espaço.
 * O navegador pode recusar; nesse caso, o backup continua sendo a proteção principal.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
