import type { MediaAttachment } from "./types";

const DATABASE_NAME = "rapnet-converter-drafts";
const STORE_NAME = "media";
const DRAFT_MEDIA_KEY = "current-draft";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open media storage."));
  });
}

function runMediaRequest<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = action(transaction.objectStore(STORE_NAME));

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not access media storage."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not save uploaded media."));
    };
  }));
}

export function saveDraftMedia(media: Record<string, MediaAttachment>): Promise<IDBValidKey> {
  return runMediaRequest("readwrite", (store) => store.put(media, DRAFT_MEDIA_KEY));
}

export async function loadDraftMedia(): Promise<Record<string, MediaAttachment>> {
  const media = await runMediaRequest<Record<string, MediaAttachment> | undefined>(
    "readonly",
    (store) => store.get(DRAFT_MEDIA_KEY)
  );
  return media ?? {};
}

export function clearDraftMedia(): Promise<undefined> {
  return runMediaRequest("readwrite", (store) => store.delete(DRAFT_MEDIA_KEY));
}
