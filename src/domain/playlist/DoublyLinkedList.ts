export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSec: number;
  coverUrl?: string;
  previewUrl?: string | null;
  videoId?: string | null;
  /** true = archivo de audio subido por el usuario (guardado en IndexedDB). */
  local?: boolean;
}

export class SongNode {
  prev: SongNode | null = null;
  next: SongNode | null = null;
  constructor(public song: Song) {}
}

function assertIndex(index: number, size: number, allowEnd: boolean): void {
  const max = allowEnd ? size : size - 1;
  if (!Number.isInteger(index) || index < 0 || index > max) {
    throw new RangeError(`Índice ${index} fuera de rango (0..${max})`);
  }
}

export class DoublyLinkedList {
  private head: SongNode | null = null;
  private tail: SongNode | null = null;
  private current: SongNode | null = null;
  private count = 0;

  get size(): number {
    return this.count;
  }

  isEmpty(): boolean {
    return this.count === 0;
  }

  addFirst(song: Song): void {
    this.guardUnique(song.id);
    const node = new SongNode(song);
    if (!this.head) {
      this.head = this.tail = this.current = node;
    } else {
      node.next = this.head;
      this.head.prev = node;
      this.head = node;
    }
    this.count += 1;
  }

  addLast(song: Song): void {
    this.guardUnique(song.id);
    const node = new SongNode(song);
    if (!this.tail) {
      this.head = this.tail = this.current = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
    this.count += 1;
  }

  addAt(index: number, song: Song): void {
    assertIndex(index, this.count, true);
    if (index === 0) return this.addFirst(song);
    if (index === this.count) return this.addLast(song);
    this.guardUnique(song.id);
    const next = this.nodeAt(index);
    const prev = next.prev as SongNode;
    const node = new SongNode(song);
    node.prev = prev;
    node.next = next;
    prev.next = node;
    next.prev = node;
    this.count += 1;
  }

  removeAt(index: number): Song {
    assertIndex(index, this.count, false);
    const target = this.nodeAt(index);
    return this.detach(target);
  }

  removeById(id: string): Song | null {
    const target = this.find(id);
    if (!target) return null;
    return this.detach(target);
  }

  next(): Song | null {
    if (!this.current) return null;
    if (this.current.next) this.current = this.current.next;
    return this.current.song;
  }

  previous(): Song | null {
    if (!this.current) return null;
    if (this.current.prev) this.current = this.current.prev;
    return this.current.song;
  }

  /** Para repeat=all: avance circular lógico sin romper la estructura. */
  nextCircular(): Song | null {
    if (!this.current) return null;
    this.current = this.current.next ?? this.head;
    return this.current?.song ?? null;
  }

  previousCircular(): Song | null {
    if (!this.current) return null;
    this.current = this.current.prev ?? this.tail;
    return this.current?.song ?? null;
  }

  getCurrent(): Song | null {
    return this.current?.song ?? null;
  }

  setCurrentById(id: string): boolean {
    const node = this.find(id);
    if (!node) return false;
    this.current = node;
    return true;
  }

  find(id: string): SongNode | null {
    let p = this.head;
    while (p) {
      if (p.song.id === id) return p;
      p = p.next;
    }
    return null;
  }

  move(from: number, to: number): void {
    assertIndex(from, this.count, false);
    assertIndex(to, this.count, false);
    if (from === to) return;
    const arr = this.toArray();
    const [song] = arr.splice(from, 1);
    arr.splice(to, 0, song);
    const currentId = this.getCurrent()?.id;
    this.rebuild(arr);
    if (currentId) this.setCurrentById(currentId);
  }

  toArray(): Song[] {
    const out: Song[] = [];
    let p = this.head;
    while (p) {
      out.push(p.song);
      p = p.next;
    }
    return out;
  }

  clear(): void {
    let p = this.head;
    while (p) {
      const n = p.next;
      p.prev = null;
      p.next = null;
      p = n;
    }
    this.head = this.tail = this.current = null;
    this.count = 0;
  }

  debugChain(): string {
    if (!this.head) return 'null ⇄ ∅ ⇄ null';
    const parts: string[] = [];
    let p: SongNode | null = this.head;
    while (p) {
      const marks: string[] = [];
      if (p === this.head) marks.push('head');
      if (p === this.tail) marks.push('tail');
      if (p === this.current) marks.push('current');
      parts.push(`[${p.song.title}${marks.length ? `:${marks.join(',')}` : ''}]`);
      p = p.next;
    }
    return `null ⇄ ${parts.join(' ⇄ ')} ⇄ null`;
  }

  private nodeAt(index: number): SongNode {
    // Recorre desde el extremo más cercano: O(n/2).
    if (index < this.count / 2) {
      let p = this.head as SongNode;
      for (let i = 0; i < index; i++) p = p.next as SongNode;
      return p;
    }
    let p = this.tail as SongNode;
    for (let i = this.count - 1; i > index; i--) p = p.prev as SongNode;
    return p;
  }

  private detach(target: SongNode): Song {
    const { prev, next } = target;
    if (prev) prev.next = next;
    else this.head = next;
    if (next) next.prev = prev;
    else this.tail = prev;

    if (this.current === target) {
      this.current = next ?? prev ?? null;
    }
    target.prev = null;
    target.next = null;
    this.count -= 1;
    if (this.count === 0) this.head = this.tail = this.current = null;
    return target.song;
  }

  private guardUnique(id: string): void {
    if (this.find(id)) throw new Error(`Duplicado: ya existe song id=${id}`);
  }

  private rebuild(songs: Song[]): void {
    this.head = this.tail = this.current = null;
    this.count = 0;
    for (const s of songs) {
      const node = new SongNode(s);
      if (!this.tail) {
        this.head = this.tail = node;
        if (!this.current) this.current = node;
      } else {
        node.prev = this.tail;
        this.tail.next = node;
        this.tail = node;
      }
      this.count += 1;
    }
  }
}
