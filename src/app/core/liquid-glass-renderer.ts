import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Unused filters kept alive for reuse. Generating one walks the surface pixels
 * and PNG-encodes a map, so a window resize that passes back
 * through a size — or a style toggle — would otherwise pay for it again.
 */
export const RETAINED_FILTER_LIMIT = 6;

interface GlassFilter {
  id: string;
  element: SVGElement;
  users: number;
}

/**
 * A geometry measurement queued for the next frame. `measure` may only read
 * layout; the writes it wants applied go into the callback it returns.
 */
export type GlassMeasure = () => (() => void) | void;

@Injectable({ providedIn: 'root' })
export class LiquidGlassRenderer implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly filters = new Map<string, GlassFilter>();
  private readonly pending = new Set<GlassMeasure>();
  private svg?: SVGElement;
  private nextId = 0;
  private frame = 0;
  private destroyed = false;

  /**
   * Batches every glass element's geometry read into one frame, all reads before
   * any writes. Measuring and restyling one element at a time interleaves reads
   * with writes and forces a style recalculation per element instead of one.
   */
  schedule(measure: GlassMeasure): void {
    this.pending.add(measure);
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      const measures = [...this.pending];
      this.pending.clear();
      const writes = measures.map((task) => task());
      for (const write of writes) write?.();
    });
  }

  cancel(measure: GlassMeasure): void {
    this.pending.delete(measure);
  }

  async acquire(
    width: number,
    height: number,
    radius: number,
  ): Promise<{ url: string; release: () => void } | null> {
    // Load the optical calculations only when the glass style is visible.
    const { createGlassMaps } = await import('./liquid-glass-refraction');
    if (this.destroyed) return null;
    const key = `${width}:${height}:${radius}`;
    let filter = this.filters.get(key);
    if (!filter) {
      const canvas = this.document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;
      canvas.width = width;
      canvas.height = height;

      const maps = createGlassMaps(width, height, radius);
      const toImage = (pixels: Uint8ClampedArray) => {
        const image = context.createImageData(width, height);
        image.data.set(pixels);
        context.putImageData(image, 0, 0);
        return canvas.toDataURL('image/png');
      };
      const id = `media-hub-glass-${this.nextId++}`;
      const element = this.node('filter', {
        id,
        x: '0%',
        y: '0%',
        width: '100%',
        height: '100%',
        'color-interpolation-filters': 'sRGB',
      });
      const append = (name: string, attributes: Record<string, string>) =>
        element.appendChild(this.node(name, attributes));

      // Keep the runtime filter to the two primitives that create the actual
      // refraction. Each additional primitive is another full-surface GPU pass on
      // every frame; tint and edge shine are rendered by inexpensive CSS layers.
      append('feImage', {
        href: toImage(maps.displacement),
        x: '0',
        y: '0',
        width: String(width),
        height: String(height),
        result: 'displacement',
      });
      // PNG channels are 8-bit, so the neutral centre is 128/255 rather than exactly
      // 0.5. Correcting that with an feComponentTransfer costs a pass to buy back
      // `scale * 0.002` px — a sub-pixel, uniform shift of the sampled backdrop.
      append('feDisplacementMap', {
        in: 'SourceGraphic',
        in2: 'displacement',
        scale: String(maps.scale),
        xChannelSelector: 'R',
        yChannelSelector: 'G',
      });
      this.definitions().appendChild(element);
      filter = { id, element, users: 0 };
      this.filters.set(key, filter);
    }

    const entry = filter;
    entry.users++;
    // Re-inserting moves the key to the back of the Map's insertion order, so the
    // eviction below drops whichever unused filter was acquired longest ago.
    this.filters.delete(key);
    this.filters.set(key, entry);
    return {
      url: `url("#${entry.id}")`,
      release: () => {
        if (--entry.users === 0) this.evictRetained();
      },
    };
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.svg?.remove();
    this.filters.clear();
    this.pending.clear();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private evictRetained(): void {
    // Insertion order is acquisition order, so the surplus is at the front.
    const retained = [...this.filters].filter(([, entry]) => !entry.users);
    const surplus = retained.length - RETAINED_FILTER_LIMIT;
    for (let i = 0; i < surplus; i++) {
      const [key, entry] = retained[i];
      entry.element.remove();
      this.filters.delete(key);
    }
  }

  private definitions(): SVGElement {
    if (!this.svg) {
      this.svg = this.node('svg', {
        width: '0',
        height: '0',
        'aria-hidden': 'true',
        focusable: 'false',
      });
      this.svg.style.cssText = 'position: absolute; overflow: hidden; pointer-events: none';
      this.document.body.appendChild(this.svg);
    }
    return this.svg;
  }

  private node(name: string, attributes: Record<string, string>): SVGElement {
    const element = this.document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  }
}
