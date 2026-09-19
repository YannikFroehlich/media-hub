import { IconConfig } from './models';

export interface IconPreset {
  id: string;
  label: string;
  className: string;
}

export const CUSTOM_ICON_PATTERN = /^$|^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/;

export const COLOR_PRESETS = [
  '#3882F6',
  '#2563EB',
  '#6366F1',
  '#7C4DFF',
  '#A855F7',
  '#D946EF',
  '#DB2F80',
  '#F43F5E',
  '#FF3038',
  '#FF6B35',
  '#FF9418',
  '#F6C945',
  '#84CC16',
  '#42B866',
  '#14B8A6',
  '#23B8C9',
];

export const ICON_PRESETS: IconPreset[] = [
  { id: 'streaming', label: 'Streaming', className: 'fa-solid fa-tv' },
  { id: 'video', label: 'Video', className: 'fa-solid fa-video' },
  { id: 'movies', label: 'Filme', className: 'fa-solid fa-clapperboard' },
  { id: 'tv', label: 'Serien', className: 'fa-solid fa-tv' },
  { id: 'youtube', label: 'YouTube', className: 'fa-brands fa-youtube' },
  { id: 'broadcast', label: 'Streams', className: 'fa-solid fa-tower-broadcast' },
  { id: 'folder-play', label: 'Mediathek', className: 'fa-solid fa-folder-open' },
  { id: 'masks', label: 'Genres', className: 'fa-solid fa-masks-theater' },
  { id: 'star', label: 'Stern', className: 'fa-solid fa-star' },
  { id: 'bookmark', label: 'Watchlist', className: 'fa-regular fa-bookmark' },
  { id: 'heart', label: 'Favoriten', className: 'fa-regular fa-heart' },
  { id: 'music', label: 'Musik', className: 'fa-solid fa-music' },
  { id: 'live-tv', label: 'Live TV', className: 'fa-solid fa-tv' },
  { id: 'microphone', label: 'Podcasts', className: 'fa-solid fa-microphone' },
  { id: 'radio', label: 'Radio', className: 'fa-solid fa-radio' },
  { id: 'tools', label: 'Tools', className: 'fa-solid fa-screwdriver-wrench' },
  { id: 'globe', label: 'Browser', className: 'fa-solid fa-globe' },
  { id: 'folder', label: 'Dateien', className: 'fa-solid fa-folder' },
  { id: 'notes', label: 'Notizen', className: 'fa-solid fa-file-lines' },
  { id: 'settings', label: 'Einstellungen', className: 'fa-solid fa-gear' },
  { id: 'grid', label: 'Übersicht', className: 'fa-solid fa-table-cells-large' },
];

export function presetClass(id: string): string {
  return ICON_PRESETS.find((item) => item.id === id)?.className ?? 'fa-solid fa-link';
}

export function iconClass(icon: IconConfig): string {
  return icon.kind === 'font-awesome' ? `${icon.family} ${icon.name}` : presetClass(icon.id);
}

/** Turns the icon picker + custom-class input of a form into a validated IconConfig. */
export function formIcon(presetId: string, custom: string): IconConfig {
  const tokens = custom.trim().split(/\s+/);
  if (
    tokens.length === 2 &&
    /^(fa-solid|fa-regular|fa-brands)$/.test(tokens[0]) &&
    /^fa-[a-z0-9-]+$/.test(tokens[1])
  ) {
    return {
      kind: 'font-awesome',
      family: tokens[0] as 'fa-solid' | 'fa-regular' | 'fa-brands',
      name: tokens[1],
    };
  }
  return { kind: 'preset', id: presetId };
}

export function handleWebsiteIconLoad(event: Event): void {
  const image = event.target as HTMLImageElement;
  image.classList.remove('load-failed');
  image.parentElement?.classList.add('favicon-loaded');
}

export function handleWebsiteIconError(event: Event): void {
  const image = event.target as HTMLImageElement;
  image.classList.add('load-failed');
  image.parentElement?.classList.remove('favicon-loaded');
}
