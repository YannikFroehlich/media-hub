import { TestBed } from '@angular/core/testing';
import { LiquidGlassRenderer, RETAINED_FILTER_LIMIT } from './liquid-glass-renderer';

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

describe('LiquidGlassRenderer', () => {
  let renderer: LiquidGlassRenderer;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,test',
    );
    renderer = TestBed.inject(LiquidGlassRenderer);
  });

  // Released filters now stay in the document for reuse, so each test has to take
  // its own definitions with it or the next one counts the leftovers.
  afterEach(() => {
    renderer.ngOnDestroy();
    vi.restoreAllMocks();
  });

  it('shares one filter between equal surfaces', async () => {
    const [first, second] = await Promise.all([
      renderer.acquire(122, 146, 20),
      renderer.acquire(122, 146, 20),
    ]);
    expect(first).not.toBeNull();
    expect(first?.url).toBe(second?.url);
    expect(document.querySelectorAll('filter')).toHaveLength(1);
    first?.release();
    second?.release();
  });

  it('reuses a released filter when a surface returns to that size', async () => {
    const original = await renderer.acquire(122, 146, 20);
    original?.release();
    const encodes = vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.calls.length;

    const revived = await renderer.acquire(122, 146, 20);
    expect(revived?.url).toBe(original?.url);
    expect(document.querySelectorAll('filter')).toHaveLength(1);
    // Reviving must not walk the pixels or re-encode the maps a second time.
    expect(vi.mocked(HTMLCanvasElement.prototype.toDataURL).mock.calls).toHaveLength(encodes);
    revived?.release();
  });

  it('evicts the least recently released filters once retention is full', async () => {
    const sizes = Array.from({ length: RETAINED_FILTER_LIMIT + 4 }, (_, i) => 60 + i);
    const first = await renderer.acquire(sizes[0], 146, 20);
    first?.release();
    for (const width of sizes.slice(1)) (await renderer.acquire(width, 146, 20))?.release();

    expect(document.querySelectorAll('filter')).toHaveLength(RETAINED_FILTER_LIMIT);
    const widths = Array.from(document.querySelectorAll('filter > feImage:first-of-type'), (map) =>
      Number(map.getAttribute('width')),
    );
    expect(widths).not.toContain(sizes[0]);
    expect(widths).toContain(sizes.at(-1));
  });

  it('creates a correctly sized map when a responsive surface changes size', async () => {
    const original = await renderer.acquire(122, 146, 20);
    const resized = await renderer.acquire(192, 218, 20);
    expect(original?.url).not.toBe(resized?.url);
    const maps = document.querySelectorAll('filter > feImage:first-of-type');
    expect(
      Array.from(maps, (map) => [map.getAttribute('width'), map.getAttribute('height')]),
    ).toEqual([
      ['122', '146'],
      ['192', '218'],
    ]);
    original?.release();
    resized?.release();
  });

  it('uses only one image and one displacement pass per filter', async () => {
    await renderer.acquire(122, 146, 20);
    const filter = document.querySelector('filter');

    expect(filter?.children).toHaveLength(2);
    expect(filter?.querySelectorAll('feImage')).toHaveLength(1);
    expect(filter?.querySelectorAll('feDisplacementMap')).toHaveLength(1);
    expect(filter?.querySelector('feBlend, feColorMatrix, feComposite')).toBeNull();
    expect(vi.mocked(HTMLCanvasElement.prototype.toDataURL)).toHaveBeenCalledTimes(1);
  });

  it('uses a fallback when canvas rendering is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(await renderer.acquire(122, 146, 20)).toBeNull();
    expect(document.querySelectorAll('filter')).toHaveLength(0);
  });

  it('does not attach late filter results after the application is destroyed', async () => {
    const pending = renderer.acquire(122, 146, 20);
    renderer.ngOnDestroy();
    expect(await pending).toBeNull();
    expect(document.querySelectorAll('filter')).toHaveLength(0);
  });

  it('applies scheduled writes only after every measurement has run', async () => {
    const order: string[] = [];
    renderer.schedule(() => {
      order.push('read-a');
      return () => order.push('write-a');
    });
    renderer.schedule(() => {
      order.push('read-b');
      return () => order.push('write-b');
    });
    expect(order).toEqual([]);

    await nextFrame();
    expect(order).toEqual(['read-a', 'read-b', 'write-a', 'write-b']);
  });

  it('drops a cancelled measurement from the pending frame', async () => {
    const kept = vi.fn();
    const cancelled = vi.fn();
    renderer.schedule(cancelled);
    renderer.schedule(kept);
    renderer.cancel(cancelled);

    await nextFrame();
    expect(cancelled).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });
});
