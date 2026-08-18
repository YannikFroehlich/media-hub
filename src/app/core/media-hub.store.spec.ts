import { TestBed } from '@angular/core/testing';
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
});
