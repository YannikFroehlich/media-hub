import { HubGroup, MediaHubConfig, Shortcut } from './models';

const preset = (id: string) => ({ kind: 'preset' as const, id });

const shortcut = (
  name: string,
  url: string,
  icon: string,
  color: string,
  id: string,
): Shortcut => ({
  id,
  name,
  url,
  icon: preset(icon),
  color,
  openBehavior: 'inherit',
  enabled: true,
});

const group = (
  id: string,
  name: string,
  icon: string,
  color: string,
  shortcuts: Shortcut[],
): HubGroup => ({
  id,
  name,
  icon: preset(icon),
  color,
  layout: 'standard',
  options: {
    allowShortcutReordering: true,
    showTitle: true,
    useAccentBackground: false,
  },
  shortcuts,
});

export function createDefaultConfig(): MediaHubConfig {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    settings: {
      theme: 'dark',
      defaultOpenBehavior: 'same-tab',
      searchEngine: {
        name: 'Google',
        urlTemplate: 'https://www.google.com/search?q={query}',
      },
      showSubtitle: true,
      showKeyboardHint: true,
    },
    groups: [
      group('streaming', 'Streaming', 'streaming', '#18b9ff', [
        shortcut('Filme', 'https://www.netflix.com/browse/genre/34399', 'movies', '#2799ff', 'movies'),
        shortcut('Serien', 'https://www.netflix.com/browse/genre/83', 'tv', '#6556ff', 'series'),
        shortcut('YouTube', 'https://www.youtube.com', 'youtube', '#ff1738', 'youtube'),
        shortcut('Streams', 'https://www.twitch.tv', 'broadcast', '#a348ff', 'streams'),
      ]),
      group('video', 'Video', 'video', '#bf43ff', [
        shortcut('Mediathek', 'https://www.ardmediathek.de', 'folder-play', '#9e47ff', 'mediathek'),
        shortcut('Genres', 'https://www.imdb.com/feature/genre', 'masks', '#a94bff', 'genres'),
        shortcut('Neuzugänge', 'https://www.justwatch.com/de', 'star', '#a448ff', 'new'),
        shortcut('Watchlist', 'https://www.imdb.com/list/watchlist', 'bookmark', '#a448ff', 'watchlist'),
      ]),
      group('favorites', 'Favoriten', 'heart', '#82df29', [
        shortcut('Musik', 'https://open.spotify.com', 'music', '#82df29', 'music'),
        shortcut('Live TV', 'https://www.zdf.de/live-tv', 'live-tv', '#82df29', 'livetv'),
        shortcut('Podcasts', 'https://podcasts.google.com', 'microphone', '#82df29', 'podcasts'),
        shortcut('Radio', 'https://www.radio.de', 'radio', '#82df29', 'radio'),
      ]),
      group('tools', 'Tools', 'tools', '#ff9318', [
        shortcut('Browser', 'https://www.google.com', 'globe', '#ff9318', 'browser'),
        shortcut('Dateien', 'https://drive.google.com', 'folder', '#ff9318', 'files'),
        shortcut('Notizen', 'https://keep.google.com', 'notes', '#ff9318', 'notes'),
        shortcut('Einstellungen', '#settings', 'settings', '#ff9318', 'settings'),
      ]),
    ],
  };
}
