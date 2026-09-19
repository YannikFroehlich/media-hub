import { computed, effect, Injectable, signal } from '@angular/core';
import { PROFILE_LIMIT, SHORTCUTS_PER_GROUP_LIMIT } from './config-schema';
import { ConfigRepository } from './config-repository';
import { GlobalSettings, HubGroup, MediaHubConfig, Profile, Shortcut, Theme } from './models';

// Fallback for when no location (and therefore no sunrise/sunset) is available.
const AUTO_THEME_FALLBACK_DAY_START_HOUR = 7;
const AUTO_THEME_FALLBACK_DAY_END_HOUR = 20;

@Injectable({ providedIn: 'root' })
export class MediaHubStore {
  private readonly repository = new ConfigRepository();
  private readonly initial = this.repository.load();
  private readonly configState = signal<MediaHubConfig>(this.initial.config);
  private readonly editModeState = signal(false);
  private readonly toastState = signal<string | null>(
    this.initial.recovered
      ? 'Die gespeicherte Konfiguration wurde sicher wiederhergestellt.'
      : null,
  );
  private readonly clockTickState = signal(Date.now());
  /** Today's sunrise/sunset (epoch ms), when a location is available. Fed by app.ts. */
  private readonly sunTimesState = signal<{ sunrise: number; sunset: number } | null>(null);

  readonly config = this.configState.asReadonly();
  readonly profiles = computed(() => this.configState().profiles);
  readonly activeProfileId = computed(() => this.configState().activeProfileId);
  readonly activeProfile = computed<Profile>(() => {
    const config = this.configState();
    return (
      config.profiles.find((profile) => profile.id === config.activeProfileId) ?? config.profiles[0]
    );
  });
  readonly groups = computed(() => this.activeProfile().groups);
  readonly settings = computed(() => this.activeProfile().settings);
  readonly editMode = this.editModeState.asReadonly();
  readonly toast = this.toastState.asReadonly();
  /** Ticks every 60s. Shared clock source for effectiveTheme and app.ts's header clock. */
  readonly clockTick = this.clockTickState.asReadonly();
  readonly effectiveTheme = computed<Theme>(() => {
    const settings = this.settings();
    if (!settings.autoTheme) return settings.theme;
    const now = this.clockTick();
    const sunTimes = this.sunTimesState();
    if (sunTimes) return now >= sunTimes.sunrise && now < sunTimes.sunset ? 'light' : 'dark';
    const hour = new Date(now).getHours();
    return hour >= AUTO_THEME_FALLBACK_DAY_START_HOUR && hour < AUTO_THEME_FALLBACK_DAY_END_HOUR
      ? 'light'
      : 'dark';
  });

  constructor() {
    window.setInterval(() => this.clockTickState.set(Date.now()), 60_000);

    effect(() => {
      const settings = this.settings();
      const root = document.documentElement;
      root.setAttribute('data-theme', this.effectiveTheme());
      root.setAttribute('data-style', settings.visualStyle);
      root.setAttribute('data-pointer-effects', settings.classicPointerEffects ? 'on' : 'off');
      root.setAttribute('data-display-mode', settings.displayMode);
      root.setAttribute('data-contrast', settings.highContrast ? 'high' : 'normal');
      root.style.setProperty(
        '--liquid-group-blur-filter',
        `blur(${settings.liquidGlassGroupBlur}px)`,
      );
      root.style.setProperty(
        '--liquid-shortcut-blur-filter',
        settings.liquidGlassShortcutBlur ? `blur(${settings.liquidGlassShortcutBlur}px)` : 'none',
      );

      if (settings.liquidGlassBackgroundImage) {
        root.setAttribute('data-liquid-background', 'custom');
        root.style.setProperty(
          '--liquid-background-image',
          `url("${settings.liquidGlassBackgroundImage}")`,
        );
      } else {
        root.setAttribute('data-liquid-background', 'default');
        root.style.removeProperty('--liquid-background-image');
      }
    });
  }

  setSunTimes(sunTimes: { sunrise: number; sunset: number } | null): void {
    this.sunTimesState.set(sunTimes);
  }

  toggleEditMode(): void {
    this.editModeState.update((value) => !value);
  }

  setEditMode(value: boolean): void {
    this.editModeState.set(value);
  }

  updateGroup(group: HubGroup): void {
    this.updateActiveProfile((profile) => ({
      ...profile,
      groups: profile.groups.map((item) => (item.id === group.id ? group : item)),
    }));
  }

  addGroup(group: HubGroup): void {
    this.updateActiveProfile((profile) => ({ ...profile, groups: [...profile.groups, group] }));
    this.notify(`Gruppe „${group.name}“ wurde erstellt.`);
  }

  deleteGroup(id: string): void {
    const group = this.groups().find((item) => item.id === id);
    this.updateActiveProfile((profile) => ({
      ...profile,
      groups: profile.groups.filter((item) => item.id !== id),
    }));
    if (group) this.notify(`Gruppe „${group.name}“ wurde gelöscht.`);
  }

  upsertShortcut(groupId: string, shortcut: Shortcut): void {
    const isNew = !this.groups().some((group) =>
      group.shortcuts.some((item) => item.id === shortcut.id),
    );
    this.updateActiveProfile((profile) => ({
      ...profile,
      groups: profile.groups.map((group) => {
        const without = group.shortcuts.filter((item) => item.id !== shortcut.id);
        if (group.id !== groupId) return { ...group, shortcuts: without };
        return { ...group, shortcuts: [...without, shortcut] };
      }),
    }));
    this.notify(
      isNew ? `„${shortcut.name}“ wurde hinzugefügt.` : `„${shortcut.name}“ wurde gespeichert.`,
    );
  }

