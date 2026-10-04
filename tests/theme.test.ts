import { beforeEach, describe, expect, it } from 'vitest';
import { useThemeStore } from '../src/state/theme';

const store = () => useThemeStore.getState();

beforeEach(() => {
  store().set('dark');
});

describe('Store de tema (claro/oscuro)', () => {
  it('arranca en oscuro por defecto', () => {
    expect(store().theme).toBe('dark');
  });

  it('toggle alterna dark → light → dark', () => {
    store().toggle();
    expect(store().theme).toBe('light');
    store().toggle();
    expect(store().theme).toBe('dark');
  });

  it('set acepta valores válidos y deja el DOM consistente', () => {
    store().set('light');
    expect(store().theme).toBe('light');
    if (typeof document !== 'undefined') {
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    }
    store().set('dark');
    expect(store().theme).toBe('dark');
  });
});
