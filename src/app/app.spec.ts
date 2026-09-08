import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

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

  it('should move the shortcut and group glows together with the pointer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('.shortcut-card') as HTMLElement;
    const group = card.closest('.group-card') as HTMLElement;
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

    card.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 95 }));

    expect(card.style.getPropertyValue('--glow-x')).toBe('25.0%');
    expect(card.style.getPropertyValue('--glow-y')).toBe('75.0%');
    expect(group.style.getPropertyValue('--group-glow-x')).toBe('15.0%');
    expect(group.style.getPropertyValue('--group-glow-y')).toBe('47.5%');
  });
});
