import { Directive, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';
import { LiquidGlassRenderer } from './core/liquid-glass-renderer';

@Directive({ selector: '[appLiquidGlass]' })
export class LiquidGlassDirective implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(LiquidGlassRenderer);
  private observer?: ResizeObserver;
  private geometry = '';
  private revision = 0;
  private destroyed = false;
  private release?: () => void;

  // Handed to the shared scheduler so every glass element on the page measures in
  // one frame — reads first, writes after — instead of each one triggering its own
  // read/write/read cycle. A dashboard has dozens of these observing at once.
  private readonly measure = () => this.measureGeometry();

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      this.observer = new ResizeObserver(() => this.renderer.schedule(this.measure));
      this.observer.observe(this.element);
    });
  }

  ngOnDestroy(): void {
    this.revision++;
    this.destroyed = true;
    this.observer?.disconnect();
    this.renderer.cancel(this.measure);
    this.release?.();
    this.release = undefined;
  }

  /** Read-only phase: returns the restyling to apply once all elements are measured. */
  private measureGeometry(): (() => void) | void {
    // Layout dimensions exclude hover/drag transforms; moving glass samples the
    // live backdrop without regenerating its shape map on every pointer event.
    const width = this.element.offsetWidth;
    const height = this.element.offsetHeight;
    const radius = Math.round(parseFloat(getComputedStyle(this.element).borderTopLeftRadius)) || 0;
    const geometry = `${width}:${height}:${radius}`;
    if (geometry === this.geometry) return;
    this.geometry = geometry;
    return () => void this.applyGeometry(width, height, radius);
  }

  private async applyGeometry(width: number, height: number, radius: number): Promise<void> {
    if (this.destroyed) return;
    const revision = ++this.revision;
    this.element.style.removeProperty('--liquid-refraction');
    this.release?.();
    this.release = undefined;
    // Hidden in the classic style. Very large surfaces retain the CSS fallback.
    if (width < 2 || height < 2 || width * height > 4_000_000) return;
    const filter = await this.renderer.acquire(width, height, radius).catch(() => null);
    if (filter) {
      if (revision !== this.revision) {
        filter.release();
        return;
      }
      this.element.style.setProperty('--liquid-refraction', filter.url);
      this.release = filter.release;
    }
  }
}
