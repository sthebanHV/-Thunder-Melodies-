/**
 * Archivos de audio subidos por el usuario: se guardan como blobs en
 * IndexedDB (sobreviven a recargar la página) mientras que la cola solo
 * guarda metadatos en localStorage.
 */
const DB_NAME = 'thunder-melodies';
const STORE = 'files';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

export async function putFile(id: string, blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getFile(id: string): Promise<Blob | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Lee la duración real del archivo (para la cola) sin subirlo a ningún lado. */
export function probeDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const finish = (d: number | null): void => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      a.removeAttribute('src');
      resolve(d);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => finish(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null);
    a.onerror = () => finish(null);
    window.setTimeout(() => finish(null), 5000);
    a.src = url;
  });
}
