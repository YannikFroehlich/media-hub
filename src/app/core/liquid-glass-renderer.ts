import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject } from '@angular/core';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface GlassFilter {
  id: string;
  element: SVGElement;
  users: number;
}

@Injectable({ providedIn: 'root' })
export class LiquidGlassRenderer implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly filters = new Map<string, GlassFilter>();
  private svg?: SVGElement;
  private nextId = 0;
  private destroyed = false;

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

      append('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: '0.3', result: 'blurred' });
      append('feImage', {
        href: toImage(maps.displacement),
        x: '0',
        y: '0',
        width: String(width),
        height: String(height),
        result: 'displacement',
      });
      // PNG channels are 8-bit: remap 128 to exactly 0.5 so the centre does not shift.
      append('feComponentTransfer', { in: 'displacement', result: 'neutral-displacement' }).append(
        this.node('feFuncR', { type: 'linear', intercept: String(-0.5 / 255) }),
        this.node('feFuncG', { type: 'linear', intercept: String(-0.5 / 255) }),
      );
      append('feDisplacementMap', {
        in: 'blurred',
        in2: 'neutral-displacement',
        scale: String(maps.scale),
        xChannelSelector: 'R',
        yChannelSelector: 'G',
        result: 'displaced',
      });
      append('feColorMatrix', {
        in: 'displaced',
        type: 'saturate',
        values: '4',
        result: 'saturated',
      });
      append('feImage', {
        href: toImage(maps.specular),
        x: '0',
        y: '0',
        width: String(width),
        height: String(height),
        result: 'specular',
      });
      append('feComposite', {
        in: 'saturated',
        in2: 'specular',
        operator: 'in',
        result: 'reflection',
      });
      append('feComponentTransfer', { in: 'specular', result: 'shine' }).appendChild(
        this.node('feFuncA', { type: 'linear', slope: '0.5' }),
      );
      append('feBlend', { in: 'reflection', in2: 'displaced', mode: 'normal', result: 'glass' });
      append('feBlend', { in: 'shine', in2: 'glass', mode: 'normal' });
      this.definitions().appendChild(element);
      filter = { id, element, users: 0 };
      this.filters.set(key, filter);
    }

    const entry = filter;
    entry.users++;
    return {
      url: `url("#${entry.id}")`,
      release: () => {
        if (--entry.users === 0) {
          entry.element.remove();
          this.filters.delete(key);
        }
      },
    };
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.svg?.remove();
    this.filters.clear();
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
