import { Directive, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';
import { LiquidGlassRenderer } from './core/liquid-glass-renderer';

@Directive({ selector: '[appLiquidGlass]' })
export class LiquidGlassDirective implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(LiquidGlassRenderer);
  private observer?: ResizeObserver;
  private styleObserver?: MutationObserver;
  private geometry = '';
  private revision = 0;
  private destroyed = false;
  private release?: () => void;
  private renderTimer?: ReturnType<typeof setTimeout>;

  // Handed to the shared scheduler so all refracting surfaces measure in one frame
  // — reads first, writes after — instead of triggering separate layout cycles.
  private readonly measure = () => this.measureGeometry();

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(() => this.renderer.schedule(this.measure));
        this.observer.observe(this.element);
      }
      if (typeof MutationObserver !== 'undefined') {
        this.styleObserver = new MutationObserver(() => this.renderer.schedule(this.measure));
        this.styleObserver.observe(this.element.ownerDocument.documentElement, {
          attributes: true,
          attributeFilter: ['data-style'],
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.revision++;
    this.destroyed = true;
    this.observer?.disconnect();
    this.styleObserver?.disconnect();
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderer.cancel(this.measure);
    this.release?.();
    this.release = undefined;
  }

  /** Read-only phase: returns the restyling to apply once all elements are measured. */
  private measureGeometry(): (() => void) | void {
    const active =
      this.element.ownerDocument.documentElement.getAttribute('data-style') === 'liquid-glass';
    if (!active) {
      if (this.geometry === 'inactive') return;
      this.geometry = 'inactive';
      return () => this.deactivate();
    }

    // Layout dimensions exclude hover/drag transforms; moving glass samples the
    // live backdrop without regenerating its shape map on every pointer event.
    const width = this.element.offsetWidth;
    const height = this.element.offsetHeight;
    const radius = Math.round(parseFloat(getComputedStyle(this.element).borderTopLeftRadius)) || 0;
    const geometry = `${width}:${height}:${radius}`;
    if (geometry === this.geometry) return;
    this.geometry = geometry;
    return () => this.queueGeometry(width, height, radius);
  }

  private queueGeometry(width: number, height: number, radius: number): void {
    const revision = ++this.revision;
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = undefined;
    // Very large surfaces retain the CSS fallback.
    if (width < 2 || height < 2 || width * height > 4_000_000) {
      this.clearFilter();
      return;
    }
    // Live window resizing can emit dozens of geometries per second. Keep the
    // current map visually stable and only generate the final settled size.
    this.renderTimer = setTimeout(() => {
      this.renderTimer = undefined;
      void this.applyGeometry(width, height, radius, revision);
    }, 120);
  }

  private async applyGeometry(
    width: number,
    height: number,
    radius: number,
    revision: number,
  ): Promise<void> {
    if (this.destroyed || revision !== this.revision) return;
    const filter = await this.renderer.acquire(width, height, radius).catch(() => null);
    if (filter) {
      if (revision !== this.revision) {
        filter.release();
        return;
      }
      const previousRelease = this.release;
      this.element.style.setProperty('--liquid-refraction', filter.url);
      this.release = filter.release;
      previousRelease?.();
    }
  }

  private deactivate(): void {
    this.revision++;
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = undefined;
    this.clearFilter();
  }

  private clearFilter(): void {
    this.element.style.removeProperty('--liquid-refraction');
    this.release?.();
    this.release = undefined;
  }
}
