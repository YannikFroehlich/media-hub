import { createGlassMaps } from './liquid-glass-refraction';

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
  const index = (y * width + x) * 4;
  return Array.from(data.slice(index, index + 4));
}

describe('liquid glass refraction', () => {
  it('keeps the flat centre neutral and free of specular haze', () => {
    const maps = createGlassMaps(300, 200, 60);
    for (const [x, y] of [
      [60, 60],
      [150, 100],
      [239, 139],
    ]) {
      expect(pixel(maps.displacement, 300, x, y)).toEqual([128, 128, 0, 255]);
      expect(pixel(maps.specular, 300, x, y)).toEqual([0, 0, 0, 0]);
    }
    expect(maps.scale).toBeGreaterThan(100);
    expect(Number.isFinite(maps.scale)).toBe(true);
  });

  it('refracts opposite edges in opposite directions along their surface normals', () => {
    const { displacement } = createGlassMaps(300, 200, 60);
    const left = pixel(displacement, 300, 2, 100);
    const right = pixel(displacement, 300, 297, 100);
    const top = pixel(displacement, 300, 150, 2);
    const bottom = pixel(displacement, 300, 150, 197);
    expect(left[0]).toBeGreaterThan(128);
    expect(left[0] + right[0]).toBe(256);
    expect(left[1]).toBe(128);
    expect(right[1]).toBe(128);
    expect(top[1]).toBeGreaterThan(128);
    expect(top[1] + bottom[1]).toBe(256);
    expect(top[0]).toBe(128);
    expect(bottom[0]).toBe(128);
  });

  it('bends rounded corners diagonally and leaves pixels outside the glass neutral', () => {
    const { displacement } = createGlassMaps(300, 200, 60);
    const corner = pixel(displacement, 300, 20, 20);
    expect(corner[0]).toBeGreaterThan(128);
    expect(corner[0]).toBe(corner[1]);
    expect(pixel(displacement, 300, 0, 0)).toEqual([128, 128, 0, 255]);
  });

  it('keeps the bezel in pixel units when a panel becomes wider', () => {
    const tile = createGlassMaps(122, 146, 20);
    const panel = createGlassMaps(900, 400, 20);
    for (const x of [0, 2, 10, 18, 25]) {
      expect(pixel(tile.displacement, 122, x, 73)).toEqual(pixel(panel.displacement, 900, x, 200));
    }
  });

  it('clamps oversized corner radii to the actual surface dimensions', () => {
    const small = createGlassMaps(30, 20, 60);
    const clamped = createGlassMaps(30, 20, 10);
    expect(small).toEqual(clamped);
  });
});
