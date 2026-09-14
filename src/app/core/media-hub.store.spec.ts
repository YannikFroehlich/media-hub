import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { SHORTCUTS_PER_GROUP_LIMIT } from './config-schema';
import { createDefaultConfig } from './default-config';
import { MediaHubStore } from './media-hub.store';
import { Shortcut } from './models';

function shortcutIds(store: MediaHubStore, groupId: string): string[] {
  return (
    store
      .groups()
      .find((group) => group.id === groupId)
      ?.shortcuts.map((shortcut) => shortcut.id) ?? []
  );
}

describe('MediaHubStore', () => {
  let store: MediaHubStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(MediaHubStore);
  });

  describe('moveShortcutToGroup', () => {
    it('should insert the shortcut into the target group at the drop position', () => {
      store.moveShortcutToGroup('streaming', 'video', 0, 2);

      expect(shortcutIds(store, 'streaming')).toEqual(['series', 'youtube', 'streams']);
      expect(shortcutIds(store, 'video')).toEqual([
        'mediathek',
        'genres',
        'movies',
        'new',
        'watchlist',
      ]);
    });

    it('should append the shortcut when it is dropped past the end of the target group', () => {
      store.moveShortcutToGroup('streaming', 'favorites', 2, 99);

      expect(shortcutIds(store, 'streaming')).toEqual(['movies', 'series', 'streams']);
      expect(shortcutIds(store, 'favorites').at(-1)).toBe('youtube');
    });

    it('should persist the move so it survives a reload', () => {
      store.moveShortcutToGroup('streaming', 'video', 0, 0);

      const reloaded = TestBed.runInInjectionContext(() => new MediaHubStore());
      expect(shortcutIds(reloaded, 'video')).toContain('movies');
      expect(shortcutIds(reloaded, 'streaming')).not.toContain('movies');
    });

    it('should ignore unknown groups and unknown drag positions', () => {
      const before = JSON.stringify(store.groups());

      store.moveShortcutToGroup('missing', 'video', 0, 0);
      store.moveShortcutToGroup('streaming', 'missing', 0, 0);
      store.moveShortcutToGroup('streaming', 'video', 42, 0);

      expect(JSON.stringify(store.groups())).toBe(before);
    });

    it('should ignore a move into the source group', () => {
      store.moveShortcutToGroup('streaming', 'streaming', 0, 2);

      expect(shortcutIds(store, 'streaming')).toEqual(['movies', 'series', 'youtube', 'streams']);
    });

    it('should reject the move when the target group is already full', () => {
      const config = createDefaultConfig();
      const filler = (index: number): Shortcut => ({
        id: `filler-${index}`,
        name: `Filler ${index}`,
        url: 'https://example.com',
        icon: { kind: 'preset', id: 'globe' },
        color: '#3882F6',
        openBehavior: 'inherit',
        enabled: true,
      });
      config.groups[1].shortcuts = Array.from({ length: SHORTCUTS_PER_GROUP_LIMIT }, (_, index) =>
        filler(index),
      );
      store.importConfig(config);

      store.moveShortcutToGroup('streaming', 'video', 0, 0);

      expect(shortcutIds(store, 'streaming')).toContain('movies');
      expect(shortcutIds(store, 'video')).toHaveLength(SHORTCUTS_PER_GROUP_LIMIT);
      expect(store.toast()).toContain('ist voll');
    });
  });

  describe('effectiveTheme', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('uses the manually selected theme when autoTheme is disabled', () => {
      store.updateSettings({ ...store.settings(), autoTheme: false, theme: 'light' });

      expect(store.effectiveTheme()).toBe('light');
    });

    it('resolves to light during the daytime window when autoTheme is enabled', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
      const dayStore = TestBed.runInInjectionContext(() => new MediaHubStore());

      dayStore.updateSettings({ ...dayStore.settings(), autoTheme: true, theme: 'dark' });

      expect(dayStore.effectiveTheme()).toBe('light');
    });

    it('resolves to dark outside the daytime window when autoTheme is enabled', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 0, 1, 2, 0));
      const nightStore = TestBed.runInInjectionContext(() => new MediaHubStore());

      nightStore.updateSettings({ ...nightStore.settings(), autoTheme: true, theme: 'light' });

      expect(nightStore.effectiveTheme()).toBe('dark');
    });

    it('prefers sunrise/sunset over the fixed window once sun times are set', () => {
      vi.useFakeTimers();
      // 6:30 local — inside the fixed 7-20 fallback window's "night" side, but after today's
      // sunrise, so a sun-times-aware evaluation should already call it daytime.
      vi.setSystemTime(new Date(2026, 5, 21, 6, 30));
      const sunStore = TestBed.runInInjectionContext(() => new MediaHubStore());
      sunStore.updateSettings({ ...sunStore.settings(), autoTheme: true, theme: 'dark' });

      sunStore.setSunTimes({
        sunrise: new Date(2026, 5, 21, 5, 0).getTime(),
        sunset: new Date(2026, 5, 21, 21, 0).getTime(),
      });

      expect(sunStore.effectiveTheme()).toBe('light');
    });

    it('falls back to the fixed window once sun times are cleared', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 5, 21, 6, 30));
      const sunStore = TestBed.runInInjectionContext(() => new MediaHubStore());
      sunStore.updateSettings({ ...sunStore.settings(), autoTheme: true, theme: 'dark' });
      sunStore.setSunTimes({
        sunrise: new Date(2026, 5, 21, 5, 0).getTime(),
        sunset: new Date(2026, 5, 21, 21, 0).getTime(),
      });

      sunStore.setSunTimes(null);

      expect(sunStore.effectiveTheme()).toBe('dark');
    });
  });
});
