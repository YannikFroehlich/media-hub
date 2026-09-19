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

/**
 * Replays gamepad input as synthetic keydown events on the focused element, so the existing
 * keyboard handling (spatial navigation, Enter, Escape, screensaver wake-up) drives the gamepad
 * too. Polling only runs while a pad is connected.
 */
// ponytail: no focus movement inside side panels (arrows are ignored there by App); use a
// keyboard for editing, B still closes the panel.
export function startGamepadNavigation(document: Document): void {
  if (typeof navigator.getGamepads !== 'function') return;
  const nextFireAt = new Map<string, number>();
  let frame: number | null = null;

  const press = (key: string) => {
    const target = (document.activeElement as HTMLElement | null) ?? document.body;
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    // Synthetic key events have no default action, so "A" has to click by itself whenever
    // App didn't already handle it (e.g. buttons inside a side panel).
    if (key === 'Enter' && !event.defaultPrevented) target.click();
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
