import {
  moveFocusInDialog,
  pressedKeys,
  startGamepadNavigation,
  stepControlValue,
} from './gamepad';

function pad(pressed: number[], axes: number[] = [0, 0]): Gamepad {
  const buttons = Array.from({ length: 17 }, (_, index) => ({
    pressed: pressed.includes(index),
    touched: false,
    value: 0,
  }));
  return { buttons, axes } as unknown as Gamepad;
}

describe('gamepad navigation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('maps the D-pad, stick and face buttons to keyboard keys', () => {
    expect(pressedKeys(pad([0]))).toEqual(['Enter']);
    expect(pressedKeys(pad([1, 15]))).toEqual(['Escape', 'ArrowRight']);
    expect(pressedKeys(pad([], [-0.9, 0.8]))).toEqual(['ArrowLeft', 'ArrowDown']);
    expect(pressedKeys(pad([12], [0, -0.9]))).toEqual(['ArrowUp']);
    expect(pressedKeys(pad([], [0.2, -0.3]))).toEqual([]);
  });

  it('moves focus through a modal in tab order, skipping disabled and file inputs', () => {
    document.body.innerHTML = `
      <button id="outside"></button>
      <aside aria-modal="true">
        <button id="close"></button>
        <input id="name" />
        <button disabled></button>
        <input type="file" />
        <label><input id="check" type="checkbox" /></label>
        <button id="save"></button>
      </aside>`;
    const byId = (id: string) => document.getElementById(id)!;
    const focusedId = () => (document.activeElement as HTMLElement).id;

    moveFocusInDialog(byId('close'), 1);
    expect(focusedId()).toBe('name');
    moveFocusInDialog(byId('name'), 1);
    expect(focusedId()).toBe('check');
    moveFocusInDialog(byId('save'), 1);
    expect(focusedId()).toBe('close');
    moveFocusInDialog(byId('close'), -1);
    expect(focusedId()).toBe('save');

    // Focus outside an open modal gets pulled into it; without a modal nothing moves.
    moveFocusInDialog(byId('outside'), 1);
    expect(focusedId()).toBe('close');
    document.querySelector('aside')!.remove();
    byId('outside').focus();
    moveFocusInDialog(byId('outside'), 1);
    expect(focusedId()).toBe('outside');
    document.body.innerHTML = '';
  });

  it('steps selects and ranges, skipping disabled options and stopping at the ends', () => {
    document.body.innerHTML = `
      <select id="select"><option>a</option><option disabled>b</option><option>c</option></select>
      <input id="range" type="range" min="0" max="2" value="1" />
      <button id="button"></button>`;
    const select = document.getElementById('select') as HTMLSelectElement;
    const range = document.getElementById('range') as HTMLInputElement;
    const changes: string[] = [];
    document.addEventListener('change', (event) => changes.push((event.target as HTMLElement).id));

    expect(stepControlValue(select, 1)).toBe(true);
    expect(select.selectedIndex).toBe(2);
    expect(stepControlValue(select, 1)).toBe(true);
    expect(select.selectedIndex).toBe(2);
    stepControlValue(select, -1);
    expect(select.selectedIndex).toBe(0);

    stepControlValue(range, 1);
    stepControlValue(range, 1);
    expect(range.value).toBe('2');
    stepControlValue(range, -1);
    expect(range.value).toBe('1');

    expect(stepControlValue(document.getElementById('button')!, 1)).toBe(false);
    expect(changes).toEqual(['select', 'select', 'range', 'range', 'range']);
    document.body.innerHTML = '';
  });

  it('replays held buttons: A clicks once, the D-pad moves focus inside a modal', () => {
    let current = pad([0]);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('navigator', { getGamepads: () => [current] });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    document.body.innerHTML = `
      <section aria-modal="true"><button id="first"></button><button id="second"></button></section>`;
    const first = document.getElementById('first')!;
    first.focus();
    const click = vi.fn();
    const keys: string[] = [];
    first.addEventListener('click', click);
    first.addEventListener('keydown', (event) => keys.push(event.key));

    startGamepadNavigation(document);
    window.dispatchEvent(new Event('gamepadconnected'));
    frames.shift()!(0);
    frames.shift()!(1000);
    current = pad([]);
    frames.shift()!(1100);

    expect(keys).toEqual(['Enter']);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset['input']).toBe('gamepad');

    current = pad([13]);
    frames.shift()!(1200);
    expect(document.activeElement?.id).toBe('second');

    document.dispatchEvent(new Event('pointerdown'));
    expect(document.documentElement.dataset['input']).toBe('gamepad'); // untrusted: ignored
    document.body.innerHTML = '';
  });
});
