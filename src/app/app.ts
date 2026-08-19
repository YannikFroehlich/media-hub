import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { parseExport } from './core/config-schema';
import { MediaHubStore } from './core/media-hub.store';
import {
  ExportEnvelope,
  GroupLayout,
  HubGroup,
  IconConfig,
  OpenBehavior,
  Shortcut,
} from './core/models';
import { UrlResolver } from './core/url-resolver';
import { WebsiteIconResolver } from './core/website-icon-resolver';

type PanelKind = 'shortcut' | 'group' | 'settings' | null;

interface IconPreset {
  id: string;
  label: string;
  className: string;
}

@Component({
  selector: 'app-root',
  imports: [
    ReactiveFormsModule,
    CdkDropList,
    CdkDropListGroup,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkTrapFocus,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(MediaHubStore);
  private readonly resolver = inject(UrlResolver);
  private readonly websiteIconResolver = inject(WebsiteIconResolver);
  private readonly fb = inject(FormBuilder);
  private readonly document = inject(DOCUMENT);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('importInput') private importInput?: ElementRef<HTMLInputElement>;

  protected readonly panel = signal<PanelKind>(null);
  protected readonly selectedGroupId = signal<string | null>(null);
  protected readonly selectedShortcutId = signal<string | null>(null);
  protected readonly importError = signal<string | null>(null);
  protected readonly liveMessage = signal('');
  protected readonly showKeyboardHelp = signal(false);
  protected readonly colorPresets = [
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

  protected readonly iconPresets: IconPreset[] = [
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

  protected readonly shortcutForm = this.fb.nonNullable.group({
    targetGroupId: ['', Validators.required],
    name: ['', [Validators.required, Validators.maxLength(48)]],
    url: ['', [Validators.required, Validators.maxLength(2048)]],
    useWebsiteIcon: [false],
    iconId: ['youtube', Validators.required],
    customIcon: ['', Validators.pattern(/^$|^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/)],
    color: ['#7C4DFF', Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
    openBehavior: ['inherit' as OpenBehavior],
    enabled: [true],
  });

  protected readonly groupForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(48)]],
    description: ['', Validators.maxLength(120)],
    iconId: ['folder', Validators.required],
    customIcon: ['', Validators.pattern(/^$|^(fa-solid|fa-regular|fa-brands) fa-[a-z0-9-]+$/)],
    color: ['#3882F6', Validators.pattern(/^#[0-9A-Fa-f]{6}$/)],
    layout: ['standard' as GroupLayout],
    allowShortcutReordering: [true],
    showTitle: [true],
    useAccentBackground: [false],
  });

  protected readonly settingsForm = this.fb.nonNullable.group({
    theme: ['dark' as 'dark' | 'light'],
    defaultOpenBehavior: ['same-tab' as 'same-tab' | 'new-tab'],
    searchName: ['', [Validators.required, Validators.maxLength(32)]],
    searchTemplate: ['', Validators.required],
    showSubtitle: [true],
    showKeyboardHint: [true],
  });

  protected readonly panelTitle = computed(() => {
    if (this.panel() === 'shortcut') {
      return this.selectedShortcutId() ? 'Verknüpfung bearbeiten' : 'Verknüpfung hinzufügen';
    }
    if (this.panel() === 'group') {
      return this.selectedGroupId() ? 'Gruppe bearbeiten' : 'Gruppe erstellen';
    }
    return 'Media Hub anpassen';
  });

  protected iconClass(icon: IconConfig): string {
    if (icon.kind === 'font-awesome') return `${icon.family} ${icon.name}`;
    return this.iconPresets.find((item) => item.id === icon.id)?.className ?? 'fa-solid fa-link';
  }

  protected presetClass(id: string): string {
    return this.iconPresets.find((item) => item.id === id)?.className ?? 'fa-solid fa-link';
  }

  protected previewIconClass(form: 'group' | 'shortcut'): string {
    const values =
      form === 'group' ? this.groupForm.getRawValue() : this.shortcutForm.getRawValue();
    return values.customIcon || this.presetClass(values.iconId);
  }

  protected websiteIconUrl(url: string): string | null {
    return this.websiteIconResolver.resolve(url);
  }

  protected handleWebsiteIconLoad(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.classList.remove('load-failed');
    image.parentElement?.classList.add('favicon-loaded');
  }

  protected handleWebsiteIconError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.classList.add('load-failed');
    image.parentElement?.classList.remove('favicon-loaded');
  }

  protected openShortcutPanel(groupId?: string, shortcut?: Shortcut, event?: Event): void {
    event?.stopPropagation();
    this.rememberTrigger(event);
    const group = this.store.groups().find((item) => item.id === groupId);
    this.selectedGroupId.set(groupId ?? this.store.groups()[0]?.id ?? null);
    this.selectedShortcutId.set(shortcut?.id ?? null);
    const icon = shortcut?.icon;
    this.shortcutForm.reset({
      targetGroupId: group?.id ?? this.store.groups()[0]?.id ?? '',
      name: shortcut?.name ?? '',
      url: shortcut?.url === '#settings' ? '' : (shortcut?.url ?? ''),
      useWebsiteIcon: icon?.kind === 'website',
      iconId: icon?.kind === 'preset' ? icon.id : 'globe',
      customIcon: icon?.kind === 'font-awesome' ? `${icon.family} ${icon.name}` : '',
      color: shortcut?.color ?? group?.color ?? '#7C4DFF',
      openBehavior: shortcut?.openBehavior ?? 'inherit',
      enabled: shortcut?.enabled ?? true,
    });
    this.importError.set(null);
    this.panel.set('shortcut');
  }

  protected openGroupPanel(group?: HubGroup, event?: Event): void {
    event?.stopPropagation();
    this.rememberTrigger(event);
    this.selectedGroupId.set(group?.id ?? null);
    this.selectedShortcutId.set(null);
    const icon = group?.icon;
    this.groupForm.reset({
      name: group?.name ?? 'Neue Gruppe',
      description: group?.description ?? '',
      iconId: icon?.kind === 'preset' ? icon.id : 'folder',
      customIcon: icon?.kind === 'font-awesome' ? `${icon.family} ${icon.name}` : '',
      color: group?.color ?? '#3882F6',
      layout: group?.layout ?? 'standard',
      allowShortcutReordering: group?.options.allowShortcutReordering ?? true,
      showTitle: group?.options.showTitle ?? true,
      useAccentBackground: group?.options.useAccentBackground ?? false,
    });
    this.importError.set(null);
    this.panel.set('group');
  }

  protected openSettings(event?: Event): void {
    this.rememberTrigger(event);
    const settings = this.store.settings();
    this.settingsForm.reset({
      theme: settings.theme,
      defaultOpenBehavior: settings.defaultOpenBehavior,
      searchName: settings.searchEngine.name,
      searchTemplate: settings.searchEngine.urlTemplate,
      showSubtitle: settings.showSubtitle,
      showKeyboardHint: settings.showKeyboardHint,
    });
    this.importError.set(null);
    this.panel.set('settings');
  }

  protected closePanel(force = false): void {
    const form = this.activeForm();
    if (!force && form?.dirty && !window.confirm('Ungespeicherte Änderungen verwerfen?')) return;
    this.panel.set(null);
    this.importError.set(null);
    window.setTimeout(() => this.lastTrigger?.focus());
  }

  protected saveShortcut(): void {
    this.shortcutForm.markAllAsTouched();
    if (this.shortcutForm.invalid) return;
    const value = this.shortcutForm.getRawValue();
    const url = this.normalizeShortcutUrl(value.url);
    if (!url) {
      this.importError.set('Bitte gib eine gültige HTTP- oder HTTPS-Adresse ein.');
      return;
    }
    const shortcut: Shortcut = {
      id: this.selectedShortcutId() ?? crypto.randomUUID(),
      name: value.name.trim(),
      url,
      icon: value.useWebsiteIcon
        ? { kind: 'website' }
        : this.formIcon(value.iconId, value.customIcon),
      color: value.color.toUpperCase(),
      openBehavior: value.openBehavior,
      enabled: value.enabled,
    };
    this.store.upsertShortcut(value.targetGroupId, shortcut);
    this.closePanel(true);
  }

  protected saveGroup(): void {
    this.groupForm.markAllAsTouched();
    if (this.groupForm.invalid) return;
    const value = this.groupForm.getRawValue();
    const existing = this.store.groups().find((item) => item.id === this.selectedGroupId());
    const group: HubGroup = {
      id: existing?.id ?? crypto.randomUUID(),
      name: value.name.trim(),
      description: value.description.trim() || undefined,
      icon: this.formIcon(value.iconId, value.customIcon),
      color: value.color.toUpperCase(),
      layout: value.layout,
      options: {
        allowShortcutReordering: value.allowShortcutReordering,
        showTitle: value.showTitle,
        useAccentBackground: value.useAccentBackground,
      },
      shortcuts: existing?.shortcuts ?? [],
    };
    existing ? this.store.updateGroup(group) : this.store.addGroup(group);
    this.closePanel(true);
  }

  protected saveSettings(): void {
    this.settingsForm.markAllAsTouched();
    if (this.settingsForm.invalid) return;
    const value = this.settingsForm.getRawValue();
    const placeholders = value.searchTemplate.match(/\{query\}/g)?.length ?? 0;
    const testUrl = this.resolver.safeHttpUrl(value.searchTemplate.replace('{query}', 'test'));
    if (placeholders !== 1 || !testUrl) {
      this.importError.set(
        'Die Suchvorlage benötigt genau einen {query}-Platzhalter und eine HTTP(S)-Adresse.',
      );
      return;
    }
    this.store.updateSettings({
      theme: value.theme,
      defaultOpenBehavior: value.defaultOpenBehavior,
      searchEngine: { name: value.searchName.trim(), urlTemplate: value.searchTemplate.trim() },
      showSubtitle: value.showSubtitle,
      showKeyboardHint: value.showKeyboardHint,
    });
    this.closePanel(true);
  }

  protected deleteShortcut(): void {
    const groupId = this.selectedGroupId();
    const shortcutId = this.selectedShortcutId();
    if (!groupId || !shortcutId || !window.confirm('Diese Verknüpfung wirklich löschen?')) return;
    this.store.deleteShortcut(groupId, shortcutId);
    this.closePanel(true);
  }

  protected deleteGroup(): void {
    const group = this.store.groups().find((item) => item.id === this.selectedGroupId());
    if (!group) return;
    const detail = group.shortcuts.length
      ? ` Dabei werden auch ${group.shortcuts.length} Verknüpfung${group.shortcuts.length === 1 ? '' : 'en'} entfernt.`
      : '';
    if (!window.confirm(`Gruppe „${group.name}“ wirklich löschen?${detail}`)) return;
    this.store.deleteGroup(group.id);
    this.closePanel(true);
  }

  protected resetActiveForm(): void {
    if (this.panel() === 'shortcut') {
      const groupId = this.shortcutForm.controls.targetGroupId.value;
      const shortcut = this.store
        .groups()
        .flatMap((group) => group.shortcuts)
        .find((item) => item.id === this.selectedShortcutId());
      this.openShortcutPanel(groupId, shortcut);
    } else if (this.panel() === 'group') {
      const group = this.store.groups().find((item) => item.id === this.selectedGroupId());
      this.openGroupPanel(group);
    } else {
      this.openSettings();
    }
  }

  protected submitSearch(): void {
    const input = this.searchInput?.nativeElement.value ?? '';
    const destination = this.resolver.resolve(
      input,
      this.store.settings().searchEngine.urlTemplate,
    );
    if (!destination) {
      if (input.trim())
        this.store.notify('Diese Adresse kann aus Sicherheitsgründen nicht geöffnet werden.');
      return;
    }
    this.navigate(destination, this.store.settings().defaultOpenBehavior);
  }

  protected activateShortcut(group: HubGroup, shortcut: Shortcut, event: Event): void {
    if (this.store.editMode()) {
      this.openShortcutPanel(group.id, shortcut, event);
      return;
    }
    if (shortcut.url === '#settings') {
      this.openSettings(event);
      return;
    }
    const destination = this.resolver.safeHttpUrl(shortcut.url);
    if (!destination) {
      this.store.notify('Diese Verknüpfung enthält keine sichere Adresse.');
      return;
    }
    const behavior =
      shortcut.openBehavior === 'inherit'
        ? this.store.settings().defaultOpenBehavior
        : shortcut.openBehavior;
    this.navigate(destination, behavior);
  }

  protected toggleTheme(): void {
    const settings = this.store.settings();
    this.store.updateSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' });
  }

  protected dropGroup(event: CdkDragDrop<HubGroup[]>): void {
    if (!this.store.editMode() || event.previousIndex === event.currentIndex) return;
    this.store.reorderGroups(event.previousIndex, event.currentIndex);
    this.announce(this.store.toast() ?? 'Gruppe neu angeordnet.');
  }

  protected dropShortcut(event: CdkDragDrop<HubGroup>): void {
    if (!this.store.editMode()) return;
    const source = event.previousContainer.data;
    const target = event.container.data;
    if (source.id === target.id) {
      if (event.previousIndex === event.currentIndex) return;
      this.store.reorderShortcuts(target.id, event.previousIndex, event.currentIndex);
    } else {
      this.store.moveShortcutToGroup(source.id, target.id, event.previousIndex, event.currentIndex);
    }
    this.announce(this.store.toast() ?? 'Verknüpfung neu angeordnet.');
  }

  protected keyboardMoveGroup(groupId: string, event: KeyboardEvent): void {
    if (
      !this.store.editMode() ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    event.preventDefault();
    const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
    this.store.moveGroupByKeyboard(groupId, direction);
    this.announce(this.store.toast() ?? 'Gruppe neu angeordnet.');
  }

  protected keyboardMoveShortcut(groupId: string, shortcutId: string, event: KeyboardEvent): void {
    if (!this.store.editMode() || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    this.store.moveShortcutByKeyboard(groupId, shortcutId, event.key === 'ArrowLeft' ? -1 : 1);
    this.announce(this.store.toast() ?? 'Verknüpfung neu angeordnet.');
  }

  protected exportConfig(): void {
    const envelope: ExportEnvelope = {
      format: 'media-hub-config',
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      config: this.store.config(),
    };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = this.document.createElement('a');
    anchor.href = url;
    anchor.download = `media-hub-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.store.notify('Konfiguration wurde exportiert.');
  }

  protected chooseImport(): void {
    this.importInput?.nativeElement.click();
  }

  protected async importConfig(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) {
      this.importError.set('Die Importdatei darf höchstens 1 MB groß sein.');
      return;
    }
    try {
      const parsed = parseExport(JSON.parse(await file.text()));
      if (
        !window.confirm(
          `Die aktuelle Konfiguration durch ${parsed.config.groups.length} importierte Gruppen ersetzen?`,
        )
      )
        return;
      this.store.importConfig(parsed.config);
      this.openSettings();
    } catch {
      this.importError.set(
        'Die Datei ist keine gültige Media-Hub-Konfiguration. Es wurde nichts verändert.',
      );
    }
  }

  protected resetHub(): void {
    if (!window.confirm('Media Hub wirklich auf die Startkonfiguration zurücksetzen?')) return;
    this.store.reset();
    this.openSettings();
  }

  @HostListener('document:keydown', ['$event'])
  protected handleGlobalKeyboard(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
    const isSearchFocused = target === this.searchInput?.nativeElement;
    // Escape should close either an open panel or the keyboard help overlay
    if (event.key === 'Escape' && (this.panel() || this.showKeyboardHelp())) {
      event.preventDefault();
      if (this.panel()) this.closePanel();
      if (this.showKeyboardHelp()) this.closeKeyboardHelp();
      return;
    }

    // If user is typing in an input other than the search box, or a panel/help is open,
    // do not handle global shortcuts. Allow navigation when the search input is focused.
    if ((isTyping && !isSearchFocused) || this.panel() || this.showKeyboardHelp()) return;

    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
      return;
    }

    // '?' opens the keyboard help overlay (Shift+/ produces '?')
    if (event.key === '?') {
      event.preventDefault();
      this.openKeyboardHelp();
      return;
    }

    // 'E' should not trigger while typing into the search input
    if (event.key.toLowerCase() === 'e' && !isSearchFocused) {
      event.preventDefault();
      this.store.toggleEditMode();
      return;
    }

    // Activate focused element with Enter or Space
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      const active = document.activeElement as HTMLElement | null;
      if (active?.matches && active.matches('[data-focusable]:not([disabled])')) {
        event.preventDefault();
        // Use click to trigger the element's action. For buttons this is native.
        (active as HTMLElement).click();
        return;
      }
    }

    // Arrow-key spatial navigation. If nothing focused or focused element is not in the
    // focusable set, move focus to the first focusable candidate.
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const candidates = Array.from(
        this.document.querySelectorAll<HTMLElement>('[data-focusable]:not([disabled])'),
      ).filter((el) => el.offsetParent !== null);
      const active = document.activeElement as HTMLElement | null;
      if (!active || !candidates.includes(active)) {
        if (candidates[0]) {
          event.preventDefault();
          candidates[0].focus();
        }
        return;
      }
      this.spatialNavigate(event);
    }
  }

  private lastTrigger: HTMLElement | null = null;

  private rememberTrigger(event?: Event): void {
    this.lastTrigger =
      event?.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : (this.document.activeElement as HTMLElement | null);
  }

  protected openKeyboardHelp(): void {
    this.showKeyboardHelp.set(true);
  }

  protected closeKeyboardHelp(): void {
    this.showKeyboardHelp.set(false);
  }

  protected toggleKeyboardHelp(): void {
    this.showKeyboardHelp.set(!this.showKeyboardHelp());
  }

  private activeForm() {
    if (this.panel() === 'shortcut') return this.shortcutForm;
    if (this.panel() === 'group') return this.groupForm;
    if (this.panel() === 'settings') return this.settingsForm;
    return null;
  }

  private formIcon(presetId: string, custom: string): IconConfig {
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

  private normalizeShortcutUrl(value: string): string | null {
    return this.resolver.normalizeHttpUrl(value);
  }

  private navigate(url: string, behavior: 'same-tab' | 'new-tab'): void {
    if (behavior === 'new-tab') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.assign(url);
    }
  }

  private announce(message: string): void {
    this.liveMessage.set('');
    window.setTimeout(() => this.liveMessage.set(message), 20);
  }

  private spatialNavigate(event: KeyboardEvent): void {
    const current = this.document.activeElement as HTMLElement | null;
    const candidates = Array.from(
      this.document.querySelectorAll<HTMLElement>('[data-focusable]:not([disabled])'),
    ).filter((element) => element.offsetParent !== null);
    if (!current || !candidates.includes(current)) return;
    const origin = current.getBoundingClientRect();
    const ox = origin.left + origin.width / 2;
    const oy = origin.top + origin.height / 2;
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const positive = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const ranked = candidates
      .filter((element) => element !== current)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - ox;
        const dy = rect.top + rect.height / 2 - oy;
        const primary = horizontal ? dx : dy;
        const secondary = horizontal ? Math.abs(dy) : Math.abs(dx);
        return { element, primary, score: Math.abs(primary) + secondary * 2.2 };
      })
      .filter((item) => (positive ? item.primary > 4 : item.primary < -4))
      .sort((a, b) => a.score - b.score);
    if (ranked[0]) {
      event.preventDefault();
      ranked[0].element.focus();
    }
  }
}
