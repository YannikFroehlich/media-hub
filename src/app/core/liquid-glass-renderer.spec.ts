import { TestBed } from '@angular/core/testing';
import { LiquidGlassRenderer } from './liquid-glass-renderer';

describe('LiquidGlassRenderer', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/png;base64,test',
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('shares filters for equal surfaces and retains them until the last surface leaves', async () => {
    const renderer = TestBed.inject(LiquidGlassRenderer);
    const [first, second] = await Promise.all([
      renderer.acquire(122, 146, 20),
      renderer.acquire(122, 146, 20),
    ]);
    expect(first).not.toBeNull();
    expect(first?.url).toBe(second?.url);
    expect(document.querySelectorAll('filter')).toHaveLength(1);
    first?.release();
    expect(document.querySelectorAll('filter')).toHaveLength(1);
    second?.release();
    expect(document.querySelectorAll('filter')).toHaveLength(0);
  });

  it('creates a correctly sized map when a responsive surface changes size', async () => {
    const renderer = TestBed.inject(LiquidGlassRenderer);
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

  it('uses a fallback when canvas rendering is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(await TestBed.inject(LiquidGlassRenderer).acquire(122, 146, 20)).toBeNull();
    expect(document.querySelectorAll('filter')).toHaveLength(0);
  });

  it('does not attach late filter results after the application is destroyed', async () => {
    const renderer = TestBed.inject(LiquidGlassRenderer);
    const pending = renderer.acquire(122, 146, 20);
    renderer.ngOnDestroy();
    expect(await pending).toBeNull();
    expect(document.querySelectorAll('filter')).toHaveLength(0);
  });
});
