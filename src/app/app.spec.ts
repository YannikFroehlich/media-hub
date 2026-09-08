import { TestBed } from '@angular/core/testing';
import { App } from './app';

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
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the Media Hub dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-copy strong')?.textContent).toContain('Media Hub');
    expect(compiled.querySelectorAll('.group-card').length).toBe(4);
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
    compiled.querySelector<HTMLButtonElement>('.settings-form button[type="submit"]')?.click();
    await fixture.whenStable();

    expect(document.documentElement.getAttribute('data-style')).toBe('liquid-glass');
    expect(JSON.parse(localStorage.getItem('media-hub.config') ?? '{}').settings.visualStyle).toBe(
      'liquid-glass',
    );

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
