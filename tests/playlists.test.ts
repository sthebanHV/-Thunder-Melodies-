import { beforeEach, describe, expect, it } from 'vitest';
import { usePlaylistStore } from '../src/state/playlistLibrary';
import type { Song } from '../src/domain/playlist/DoublyLinkedList';

const s = (id: string, title = id): Song => ({ id, title, artist: 'Art', durationSec: 180 });

const lib = () => usePlaylistStore.getState();

beforeEach(() => {
  usePlaylistStore.setState({ playlists: [] });
});

describe('Biblioteca de playlists manuales', () => {
  it('crea playlist con nombre limpio y canciones dadas', () => {
    const id = lib().create('  Road trip  ', [s('a')]);
    const pl = lib().playlists[0];
    expect(pl.id).toBe(id);
    expect(pl.name).toBe('Road trip');
    expect(pl.songs.map((x) => x.id)).toEqual(['a']);
  });

  it('rechaza nombre vacío y duplicados (case-insensitive)', () => {
    lib().create('Mix');
    expect(() => lib().create('   ')).toThrow(/nombre/i);
    expect(() => lib().create('MIX')).toThrow(/Ya existe/);
    expect(lib().playlists).toHaveLength(1);
  });

  it('renombrar valida y respeta otros ids', () => {
    const a = lib().create('A');
    lib().create('B');
    lib().rename(a, '  A2  ');
    expect(lib().playlists.find((p) => p.id === a)?.name).toBe('A2');
    const b = lib().playlists.find((p) => p.name === 'B')?.id;
    expect(() => lib().rename(a, 'b')).toThrow(/Ya existe/);
    expect(() => lib().rename(a, '  ')).toThrow(/nombre/i);
    expect(b).toBeTruthy();
  });

  it('agrega y quita canciones sin duplicar ids', () => {
    const id = lib().create('Mix');
    lib().addSong(id, s('x', 'Canción X'));
    lib().addSong(id, s('y'));
    expect(() => lib().addSong(id, s('x'))).toThrow(/ya está/);
    lib().removeSong(id, 'x');
    const pl = lib().playlists.find((p) => p.id === id);
    expect(pl?.songs.map((c) => c.id)).toEqual(['y']);
    expect(() => lib().addSong('nope', s('z'))).toThrow(/no encontrada/);
  });

  it('eliminar playlist la saca de la lista', () => {
    lib().create('A');
    const b = lib().create('B');
    lib().remove(b);
    expect(lib().playlists.map((p) => p.name)).toEqual(['A']);
  });
});
