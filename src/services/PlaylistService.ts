import { DoublyLinkedList, type Song } from '../domain/playlist/DoublyLinkedList';

const KEY = 'wavely:queue:v1';

export class PlaylistService {
  readonly list = new DoublyLinkedList();

  constructor() {
    this.restore();
  }

  snapshot(): { songs: Song[]; currentId: string | null } {
    return { songs: this.list.toArray(), currentId: this.list.getCurrent()?.id ?? null };
  }

  private persist(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snapshot()));
    } catch {
      /* storage lleno o bloqueado: no rompe la app */
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { songs: Song[]; currentId: string | null };
      for (const s of data.songs) {
        try {
          this.list.addLast(s);
        } catch {
          /* ignora duplicados corruptos */
        }
      }
      if (data.currentId) this.list.setCurrentById(data.currentId);
    } catch {
      /* JSON corrupto: arranca vacía */
    }
  }

  addFirst(song: Song): void {
    this.list.addFirst(song);
    this.persist();
  }
  addLast(song: Song): void {
    this.list.addLast(song);
    this.persist();
  }
  addAt(index: number, song: Song): void {
    this.list.addAt(index, song);
    this.persist();
  }
  removeAt(index: number): Song {
    const r = this.list.removeAt(index);
    this.persist();
    return r;
  }
  removeById(id: string): Song | null {
    const r = this.list.removeById(id);
    this.persist();
    return r;
  }
  next(repeatAll: boolean): Song | null {
    const r = repeatAll ? this.list.nextCircular() : this.list.next();
    this.persist();
    return r;
  }
  previous(): Song | null {
    const r = this.list.previous();
    this.persist();
    return r;
  }
  play(id: string): boolean {
    const ok = this.list.setCurrentById(id);
    this.persist();
    return ok;
  }
  move(from: number, to: number): void {
    this.list.move(from, to);
    this.persist();
  }
  clear(): void {
    this.list.clear();
    this.persist();
  }
  /** Inserta justo después de la actual ("reproducir siguiente", Skill 12). */
  playNext(song: Song): void {
    const arr = this.list.toArray();
    const cur = this.list.getCurrent()?.id;
    const at = cur ? arr.findIndex((s) => s.id === cur) + 1 : arr.length;
    this.list.addAt(Math.max(0, Math.min(at, arr.length)), song);
    this.persist();
  }
}

export const playlistService = new PlaylistService();
