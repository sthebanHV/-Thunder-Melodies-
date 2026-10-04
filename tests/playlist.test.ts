import { describe, expect, it } from 'vitest';
import { DoublyLinkedList, type Song } from '../src/domain/playlist/DoublyLinkedList';

const s = (id: string, title = id): Song => ({ id, title, artist: 'Art', durationSec: 180 });

describe('DoublyLinkedList taller', () => {
  it('primera canción es head/tail/current', () => {
    const l = new DoublyLinkedList();
    l.addFirst(s('a'));
    expect(l.size).toBe(1);
    expect(l.getCurrent()?.id).toBe('a');
  });
  it('addFirst/addLast/addAt mantienen orden', () => {
    const l = new DoublyLinkedList();
    l.addLast(s('b'));
    l.addFirst(s('a'));
    l.addAt(1, s('m'));
    expect(l.toArray().map((x) => x.id)).toEqual(['a', 'm', 'b']);
  });
  it('addAt fuera de rango lanza RangeError', () => {
    const l = new DoublyLinkedList();
    expect(() => l.addAt(1, s('x'))).toThrow(RangeError);
  });
  it('eliminar cabeza/cola/medio/única', () => {
    const l = new DoublyLinkedList();
    ['a', 'b', 'c'].forEach((id) => l.addLast(s(id)));
    expect(l.removeAt(1).id).toBe('b');
    expect(l.removeAt(0).id).toBe('a');
    expect(l.removeAt(0).id).toBe('c');
    expect(l.isEmpty()).toBe(true);
    expect(l.getCurrent()).toBeNull();
  });
  it('next/previous O(1) y extremos', () => {
    const l = new DoublyLinkedList();
    ['a', 'b'].forEach((id) => l.addLast(s(id)));
    l.setCurrentById('a');
    expect(l.next()?.id).toBe('b');
    expect(l.next()?.id).toBe('b');
    expect(l.previous()?.id).toBe('a');
    expect(l.previous()?.id).toBe('a');
  });
  it('eliminar current mueve a siguiente', () => {
    const l = new DoublyLinkedList();
    ['a', 'b', 'c'].forEach((id) => l.addLast(s(id)));
    l.setCurrentById('b');
    l.removeById('b');
    expect(l.getCurrent()?.id).toBe('c');
  });
});