  deleteShortcut(groupId: string, shortcutId: string): void {
    this.updateActiveProfile((profile) => ({
      ...profile,
      groups: profile.groups.map((group) =>
        group.id === groupId
          ? { ...group, shortcuts: group.shortcuts.filter((item) => item.id !== shortcutId) }
          : group,
      ),
    }));
    this.notify('Verknüpfung wurde gelöscht.');
  }

  reorderGroups(previousIndex: number, currentIndex: number): void {
    const groups = [...this.groups()];
    const [moved] = groups.splice(previousIndex, 1);
    groups.splice(currentIndex, 0, moved);
    this.updateActiveProfile((profile) => ({ ...profile, groups }));
    this.notify(`„${moved.name}“ ist jetzt an Position ${currentIndex + 1}.`);
  }

  reorderShortcuts(groupId: string, previousIndex: number, currentIndex: number): void {
    const groups = this.groups().map((group) => {
      if (group.id !== groupId) return group;
      const shortcuts = [...group.shortcuts];
      const [moved] = shortcuts.splice(previousIndex, 1);
      shortcuts.splice(currentIndex, 0, moved);
      this.notify(`„${moved.name}“ ist jetzt an Position ${currentIndex + 1}.`);
      return { ...group, shortcuts };
    });
    this.updateActiveProfile((profile) => ({ ...profile, groups }));
  }

  moveShortcutToGroup(
    fromGroupId: string,
    toGroupId: string,
    previousIndex: number,
    currentIndex: number,
  ): void {
    const source = this.groups().find((group) => group.id === fromGroupId);
    const target = this.groups().find((group) => group.id === toGroupId);
    const moved = source?.shortcuts[previousIndex];
    if (!source || !target || !moved || source.id === target.id) return;
    if (target.shortcuts.length >= SHORTCUTS_PER_GROUP_LIMIT) {
      this.notify(
        `„${target.name}“ ist voll. Es sind höchstens ${SHORTCUTS_PER_GROUP_LIMIT} Verknüpfungen möglich.`,
      );
      return;
    }

    const groups = this.groups().map((group) => {
      if (group.id === fromGroupId) {
        return { ...group, shortcuts: group.shortcuts.filter((item) => item.id !== moved.id) };
      }
      if (group.id === toGroupId) {
        const shortcuts = [...group.shortcuts];
        shortcuts.splice(Math.max(0, Math.min(shortcuts.length, currentIndex)), 0, moved);
        return { ...group, shortcuts };
      }
      return group;
    });
    this.updateActiveProfile((profile) => ({ ...profile, groups }));
    this.notify(`„${moved.name}“ ist jetzt in „${target.name}“.`);
  }

  moveGroupByKeyboard(id: string, direction: number): void {
    const index = this.groups().findIndex((group) => group.id === id);
    const next = Math.max(0, Math.min(this.groups().length - 1, index + direction));
    if (index !== next) this.reorderGroups(index, next);
  }

  moveShortcutByKeyboard(groupId: string, shortcutId: string, direction: number): void {
    const group = this.groups().find((item) => item.id === groupId);
    if (!group) return;
    const index = group.shortcuts.findIndex((item) => item.id === shortcutId);
    const next = Math.max(0, Math.min(group.shortcuts.length - 1, index + direction));
    if (index !== next) this.reorderShortcuts(groupId, index, next);
  }

  updateSettings(settings: GlobalSettings): void {
    this.updateActiveProfile((profile) => ({ ...profile, settings }));
    this.notify('Einstellungen wurden gespeichert.');
  }

  importConfig(config: MediaHubConfig): void {
    this.commit(config);
    this.notify('Konfiguration wurde importiert.');
  }

  reset(): void {
    this.configState.set(this.repository.reset());
    this.notify('Media Hub wurde zurückgesetzt.');
  }

  switchProfile(id: string): void {
    const config = this.configState();
    if (id === config.activeProfileId || !config.profiles.some((profile) => profile.id === id)) {
      return;
    }
    this.commit({ ...config, activeProfileId: id });
  }

  addProfile(profile: Profile): void {
    const config = this.configState();
    if (config.profiles.length >= PROFILE_LIMIT) {
      this.notify(`Es sind höchstens ${PROFILE_LIMIT} Profile möglich.`);
      return;
    }
    this.commit({ ...config, profiles: [...config.profiles, profile] });
    this.notify(`Profil „${profile.name}“ wurde erstellt.`);
  }

  renameProfile(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const config = this.configState();
    this.commit({
      ...config,
      profiles: config.profiles.map((profile) =>
        profile.id === id ? { ...profile, name: trimmed } : profile,
      ),
    });
  }

  deleteProfile(id: string): void {
    const config = this.configState();
    if (config.profiles.length <= 1) return;
    const deleted = config.profiles.find((profile) => profile.id === id);
    if (!deleted) return;
    const profiles = config.profiles.filter((profile) => profile.id !== id);
    const activeProfileId = config.activeProfileId === id ? profiles[0].id : config.activeProfileId;
    this.commit({ ...config, profiles, activeProfileId });
    this.notify(`Profil „${deleted.name}“ wurde gelöscht.`);
  }

  notify(message: string): void {
    this.toastState.set(message);
    window.setTimeout(() => {
      if (this.toastState() === message) this.toastState.set(null);
    }, 3200);
  }

  private updateActiveProfile(mutate: (profile: Profile) => Profile): void {
    const config = this.configState();
    this.commit({
      ...config,
      profiles: config.profiles.map((profile) =>
        profile.id === config.activeProfileId ? mutate(profile) : profile,
      ),
    });
  }

  private commit(config: MediaHubConfig): void {
    const next = { ...config, schemaVersion: 2 as const, updatedAt: new Date().toISOString() };
    this.repository.save(next);
    this.configState.set(next);
  }
}
