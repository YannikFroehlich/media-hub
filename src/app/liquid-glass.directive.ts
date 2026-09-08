import { Directive, ElementRef, OnDestroy, afterNextRender, inject } from '@angular/core';
import { LiquidGlassRenderer } from './core/liquid-glass-renderer';

@Directive({ selector: '[appLiquidGlass]' })
export class LiquidGlassDirective implements OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly renderer = inject(LiquidGlassRenderer);
  private observer?: ResizeObserver;
  private frame = 0;
  private geometry = '';
  private revision = 0;
  private release?: () => void;

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      this.observer = new ResizeObserver(() => {
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => this.update());
      });
      this.observer.observe(this.element);
    });
  }

  ngOnDestroy(): void {
    this.revision++;
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
    this.release?.();
  }

  private async update(): Promise<void> {
    // Layout dimensions exclude hover/drag transforms; moving glass samples the
    // live backdrop without regenerating its shape map on every pointer event.
    const width = this.element.offsetWidth;
    const height = this.element.offsetHeight;
    const radius = Math.round(parseFloat(getComputedStyle(this.element).borderTopLeftRadius)) || 0;
    const geometry = `${width}:${height}:${radius}`;
    if (geometry === this.geometry) return;
    const revision = ++this.revision;
    this.geometry = geometry;
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
