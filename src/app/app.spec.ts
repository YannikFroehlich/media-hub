import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { MediaHubStore } from './core/media-hub.store';

function mediaQueryList(media: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  } as MediaQueryList;
}

function mockPointerRects(card: HTMLElement, group: HTMLElement): void {
  Object.defineProperty(group, 'getBoundingClientRect', {
    value: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 200,
      width: 400,
      height: 200,
      toJSON: () => ({}),
    }),
  });
  Object.defineProperty(card, 'getBoundingClientRect', {
    value: () => ({
      x: 10,
      y: 20,
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    }),
  });
}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(undefined));
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('shows the screensaver after the idle period and hides it again on activity', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    vi.advanceTimersByTime(5 * 60 * 1000);
    fixture.detectChanges();
    expect(compiled.querySelector('.screensaver')).toBeTruthy();

    document.dispatchEvent(new MouseEvent('mousemove'));
    fixture.detectChanges();
    expect(compiled.querySelector('.screensaver')).toBeFalsy();
  });

  it('never shows the screensaver when disabled in settings', () => {
    vi.useFakeTimers();
    const store = TestBed.inject(MediaHubStore);
    store.updateSettings({ ...store.settings(), screensaverEnabled: false });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    vi.advanceTimersByTime(5 * 60 * 1000);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.screensaver')).toBeFalsy();
  });

  it('should render the Media Hub dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-copy strong')?.textContent).toContain('Media Hub');
    expect(compiled.querySelectorAll('.group-card').length).toBe(4);
  });

  it('filters shortcuts to matches as the search query changes', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector<HTMLInputElement>('.search input')!;

    input.value = 'youtube';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const cards = compiled.querySelectorAll('.shortcut-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('YouTube');
    expect(compiled.querySelectorAll('.group-card')).toHaveLength(1);
  });

  it('shows a group in full when the group name itself matches the query', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector<HTMLInputElement>('.search input')!;

    input.value = 'streaming';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.group-card')).toHaveLength(1);
    expect(compiled.querySelectorAll('.shortcut-card')).toHaveLength(4);
  });

  it('shows a no-results state when the query matches nothing', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector<HTMLInputElement>('.search input')!;

    input.value = 'asdkjhasd';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.group-card')).toHaveLength(0);
    expect(compiled.querySelector('.empty-dashboard h1')?.textContent).toContain('Keine Treffer');
  });

  it('ignores the search filter while edit mode is active', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const input = compiled.querySelector<HTMLInputElement>('.search input')!;

    input.value = 'youtube';
    input.dispatchEvent(new Event('input'));
    TestBed.inject(MediaHubStore).toggleEditMode();
    fixture.detectChanges();

    expect(compiled.querySelectorAll('.group-card')).toHaveLength(4);
  });

  it('marks only the unreachable shortcut as broken while in edit mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        String(url).includes('youtube.com')
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(undefined),
      ),
    );
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    TestBed.inject(MediaHubStore).toggleEditMode();
    fixture.detectChanges();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.link-broken-badge')).toBeTruthy();
    });

    const cards = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.shortcut-card'),
    );
    const youtubeCard = cards.find((card) => card.textContent?.includes('YouTube'));
    const browserCard = cards.find((card) => card.textContent?.includes('Browser'));
    expect(youtubeCard?.classList.contains('link-broken')).toBe(true);
    expect(browserCard?.classList.contains('link-broken')).toBe(false);
  });

  it('should focus the search input when the visible search field is clicked', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const search = compiled.querySelector<HTMLFormElement>('.search');
    const input = compiled.querySelector<HTMLInputElement>('.search input');

    search?.click();

    expect(document.activeElement).toBe(input);
  });

  it('should place settings beside the theme toggle and open the settings panel', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    const themeToggle = compiled.querySelector('.theme-toggle');
    const settingsToggle = compiled.querySelector<HTMLButtonElement>('.settings-toggle');

    expect(themeToggle?.nextElementSibling).toBe(settingsToggle);
    settingsToggle?.click();
    fixture.detectChanges();

    expect(compiled.querySelector('aside')?.getAttribute('aria-label')).toBe('Media Hub anpassen');
    expect(compiled.querySelector('.customize-button')).toBeNull();
  });

  it('should save and apply the liquid glass visual style', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.settings-toggle')?.click();
    fixture.detectChanges();

    const styleButtons = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('.style-cards > button'),
    );
    styleButtons.find((button) => button.textContent?.includes('Liquid Glass'))?.click();
    fixture.detectChanges();

    const groupBlur = compiled.querySelector<HTMLInputElement>(
      'input[formControlName="liquidGlassGroupBlur"]',
    );
    const shortcutBlur = compiled.querySelector<HTMLInputElement>(
      'input[formControlName="liquidGlassShortcutBlur"]',
    );
    if (groupBlur) groupBlur.value = '8';
    groupBlur?.dispatchEvent(new Event('input', { bubbles: true }));
    if (shortcutBlur) shortcutBlur.value = '4';
    shortcutBlur?.dispatchEvent(new Event('input', { bubbles: true }));
    compiled.querySelector<HTMLButtonElement>('.settings-form button[type="submit"]')?.click();
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-style')).toBe('liquid-glass');
    const savedSettings = JSON.parse(localStorage.getItem('media-hub.config') ?? '{}').settings;
    expect(savedSettings.visualStyle).toBe('liquid-glass');
    expect(savedSettings.liquidGlassGroupBlur).toBe(8);
    expect(savedSettings.liquidGlassShortcutBlur).toBe(4);
    expect(document.documentElement.style.getPropertyValue('--liquid-group-blur-filter')).toBe(
      'blur(8px)',
    );
    expect(document.documentElement.style.getPropertyValue('--liquid-shortcut-blur-filter')).toBe(
      'blur(4px)',
    );
    expect(compiled.querySelectorAll('.shortcut-card > [appLiquidGlass]')).toHaveLength(0);
    expect(compiled.querySelectorAll('.group-card > [appLiquidGlass]')).toHaveLength(0);
    expect(compiled.querySelectorAll('.topbar > [appLiquidGlass]')).toHaveLength(1);

    const card = compiled.querySelector('.shortcut-card') as HTMLElement;
    const group = card.closest('.group-card') as HTMLElement;
    mockPointerRects(card, group);
    card.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 95 }));

    expect(card.style.getPropertyValue('--glow-x')).toBe('');
    expect(card.style.getPropertyValue('--tilt-x')).toBe('');
    expect(group.style.getPropertyValue('--group-glow-x')).toBe('');
  });

  it('should save and apply the minimalist visual style without pointer effects', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.settings-toggle')?.click();
    fixture.detectChanges();

    const styleButtons = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('.style-cards > button'),
    );
    styleButtons.find((button) => button.textContent?.includes('Minimalistisch'))?.click();
    compiled.querySelector<HTMLButtonElement>('.settings-form button[type="submit"]')?.click();
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-style')).toBe('minimalist');
    const savedSettings = JSON.parse(localStorage.getItem('media-hub.config') ?? '{}').settings;
    expect(savedSettings.visualStyle).toBe('minimalist');

    const card = compiled.querySelector('.shortcut-card') as HTMLElement;
    const group = card.closest('.group-card') as HTMLElement;
    mockPointerRects(card, group);
    card.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 95 }));

    expect(card.style.getPropertyValue('--glow-x')).toBe('');
    expect(card.style.getPropertyValue('--tilt-x')).toBe('');
    expect(group.style.getPropertyValue('--group-glow-x')).toBe('');
  });

  it('should save and apply a custom liquid glass background image', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelector<HTMLButtonElement>('.settings-toggle')?.click();
    fixture.detectChanges();

    const styleButtons = Array.from(
      compiled.querySelectorAll<HTMLButtonElement>('.style-cards > button'),
    );
    styleButtons.find((button) => button.textContent?.includes('Liquid Glass'))?.click();
    fixture.detectChanges();

    const input = compiled.querySelector<HTMLInputElement>('.liquid-background-input');
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'background.png', {
      type: 'image/png',
    });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input?.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(compiled.querySelector('.background-preview')?.getAttribute('style')).toContain(
        'data:image/png;base64',
      );
    });

    compiled.querySelector<HTMLButtonElement>('.settings-form button[type="submit"]')?.click();
    await fixture.whenStable();

    const saved = JSON.parse(localStorage.getItem('media-hub.config') ?? '{}');
    expect(saved.settings.liquidGlassBackgroundImage).toMatch(/^data:image\/png;base64,/);
    expect(document.documentElement.getAttribute('data-liquid-background')).toBe('custom');
    expect(document.documentElement.style.getPropertyValue('--liquid-background-image')).toContain(
      'data:image/png;base64',
    );
  });

  it('should move the shortcut and group glows together with the pointer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('.shortcut-card') as HTMLElement;
    const group = card.closest('.group-card') as HTMLElement;
    mockPointerRects(card, group);

    card.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 95 }));

    expect(card.style.getPropertyValue('--glow-x')).toBe('25.0%');
    expect(card.style.getPropertyValue('--glow-y')).toBe('75.0%');
    expect(group.style.getPropertyValue('--group-glow-x')).toBe('15.0%');
    expect(group.style.getPropertyValue('--group-glow-y')).toBe('47.5%');
  });

  it('should keep the pointer glow when reduced motion is preferred', async () => {
    vi.stubGlobal('matchMedia', (query: string) =>
      mediaQueryList(query, query === '(prefers-reduced-motion: reduce)'),
    );
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('.shortcut-card') as HTMLElement;
    const group = card.closest('.group-card') as HTMLElement;
    mockPointerRects(card, group);

    card.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 95 }));

    expect(card.style.getPropertyValue('--glow-x')).toBe('25.0%');
    expect(card.style.getPropertyValue('--glow-y')).toBe('75.0%');
    expect(group.style.getPropertyValue('--group-glow-x')).toBe('15.0%');
    expect(group.style.getPropertyValue('--group-glow-y')).toBe('47.5%');
  });

  it('should keep mouse pointer effects on a hybrid touch laptop', async () => {
    vi.stubGlobal('matchMedia', (query: string) =>
      mediaQueryList(query, query === '(hover: none), (pointer: coarse)'),
    );
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('.shortcut-card') as HTMLElement;
    const group = card.closest('.group-card') as HTMLElement;
    mockPointerRects(card, group);

    card.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 95 }));

    expect(card.style.getPropertyValue('--glow-x')).toBe('25.0%');
    expect(group.style.getPropertyValue('--group-glow-x')).toBe('15.0%');
  });
});
