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
  effect,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ConfirmService } from './core/confirm.service';
import { startGamepadNavigation } from './core/gamepad';
import { handleWebsiteIconError, handleWebsiteIconLoad, iconClass } from './core/icons';
import { MediaHubStore } from './core/media-hub.store';
import { HubGroup, Shortcut, WeatherSnapshot } from './core/models';
import { UrlResolver } from './core/url-resolver';
import { WeatherService } from './core/weather.service';
import { WebsiteIconResolver } from './core/website-icon-resolver';
import { LiquidGlassDirective } from './liquid-glass.directive';
import { GroupPanel } from './panels/group-panel';
import { SettingsPanel } from './panels/settings-panel';
import { ShortcutPanel } from './panels/shortcut-panel';
import { Screensaver } from './screensaver/screensaver';

type PanelKind = 'shortcut' | 'group' | 'settings' | null;

const SCREENSAVER_IDLE_MS = 5 * 60 * 1000;
const LINK_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LINK_CHECK_TIMEOUT_MS = 6000;

@Component({
  selector: 'app-root',
  imports: [
    LiquidGlassDirective,
    CdkDropList,
    CdkDropListGroup,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkTrapFocus,
    ShortcutPanel,
    GroupPanel,
    SettingsPanel,
    Screensaver,
  ],
  templateUrl: './app.html',
  // Pointer/focus effects and forms-free imperative state predate signals everywhere here.
  // eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  protected readonly store = inject(MediaHubStore);
  private readonly resolver = inject(UrlResolver);
  private readonly websiteIconResolver = inject(WebsiteIconResolver);
  private readonly weatherService = inject(WeatherService);
  protected readonly confirm = inject(ConfirmService);
  private readonly document = inject(DOCUMENT);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  private readonly shortcutPanel = viewChild(ShortcutPanel);
  private readonly groupPanel = viewChild(GroupPanel);
  private readonly settingsPanel = viewChild(SettingsPanel);

  protected readonly panel = signal<PanelKind>(null);
  protected readonly selectedGroupId = signal<string | null>(null);
  protected readonly selectedShortcutId = signal<string | null>(null);
  protected readonly liveMessage = signal('');
  protected readonly cursorIdle = signal(false);
  protected readonly showKeyboardHelp = signal(false);
  protected readonly screensaverActive = signal(false);
  protected readonly weatherDetailsOpen = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly visibleGroups = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query || this.store.editMode()) return this.store.groups();
    return this.store
      .groups()
      .map((group) => {
        const groupMatches = group.name.toLowerCase().includes(query);
        const shortcuts = groupMatches
          ? group.shortcuts
          : group.shortcuts.filter((shortcut) => shortcut.name.toLowerCase().includes(query));
        return { ...group, shortcuts };
      })
      .filter((group) => group.shortcuts.length > 0);
  });
  /** Shortcuts in on-screen order, as reachable via the 1-9 keys. */
  private readonly numberedShortcuts = computed(() =>
    this.visibleGroups()
      .flatMap((group) =>
        group.shortcuts
          .filter((shortcut) => shortcut.enabled)
          .map((shortcut) => ({ group, shortcut })),
      )
      .slice(0, 9),
  );
  protected readonly weather = signal<WeatherSnapshot | null>(null);
  protected readonly headerWeather = computed(() =>
    this.store.settings().weatherEnabled ? this.weather() : null,
  );
  /** Shortcut IDs whose URL failed the last reachability check. Only populated in edit mode. */
  protected readonly brokenLinks = signal<ReadonlySet<string>>(new Set());
  /** Favicon proxy URL -> locally cached object URL, once resolved (see resolveWebsiteIcons). */
  private readonly cachedIconUrls = signal<ReadonlyMap<string, string>>(new Map());
  private readonly resolvingIcons = new Set<string>();
  protected readonly clockLabel = computed(() =>
    new Date(this.store.clockTick()).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  );
  protected readonly focusGlider = signal<{
    x: number;
    y: number;
    w: number;
    h: number;
    visible: boolean;
  }>({ x: 0, y: 0, w: 0, h: 0, visible: false });
  protected readonly focusGliderTransform = computed(
    () => `translate(${this.focusGlider().x}px, ${this.focusGlider().y}px)`,
  );
  protected readonly panelTitle = computed(() => {
    if (this.panel() === 'shortcut') {
      return this.selectedShortcutId() ? 'Verknüpfung bearbeiten' : 'Verknüpfung hinzufügen';
    }
    if (this.panel() === 'group') {
      return this.selectedGroupId() ? 'Gruppe bearbeiten' : 'Gruppe erstellen';
    }
    return 'Media Hub anpassen';
  });

  constructor() {
    this.armCursorIdleTimer();
    this.refreshWeather();
    this.refreshSunTimes();
    window.setInterval(() => this.refreshWeather(), 30 * 60 * 1000);
    window.setInterval(() => this.refreshSunTimes(), 30 * 60 * 1000);
    effect(() => (this.store.editMode() ? this.armLinkCheck() : this.disarmLinkCheck()));
    effect(() => this.resolveWebsiteIcons());
    startGamepadNavigation(this.document);
  }

  // Independent of the weather widget: auto-theme needs sunrise/sunset even if
  // "Wetter in der Kopfzeile anzeigen" is off, as long as a location is set.
  private async refreshSunTimes(): Promise<void> {
    const settings = this.store.settings();
    if (!settings.autoTheme || settings.weatherLat === null || settings.weatherLon === null) {
      this.store.setSunTimes(null);
      return;
    }
    this.store.setSunTimes(
      await this.weatherService.getSunTimes(settings.weatherLat, settings.weatherLon),
    );
  }

  private async refreshWeather(): Promise<void> {
    const settings = this.store.settings();
    if (
      (!settings.weatherEnabled && !settings.screensaverEnabled) ||
      settings.weatherLat === null ||
      settings.weatherLon === null
    ) {
      this.weather.set(null);
      return;
    }
    this.weather.set(
      await this.weatherService.getForecast(settings.weatherLat, settings.weatherLon),
    );
  }

  protected readonly iconClass = iconClass;
  protected readonly handleWebsiteIconLoad = handleWebsiteIconLoad;
  protected readonly handleWebsiteIconError = handleWebsiteIconError;

  /** Website favicon URL, preferring the locally cached copy once one has resolved. */
  protected dashboardIconUrl(shortcutUrl: string): string | null {
    const remote = this.websiteIconResolver.resolve(shortcutUrl);
    return remote ? (this.cachedIconUrls().get(remote) ?? remote) : null;
  }

  protected openShortcutPanel(groupId?: string, shortcut?: Shortcut, event?: Event): void {
    event?.stopPropagation();
    this.rememberTrigger(event);
    this.selectedGroupId.set(groupId ?? this.store.groups()[0]?.id ?? null);
    this.selectedShortcutId.set(shortcut?.id ?? null);
    this.panel.set('shortcut');
  }

  protected openGroupPanel(group?: HubGroup, event?: Event): void {
    event?.stopPropagation();
    this.rememberTrigger(event);
    this.selectedGroupId.set(group?.id ?? null);
    this.selectedShortcutId.set(null);
    this.panel.set('group');
  }

  protected openSettings(event?: Event): void {
    this.rememberTrigger(event);
    this.panel.set('settings');
  }

  protected async closePanel(force = false): Promise<void> {
    if (
      !force &&
      this.activeForm()?.dirty &&
      !(await this.confirm.request('Ungespeicherte Änderungen verwerfen?', 'Verwerfen'))
    )
      return;
    this.panel.set(null);
    window.setTimeout(() => this.lastTrigger?.focus());
  }

  protected async deleteGroup(groupId: string | null): Promise<boolean> {
    const group = this.store.groups().find((item) => item.id === groupId);
    if (!group) return false;
    const count = group.shortcuts.length;
    const detail = count
      ? ` Dabei werden auch ${count} Verknüpfung${count === 1 ? '' : 'en'} entfernt.`
      : '';
    if (
      !(await this.confirm.request(`Gruppe „${group.name}“ wirklich löschen?${detail}`, 'Löschen'))
    )
      return false;
    this.store.deleteGroup(group.id);
    return true;
  }

  protected async deleteGroupFromPanel(): Promise<void> {
    if (await this.deleteGroup(this.selectedGroupId())) this.closePanel(true);
  }

  /** Settings were saved, imported, reset or switched to another profile. */
  protected refreshAfterSettingsChange(): void {
    this.refreshVisualEffects();
    this.refreshWeather();
    this.refreshSunTimes();
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

  @HostListener('document:keydown', ['$event'])
  protected handleGlobalKeyboard(event: KeyboardEvent): void {
    if (this.confirm.state()) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.confirm.resolve(false);
      }
      return;
    }
    if (this.screensaverActive()) {
      event.preventDefault();
      this.armCursorIdleTimer();
      return;
    }
    // Keyboard/gamepad use counts as activity too, but must not reveal the hidden cursor.
    this.armScreensaverTimer();
    const target = event.target as HTMLElement | null;
    const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]');
    const isSearchFocused = target === this.searchInput?.nativeElement;
    // Escape should close either an open panel, the keyboard help overlay, or the weather popover
    if (
      event.key === 'Escape' &&
      (this.panel() || this.showKeyboardHelp() || this.weatherDetailsOpen())
    ) {
      event.preventDefault();
      if (this.panel()) this.closePanel();
      if (this.showKeyboardHelp()) this.closeKeyboardHelp();
      if (this.weatherDetailsOpen()) this.weatherDetailsOpen.set(false);
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

    // 1-9 open the n-th visible shortcut. Not while typing a search query or editing.
    if (/^[1-9]$/.test(event.key) && !isSearchFocused && !this.store.editMode()) {
      const target = this.numberedShortcuts()[Number(event.key) - 1];
      if (target) {
        event.preventDefault();
        this.activateShortcut(target.group, target.shortcut, event);
      }
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

  @HostListener('document:mousemove', ['$event'])
  protected handlePointerActivity(event: MouseEvent): void {
    this.armCursorIdleTimer();
    this.updatePointerEffects(event);
  }

  @HostListener('document:click', ['$event'])
  protected handleGlobalClick(event: MouseEvent): void {
    if (!this.weatherDetailsOpen()) return;
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.weather-widget')) this.weatherDetailsOpen.set(false);
  }

  protected toggleWeatherDetails(): void {
    this.weatherDetailsOpen.update((value) => !value);
  }

  @HostListener('document:focusin', ['$event'])
  protected handleFocusIn(event: FocusEvent): void {
    this.updateFocusGlider(event.target as HTMLElement | null);
  }

  @HostListener('window:resize')
  protected handleWindowResize(): void {
    if (this.focusGlider().visible) {
      this.updateFocusGlider(this.document.activeElement as HTMLElement | null);
    }
  }

  protected handleDashboardScroll(): void {
    // The fixed glow must not remain at a tile's old position after scrolling.
    this.focusGlider.update((state) => ({ ...state, visible: false }));
  }

  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private screensaverTimer: ReturnType<typeof setTimeout> | null = null;

  protected armCursorIdleTimer(): void {
    this.cursorIdle.set(false);
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    if (this.store.settings().visualStyle === 'minimalist') {
      this.idleTimer = null;
    } else {
      this.idleTimer = window.setTimeout(() => this.cursorIdle.set(true), 3000);
    }
    this.armScreensaverTimer();
  }

  private armScreensaverTimer(): void {
    this.screensaverActive.set(false);
    if (this.screensaverTimer !== null) window.clearTimeout(this.screensaverTimer);
    if (!this.store.settings().screensaverEnabled) {
      this.screensaverTimer = null;
      return;
    }
    this.screensaverTimer = window.setTimeout(
      () => this.screensaverActive.set(true),
      SCREENSAVER_IDLE_MS,
    );
  }

  private linkCheckTimer: ReturnType<typeof setInterval> | null = null;

  private armLinkCheck(): void {
    if (this.linkCheckTimer !== null) return;
    this.checkLinks();
    this.linkCheckTimer = window.setInterval(() => this.checkLinks(), LINK_CHECK_INTERVAL_MS);
  }

  private disarmLinkCheck(): void {
    if (this.linkCheckTimer !== null) window.clearInterval(this.linkCheckTimer);
    this.linkCheckTimer = null;
    this.brokenLinks.set(new Set());
  }

  private async checkLinks(): Promise<void> {
    const shortcuts = this.store.groups().flatMap((group) => group.shortcuts);
    const broken = await Promise.all(
      shortcuts.map(async (shortcut) => {
        const url = this.resolver.safeHttpUrl(shortcut.url);
        if (url && (await this.isReachable(url))) return null;
        return url ? shortcut.id : null;
      }),
    );
    this.brokenLinks.set(new Set(broken.filter((id): id is string => id !== null)));
  }

  // A cross-origin HEAD request only yields an opaque response (no readable status), so this
  // can only detect network-level failures (DNS, connection refused, timeout) — not a real 404.
  private async isReachable(url: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), LINK_CHECK_TIMEOUT_MS);
    try {
      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private resolveWebsiteIcons(): void {
    const remoteUrls = this.store
      .groups()
      .flatMap((group) => group.shortcuts)
      .filter((shortcut) => shortcut.icon.kind === 'website')
      .map((shortcut) => this.websiteIconResolver.resolve(shortcut.url))
      .filter((url): url is string => url !== null);

    for (const remoteUrl of new Set(remoteUrls)) {
      if (this.resolvingIcons.has(remoteUrl) || this.cachedIconUrls().has(remoteUrl)) continue;
      this.resolvingIcons.add(remoteUrl);
      this.websiteIconResolver.getCachedIconUrl(remoteUrl).then((cachedUrl) => {
        this.cachedIconUrls.update((map) => new Map(map).set(remoteUrl, cachedUrl));
      });
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
    return (this.shortcutPanel() ?? this.groupPanel() ?? this.settingsPanel())?.form ?? null;
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

  private groupGlowTarget: HTMLElement | null = null;
  private tiltTarget: HTMLElement | null = null;
  private pendingTilt: { target: HTMLElement; px: number; py: number } | null = null;
  private tiltRafId: number | null = null;

  // Both glow layers follow the same pointer event. This keeps the larger group
  // wash alive beneath shortcuts, so moving between both surfaces feels seamless.
  private updatePointerEffects(event: MouseEvent): void {
    const settings = this.store.settings();
    if (settings.visualStyle !== 'classic' || !settings.classicPointerEffects) {
      this.resetPointerEffects();
      return;
    }

    const eventTarget = event.target as HTMLElement | null;
    const groupTarget = eventTarget?.closest?.(
      '.group-card:not(.cdk-drag-preview)',
    ) as HTMLElement | null;
    if (groupTarget !== this.groupGlowTarget) {
      this.resetGroupGlow(this.groupGlowTarget);
      this.groupGlowTarget = groupTarget;
    }
    if (groupTarget) {
      this.updateGlowPosition(groupTarget, event, '--group-glow-x', '--group-glow-y');
    }

    const target = eventTarget?.closest?.(
      '.shortcut-card:not(.cdk-drag-preview)',
    ) as HTMLElement | null;
    if (target !== this.tiltTarget) {
      this.resetTilt(this.tiltTarget);
      this.tiltTarget = target;
    }
    if (!target) {
      this.pendingTilt = null;
      return;
    }

    const position = this.updateGlowPosition(target, event, '--glow-x', '--glow-y');
    if (!position) return;
    const { px, py } = position;
    this.pendingTilt = { target, px, py };

    if (this.tiltRafId !== null) return;
    this.tiltRafId = requestAnimationFrame(() => {
      this.tiltRafId = null;
      this.applyTilt();
    });
  }

  private applyTilt(): void {
    const pending = this.pendingTilt;
    if (!pending || pending.target !== this.tiltTarget) return;
    pending.target.style.setProperty('--tilt-x', `${((0.5 - pending.py) * 14).toFixed(2)}deg`);
    pending.target.style.setProperty('--tilt-y', `${((pending.px - 0.5) * 14).toFixed(2)}deg`);
  }

  private updateGlowPosition(
    element: HTMLElement,
    event: MouseEvent,
    xProperty: string,
    yProperty: string,
  ): { px: number; py: number } | null {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    element.style.setProperty(xProperty, `${(px * 100).toFixed(1)}%`);
    element.style.setProperty(yProperty, `${(py * 100).toFixed(1)}%`);
    return { px, py };
  }

  private resetGroupGlow(element: HTMLElement | null): void {
    element?.style.removeProperty('--group-glow-x');
    element?.style.removeProperty('--group-glow-y');
  }

  private resetPointerEffects(): void {
    if (this.tiltRafId !== null) {
      cancelAnimationFrame(this.tiltRafId);
      this.tiltRafId = null;
    }
    this.resetGroupGlow(this.groupGlowTarget);
    this.resetTilt(this.tiltTarget);
    this.groupGlowTarget = null;
    this.tiltTarget = null;
    this.pendingTilt = null;
  }

  private refreshVisualEffects(): void {
    this.armCursorIdleTimer();
    const settings = this.store.settings();
    if (settings.visualStyle !== 'classic' || !settings.classicPointerEffects) {
      this.resetPointerEffects();
    }
    this.updateFocusGlider(this.document.activeElement as HTMLElement | null);
  }

  private resetTilt(element: HTMLElement | null): void {
    element?.style.removeProperty('--tilt-x');
    element?.style.removeProperty('--tilt-y');
    element?.style.removeProperty('--glow-x');
    element?.style.removeProperty('--glow-y');
  }

  private updateFocusGlider(target: HTMLElement | null): void {
    // The search pill already has its own deliberate, understated focus treatment
    // (see `.search input:focus-visible` / `.search:focus-within` in styles.scss) —
    // the glider's glow would just re-add the thick ring that styling exists to avoid.
    if (
      this.store.settings().visualStyle === 'minimalist' ||
      !target?.matches?.('[data-focusable]') ||
      target.closest('.search')
    ) {
      this.focusGlider.update((state) => ({ ...state, visible: false }));
      return;
    }
    const rect = target.getBoundingClientRect();
    const pad = 4;
    this.focusGlider.set({
      x: rect.left - pad,
      y: rect.top - pad,
      w: rect.width + pad * 2,
      h: rect.height + pad * 2,
      visible: true,
    });
  }
}
