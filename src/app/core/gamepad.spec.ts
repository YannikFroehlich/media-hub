import { pressedKeys, startGamepadNavigation } from './gamepad';

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

  it('replays a held button once and clicks the focused element for A', () => {
    let current = pad([0]);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('navigator', { getGamepads: () => [current] });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const click = vi.fn();
    const keys: string[] = [];
    button.addEventListener('click', click);
    button.addEventListener('keydown', (event) => keys.push(event.key));

    startGamepadNavigation(document);
    window.dispatchEvent(new Event('gamepadconnected'));
    frames.shift()!(0);
    frames.shift()!(1000);
    current = pad([]);
    frames.shift()!(1100);

    expect(keys).toEqual(['Enter']);
    expect(click).toHaveBeenCalledTimes(1);
    button.remove();
  });
});
