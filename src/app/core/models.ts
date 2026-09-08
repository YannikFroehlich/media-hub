export type Theme = 'dark' | 'light';
export type VisualStyle = 'classic' | 'liquid-glass';
export type OpenBehavior = 'inherit' | 'same-tab' | 'new-tab';
export type GroupLayout = 'compact' | 'standard' | 'large';
export type DisplayMode = 'standard' | 'tv';

export type IconConfig =
  | { kind: 'preset'; id: string }
  | {
      kind: 'font-awesome';
      family: 'fa-solid' | 'fa-regular' | 'fa-brands';
      name: string;
    };

export type ShortcutIconConfig = IconConfig | { kind: 'website' };

export interface Shortcut {
  id: string;
  name: string;
  url: string;
  icon: ShortcutIconConfig;
  color: string;
  openBehavior: OpenBehavior;
  enabled: boolean;
}

export interface HubGroup {
  id: string;
  name: string;
  description?: string;
  icon: IconConfig;
  color: string;
  layout: GroupLayout;
  options: {
    allowShortcutReordering: boolean;
    showTitle: boolean;
    useAccentBackground: boolean;
  };
  shortcuts: Shortcut[];
}

export interface GlobalSettings {
  theme: Theme;
  visualStyle: VisualStyle;
  liquidGlassBackgroundImage: string;
  displayMode: DisplayMode;
  defaultOpenBehavior: Exclude<OpenBehavior, 'inherit'>;
  searchEngine: {
    name: string;
    urlTemplate: string;
  };
  showSubtitle: boolean;
  showKeyboardHint: boolean;
}

export interface MediaHubConfig {
  schemaVersion: 1;
  updatedAt: string;
  settings: GlobalSettings;
  groups: HubGroup[];
}

export interface ExportEnvelope {
  format: 'media-hub-config';
  exportVersion: 1;
  exportedAt: string;
  config: MediaHubConfig;
}
