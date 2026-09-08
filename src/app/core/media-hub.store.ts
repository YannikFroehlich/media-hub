import { computed, effect, Injectable, signal } from '@angular/core';
import { SHORTCUTS_PER_GROUP_LIMIT } from './config-schema';
import { ConfigRepository } from './config-repository';
import { createDefaultConfig } from './default-config';
import { HubGroup, MediaHubConfig, Shortcut } from './models';

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

  readonly config = this.configState.asReadonly();
  readonly groups = computed(() => this.configState().groups);
  readonly settings = computed(() => this.configState().settings);
  readonly editMode = this.editModeState.asReadonly();
  readonly toast = this.toastState.asReadonly();

  constructor() {
    effect(() => {
      const settings = this.settings();
      const root = document.documentElement;
      root.setAttribute('data-theme', settings.theme);
      root.setAttribute('data-style', settings.visualStyle);
      root.setAttribute('data-display-mode', settings.displayMode);

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

  toggleEditMode(): void {
    this.editModeState.update((value) => !value);
  }

  setEditMode(value: boolean): void {
    this.editModeState.set(value);
  }

  updateGroup(group: HubGroup): void {
    this.commit({
      ...this.configState(),
      groups: this.groups().map((item) => (item.id === group.id ? group : item)),
    });
  }

  addGroup(group: HubGroup): void {
    this.commit({ ...this.configState(), groups: [...this.groups(), group] });
    this.notify(`Gruppe „${group.name}“ wurde erstellt.`);
  }

  deleteGroup(id: string): void {
    const group = this.groups().find((item) => item.id === id);
    this.commit({ ...this.configState(), groups: this.groups().filter((item) => item.id !== id) });
    if (group) this.notify(`Gruppe „${group.name}“ wurde gelöscht.`);
  }

  upsertShortcut(groupId: string, shortcut: Shortcut): void {
    const isNew = !this.groups().some((group) =>
      group.shortcuts.some((item) => item.id === shortcut.id),
    );
    const groups = this.groups().map((group) => {
      const without = group.shortcuts.filter((item) => item.id !== shortcut.id);
      if (group.id !== groupId) return { ...group, shortcuts: without };
      return { ...group, shortcuts: [...without, shortcut] };
    });
    this.commit({ ...this.configState(), groups });
    this.notify(
      isNew ? `„${shortcut.name}“ wurde hinzugefügt.` : `„${shortcut.name}“ wurde gespeichert.`,
    );
  }

  deleteShortcut(groupId: string, shortcutId: string): void {
    const groups = this.groups().map((group) =>
      group.id === groupId
        ? { ...group, shortcuts: group.shortcuts.filter((item) => item.id !== shortcutId) }
        : group,
    );
    this.commit({ ...this.configState(), groups });
    this.notify('Verknüpfung wurde gelöscht.');
  }

  reorderGroups(previousIndex: number, currentIndex: number): void {
    const groups = [...this.groups()];
    const [moved] = groups.splice(previousIndex, 1);
    groups.splice(currentIndex, 0, moved);
    this.commit({ ...this.configState(), groups });
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
    this.commit({ ...this.configState(), groups });
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
    this.commit({ ...this.configState(), groups });
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

  updateSettings(settings: MediaHubConfig['settings']): void {
    this.commit({ ...this.configState(), settings });
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

  notify(message: string): void {
    this.toastState.set(message);
    window.setTimeout(() => {
      if (this.toastState() === message) this.toastState.set(null);
    }, 3200);
  }

  private commit(config: MediaHubConfig): void {
    const next = { ...config, schemaVersion: 1 as const, updatedAt: new Date().toISOString() };
    this.repository.save(next);
    this.configState.set(next);
  }
}
