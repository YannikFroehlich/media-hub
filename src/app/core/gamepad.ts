// Standard-mapping button indices (https://w3c.github.io/gamepad/#remapping).
const BUTTON_KEYS: Record<number, string> = {
  0: 'Enter', // A / Cross
  1: 'Escape', // B / Circle
  12: 'ArrowUp',
  13: 'ArrowDown',
  14: 'ArrowLeft',
  15: 'ArrowRight',
};
const STICK_THRESHOLD = 0.5;
const REPEAT_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 150;

/** Keys currently "held" on a gamepad, expressed as the keyboard keys App already handles. */
export function pressedKeys(pad: Gamepad): string[] {
  const keys = Object.entries(BUTTON_KEYS)
    .filter(([index]) => pad.buttons[Number(index)]?.pressed)
    .map(([, key]) => key);
  const [x = 0, y = 0] = pad.axes;
  if (x < -STICK_THRESHOLD) keys.push('ArrowLeft');
  if (x > STICK_THRESHOLD) keys.push('ArrowRight');
  if (y < -STICK_THRESHOLD) keys.push('ArrowUp');
  if (y > STICK_THRESHOLD) keys.push('ArrowDown');
  return [...new Set(keys)];
}

// Tab-order candidates inside a modal. File inputs are skipped: each has a visible trigger button.
const DIALOG_FOCUSABLE =
  'a[href], button, input:not([type="hidden"]):not([type="file"]), select, textarea, [tabindex]';

/**
 * Moves focus to the next/previous control of the modal dialog `from` sits in (side panel,
 * confirm dialog, keyboard help), wrapping at the ends. Without an open modal it does nothing,
 * so the dashboard keeps App's spatial navigation.
 */
// ponytail: linear order, not spatial; selects/ranges can't change value via the pad (use a
// keyboard for editing).
export function moveFocusInDialog(from: HTMLElement, step: 1 | -1): void {
  // Focus can end up outside an open modal (e.g. after a mouse click); pull it into the topmost.
  const dialog =
    from.closest<HTMLElement>('[aria-modal="true"]') ??
    Array.from(from.ownerDocument.querySelectorAll<HTMLElement>('[aria-modal="true"]')).at(-1);
  if (!dialog) return;
  const items = Array.from(dialog.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE)).filter(
    (item) => !item.matches(':disabled, [tabindex="-1"]'),
  );
  if (!items.length) return;
  const index = items.indexOf(from);
  const next =
    index < 0 ? (step > 0 ? 0 : items.length - 1) : (index + step + items.length) % items.length;
  items[next].focus({ focusVisible: true });
}

/**
 * Replays gamepad input as synthetic keydown events on the focused element, so the existing
 * keyboard handling (spatial navigation, Enter, Escape, screensaver wake-up) drives the gamepad
 * too. Polling only runs while a pad is connected.
 */
export function startGamepadNavigation(document: Document): void {
  if (typeof navigator.getGamepads !== 'function') return;
  const nextFireAt = new Map<string, number>();
  let frame: number | null = null;
  // Script-driven focus doesn't count as :focus-visible, so styles key the focus ring off this
  // attribute instead. Any real keyboard or pointer input ends gamepad mode again.
  const root = document.documentElement;
  const leaveGamepadMode = (event: Event) => {
    if (event.isTrusted) delete root.dataset['input'];
  };
  document.addEventListener('keydown', leaveGamepadMode, true);
  document.addEventListener('pointerdown', leaveGamepadMode, true);

  const press = (key: string) => {
    root.dataset['input'] = 'gamepad';
    const target = (document.activeElement as HTMLElement | null) ?? document.body;
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    // Synthetic key events have no default action, so "A" has to click by itself whenever
    // App didn't already handle it (e.g. buttons inside a side panel).
    if (key === 'Enter' && !event.defaultPrevented) target.click();
    // App ignores arrows while a modal is open (keyboard users keep native select/text/range
    // behavior there), so the pad moves focus through the modal itself.
    if (key.startsWith('Arrow') && !event.defaultPrevented) {
      moveFocusInDialog(target, key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1);
    }
  };

  const poll = (now: number) => {
    const pads = navigator.getGamepads().filter((pad): pad is Gamepad => pad !== null);
    if (!pads.length) {
      frame = null;
      nextFireAt.clear();
      return;
    }
    const held = new Set(pads.flatMap(pressedKeys));
    for (const key of nextFireAt.keys()) if (!held.has(key)) nextFireAt.delete(key);
    for (const key of held) {
      const due = nextFireAt.get(key);
      if (due !== undefined && now < due) continue;
      const repeats = key.startsWith('Arrow');
      nextFireAt.set(
        key,
        repeats ? now + (due === undefined ? REPEAT_DELAY_MS : REPEAT_INTERVAL_MS) : Infinity,
      );
      press(key);
    }
    frame = requestAnimationFrame(poll);
  };

  window.addEventListener('gamepadconnected', () => {
    frame ??= requestAnimationFrame(poll);
  });
}
