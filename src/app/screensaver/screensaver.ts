import { Component, computed, effect, input, output, signal } from '@angular/core';
import { WeatherSnapshot } from '../core/models';

const PHOTO_INTERVAL_MS = 30_000;

@Component({
  selector: 'app-screensaver',
  templateUrl: './screensaver.html',
})
export class Screensaver {
  readonly visible = input(false);
  readonly clock = input('');
  readonly weather = input<WeatherSnapshot | null>(null);
  readonly location = input('');
  /** Already validated http(s) URLs (see config-schema). */
  readonly images = input<string[]>([]);
  readonly dismiss = output<void>();

  private readonly index = signal(0);
  private readonly failed = signal<ReadonlySet<string>>(new Set());
  private readonly usableImages = computed(() =>
    this.images().filter((image) => !this.failed().has(image)),
  );
  /** Only set while visible, so photos are never fetched in the background. */
  protected readonly currentImage = computed(() => {
    const images = this.usableImages();
    return this.visible() && images.length ? images[this.index() % images.length] : null;
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.visible() || this.usableImages().length < 2) return;
      const timer = window.setInterval(() => this.index.update((i) => i + 1), PHOTO_INTERVAL_MS);
      onCleanup(() => window.clearInterval(timer));
    });
  }

  protected markFailed(image: string): void {
    this.failed.update((failed) => new Set(failed).add(image));
  }
}
